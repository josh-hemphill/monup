# @monup/changelog

Generates changelogs from conventional commits.

## Purpose

Transforms parsed git commits into formatted changelog entries grouped by type (feat, fix, etc.), with support for custom formatting, scope mapping, and version markers for extraction.

## Use Case

Use when you need to generate or update a CHANGELOG.md file from your git history. Groups commits by type, formats them according to conventional commit standards, and prepends new entries to existing changelogs.

## Example

```typescript
import { generateChangelog } from '@monup/changelog';
import { getCommits } from '@monup/git';

const commits = await getCommits('v1.0.0');
const changelog = await generateChangelog(
	'1.1.0',
	commits,
	'my-package',
	defaultChangelogOptions,
);
```
