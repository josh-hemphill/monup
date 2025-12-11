import type * as fsExtra from 'fs-extra';

declare module 'zx' {
	export const fs: typeof fsExtra;
}
