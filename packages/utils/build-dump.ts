/** Error dump for E:/Share/dev/monup/packages/utils/src/log-formatter.ts */

import type { LogLevelNumbers } from 'loglevel';
import type { chalk } from 'zx';
/**
 * Formats a single log value, converting objects to key=value pairs
 */
function formatLogValue(value: unknown): string {
	if (value === null) {
		return 'null';
	}
	if (value === undefined) {
		return 'undefined';
	}
	if (typeof value === 'string') {
		return value;
	}
	if (typeof value === 'number' || typeof value === 'boolean') {
		return String(value);
	}
	if (value instanceof Date) {
		return value.toISOString();
	}
	if (Array.isArray(value)) {
		return value.map(formatLogValue).join(', ');
	}
	if (typeof value === 'object') {
		const entries: string[] = [];
		const rawEntries = Object.entries(value);
		const multiline = rawEntries.length > 1;
		if (multiline) {
			entries.push(`{\n`);
		}
		for (const [key, val] of rawEntries) {
			entries.push(`${key}: ${formatLogValue(val)}`);
		}
		if (multiline) {
			entries.push(`}`);
		}
		return entries.join(multiline ? '\n' : ' ');
	}
	return String(value);
}

function formatColoredLogValue(options: LogFormatterOptions, value: unknown): string {
	const { formatMap } = options;
	if (!formatMap) {
		return formatLogValue(value);
	}
	const line: string[] = [];
	if (typeof value === 'string') {
		line.push(formatMap.str(value));
	}
	else if (typeof value === 'number' || typeof value === 'boolean') {
		line.push(formatMap.numOrBool(String(value)));
	}
	else if (value instanceof Error) {
		line.push(
			formatMap.errorMessage(value.message),
			typeof value.stack === 'string' ? `\n${formatMap.errorStack(value.stack)}` : '',
		);
	}
	return line.join('');
}

/**
 * Formats all log arguments, converting objects to key=value format
 * If first arg is a string and second is an object, combines them
 */
function formatLogArgs(options: LogFormatterOptions, ...args: unknown[]): string[] {
	if (args.length === 0) {
		return [];
	}
	if (args.length === 1) {
		return [formatColoredLogValue(options, args[0])];
	}
	// If first arg is string and second is object, combine them
	if (typeof args[0] === 'string'
		&& typeof args[1] === 'object'
		&& args[1] !== null
		&& !Array.isArray(args[1])
		&& !(args[1] instanceof Date)
		&& !(args[1] instanceof Error)
	) {
		const formatted = formatColoredLogValue(options, args[1]);
		const combined = formatted.length > 0 ? `${args[0]} ${formatted}` : args[0];
		// Process remaining args
		const remaining = args.slice(2).map((value) => formatColoredLogValue(options, value));
		return [combined, ...remaining];
	}
	// Otherwise format each arg separately
	return args.map((value) => formatColoredLogValue(options, value));
}

type ColorFunction = typeof chalk;
export interface ColorFormatterMap {
	str: ColorFunction;
	numOrBool: ColorFunction;
	errorMessage: ColorFunction;
	errorStack: ColorFunction;
	prefix: ColorFunction | true;
	suffix: ColorFunction;
	bold: ColorFunction;
	error: ColorFunction;
	warn: ColorFunction;
	info: ColorFunction;
	debug: ColorFunction;
}

/**
 * Options for the log formatter
 */
export interface LogFormatterOptions {
	/**
	 * Prefix to add to the log message
	 * If true, use the default prefix
	 * If a string, use the string as the prefix
	 * If a function, use the function to create the prefix
	 */
	prefix?: string | true | PrefixFunction;
	/**
	 * Suffix to add to the log message
	 */
	suffix?: string | SuffixFunction;
	/**
	 * Color map for the log message
	 */
	formatMap?: ColorFormatterMap;
}

type PrefixFunction = (methodName: string, logLevel: LogLevelNumbers, loggerName: string, formatMap: ColorFormatterMap | undefined, args: unknown[]) => string | undefined;
type SuffixFunction = PrefixFunction;
type AffixFunction = PrefixFunction | SuffixFunction;

function getDefaultPrefix(methodName: string, formatMap: ColorFormatterMap | undefined, loggerName: string | symbol): string {
	const defaultPrefix = `[${methodName.toUpperCase()}] ${String(loggerName)}`;
	if (!formatMap) {
		return defaultPrefix;
	}
	if (typeof formatMap.prefix === 'function') {
		return formatMap.prefix(defaultPrefix);
	}
	const methodLowerCase = methodName.toLowerCase() as 'error' | 'warn' | 'info' | 'debug';
	if (methodLowerCase in formatMap) {
		return `${formatMap[methodLowerCase](methodName.toUpperCase())} ${String(loggerName)}`;
	}
	return defaultPrefix;
}

function resolveAffix(
	affix: string | true | AffixFunction | undefined,
	formatMap: ColorFormatterMap | undefined,
	methodName: string,
	logLevel: LogLevelNumbers,
	loggerName: string | symbol,
	args: unknown[],
): string | undefined {
	if (typeof affix === 'function') {
		return affix(methodName, logLevel, String(loggerName), formatMap, args);
	}
	if (typeof affix === 'string') {
		return affix;
	}
	if (affix === true) {
		return getDefaultPrefix(methodName, formatMap, loggerName);
	}
	return undefined;
}
/**
 * Loglevel plugin that formats objects in log arguments as key=value pairs
 * Based on loglevel's methodFactory API
 */
export function applyLogFormatter(logger: ReturnType<typeof import('loglevel').getLogger>, options: LogFormatterOptions = {}): void {
	const originalFactory = logger.methodFactory;
	logger.methodFactory = function (methodName, logLevel, loggerName) {
		const rawMethod = originalFactory(methodName, logLevel, loggerName);
		return function (...args: unknown[]) {
			const formatted = formatLogArgs(options, ...args);
			const prefix = resolveAffix(options.prefix, options.formatMap, methodName, logLevel, loggerName, args);
			if (typeof prefix === 'string' && prefix.length > 0) {
				formatted.unshift(prefix);
			}
			const suffix = resolveAffix(options.suffix, options.formatMap, methodName, logLevel, loggerName, args);
			if (typeof suffix === 'string' && suffix.length > 0) {
				formatted.push(suffix);
			}
			return rawMethod(...formatted);
		};
	};
	logger.setLevel(logger.getLevel());
}
