# @monup/git

Git operations and conventional commit parsing.

## Purpose

Provides git repository operations (fetching commits, tags, branches) and parses conventional commits. Streams git log output to efficiently map commits to packages in monorepos.

## Use Case

Use when you need to query git history, parse commit messages, filter commits by affected packages, or perform git operations like creating tags and pushing to remotes.

## Example

```typescript
import { createTag, getCommits, getTags } from '@monup/git';

// Get commits since last tag
const commits = await getCommits('v1.0.0');

// Get all tags
const tags = await getTags();

// Create a new tag
await createTag('v1.1.0', 'Release 1.1.0');
```
