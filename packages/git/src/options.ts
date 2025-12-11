/**
 * Git package options
 */

export interface GitOptions {
	commit?: boolean;
	push?: boolean;
	tag?: boolean;
	sign?: boolean;
	noVerify?: boolean;
	tagStrategy?: 'package' | 'global';
	tagTemplate?: string;
	tagFilter?: (tag: string) => boolean;
	from?: string;
	to?: string;
}

type NonDefaultedGitOptionsKeys = 'tagFilter' | 'from' | 'to';
type DefaultedGitOptions = Omit<GitOptions, NonDefaultedGitOptionsKeys>;
type NonDefaultedGitOptions = Pick<GitOptions, NonDefaultedGitOptionsKeys>;
export type ResolvedGitOptions = Required<DefaultedGitOptions> & NonDefaultedGitOptions;

export const defaultGitOptions: ResolvedGitOptions = {
	commit: true,
	push: true,
	tag: true,
	sign: false,
	noVerify: false,
	tagStrategy: 'global',
	tagTemplate: 'v%s',
	tagFilter: () => true,
	from: undefined,
	to: undefined,
};
