# @monup/github

GitHub API client for release creation.

## Purpose

Creates GitHub releases using the GitHub API, extracting changelog content and publishing it as release notes.

## Use Case

Use when you need to automate GitHub release creation after version bumps. Extracts version-specific changelog entries and publishes them as release notes with tags.

## Example

```typescript
import { createRelease } from '@monup/github';

await createRelease(
	'1.1.0',
	'my-package',
	'v1.1.0',
	defaultGitHubOptions,
);
```
