import { describe, expect, it } from 'vitest';
import { createVersionMarkers, extractVersionChangelog, findVersionBlocks, findVersionMarkers } from '../src/markers.ts';

describe('createVersionMarkers', () => {
	it('should create start and end markers', () => {
		const result = createVersionMarkers('1.2.3', 'test-package');
		expect(result.start).toBe('<!-- monup:version:1.2.3:test-package:start -->');
		expect(result.end).toBe('<!-- monup:version:1.2.3:test-package:end -->');
	});

	it('should handle different versions and package names', () => {
		const result = createVersionMarkers('2.0.0', 'my-package');
		expect(result.start).toBe('<!-- monup:version:2.0.0:my-package:start -->');
		expect(result.end).toBe('<!-- monup:version:2.0.0:my-package:end -->');
	});
});

describe('extractVersionChangelog', () => {
	it('should extract changelog content between markers', () => {
		const content = `
# Changelog

<!-- monup:version:1.2.3:test-package:start -->
## test-package@1.2.3 - 2024-01-01

### Features
- New feature
<!-- monup:version:1.2.3:test-package:end -->
`;
		const result = extractVersionChangelog(content, '1.2.3', 'test-package');
		expect(result).toBeDefined();
		expect(result).toContain('## test-package@1.2.3');
		expect(result).toContain('New feature');
	});

	it('should return undefined when markers not found', () => {
		const content = '# Changelog\n\nNo markers here';
		const result = extractVersionChangelog(content, '1.2.3', 'test-package');
		expect(result).toBeUndefined();
	});

	it('should handle version with dots in regex', () => {
		const content = `
<!-- monup:version:1.2.3:test-package:start -->
Content here
<!-- monup:version:1.2.3:test-package:end -->
`;
		const result = extractVersionChangelog(content, '1.2.3', 'test-package');
		expect(result).toBe('Content here');
	});

	it('should match any package name when package name not provided', () => {
		const content = `
<!-- monup:version:1.2.3:any-package:start -->
Content here
<!-- monup:version:1.2.3:any-package:end -->
`;
		const result = extractVersionChangelog(content, '1.2.3');
		expect(result).toBe('Content here');
	});
});

describe('findVersionMarkers', () => {
	it('should find all version markers in changelog', () => {
		const content = `
# Changelog

<!-- monup:version:1.2.3:test-package:start -->
Content 1
<!-- monup:version:1.2.3:test-package:end -->

<!-- monup:version:1.2.4:test-package:start -->
Content 2
<!-- monup:version:1.2.4:test-package:end -->
`;
		const result = findVersionMarkers(content);
		expect(result.length).toBe(2);
		expect(result[0]?.version).toBe('1.2.3');
		expect(result[0]?.packageName).toBe('test-package');
		expect(result[1]?.version).toBe('1.2.4');
		expect(result[1]?.packageName).toBe('test-package');
	});

	it('should return empty array when no markers found', () => {
		const content = '# Changelog\n\nNo markers';
		const result = findVersionMarkers(content);
		expect(result).toEqual([]);
	});

	it('should calculate correct indices', () => {
		const content = `<!-- monup:version:1.0.0:test:start -->Content<!-- monup:version:1.0.0:test:end -->`;
		const result = findVersionMarkers(content);
		expect(result.length).toBe(1);
		expect(result[0]?.startIndex).toBe(0);
		expect(result[0]?.endIndex).toBeGreaterThan(result[0]?.startIndex ?? 0);
	});

	it('should handle markers with different package names', () => {
		const content = `
<!-- monup:version:1.0.0:package-a:start -->A<!-- monup:version:1.0.0:package-a:end -->
<!-- monup:version:1.0.0:package-b:start -->B<!-- monup:version:1.0.0:package-b:end -->
`;
		const result = findVersionMarkers(content);
		expect(result.length).toBe(2);
		expect(result[0]?.packageName).toBe('package-a');
		expect(result[1]?.packageName).toBe('package-b');
	});
});

describe('findVersionBlocks', () => {
	it('returns complete marker-wrapped blocks', () => {
		const content = `
<!-- monup:version:1.0.0:package-a:start -->
## package-a@1.0.0 - 2024-01-01
<!-- monup:version:1.0.0:package-a:end -->
`;
		const result = findVersionBlocks(content);
		expect(result.length).toBe(1);
		expect(result[0]?.version).toBe('1.0.0');
		expect(result[0]?.packageName).toBe('package-a');
		expect(result[0]?.content).toContain('## package-a@1.0.0');
	});

	it('handles regex-special characters in package names', () => {
		const content = `
<!-- monup:version:1.2.3:@scope/pkg+name:start -->
Cached
<!-- monup:version:1.2.3:@scope/pkg+name:end -->
`;
		const result = findVersionBlocks(content);
		expect(result.length).toBe(1);
		expect(result[0]?.packageName).toBe('@scope/pkg+name');
		expect(result[0]?.content).toContain('Cached');
	});
});
