import type { PackageInfo } from '../src/filter.ts';

export const root = '/root';
// Package paths in PackageInfo are typically absolute paths
// But the streamer normalizes them relative to root for comparison
export const mockPackages: PackageInfo[] = [
	{ name: 'package1', path: `${root}/packages/pkg1`, root },
	{ name: 'package2', path: `${root}/packages/pkg2`, root },
	{ name: 'package3', path: `${root}/packages/pkg3`, root },
];
