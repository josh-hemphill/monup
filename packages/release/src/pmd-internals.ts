import type { Agent, AgentName, DetectResult } from 'package-manager-detector';
import { AGENTS } from 'package-manager-detector';

export function resolveAgent(nameAndVer: { name: AgentName; ver?: string } | undefined): DetectResult | null {
	let agent: Agent | undefined;
	if (nameAndVer) {
		const name = nameAndVer.name;
		const ver = nameAndVer.ver;
		let version = ver;
		if (name === 'yarn' && typeof ver === 'string' && Number.parseInt(ver) > 1) {
			agent = 'yarn@berry';
			// the version in packageManager isn't the actual yarn package version
			version = 'berry';
			return { name, agent, version };
		}
		else if (name === 'pnpm' && typeof ver === 'string' && Number.parseInt(ver) < 7) {
			agent = 'pnpm@6';
			return { name, agent, version };
		}
		else if (AGENTS.includes(name)) {
			agent = name as Agent;
			return { name, agent, version };
		}
	}
	return null;
}

export function handleVer(version: string | undefined): string | undefined {
	return version?.match(/\d+(?:\.\d+){0,2}/)?.[0] ?? version;
}
