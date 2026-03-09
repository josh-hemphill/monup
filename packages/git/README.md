# @monup/git

Git history, tag, and commit parsing utilities for Monup.

## Workflow Role

`@monup/git` provides the commit ranges, tag history, tag formatting, and conventional commit parsing used by the version, changelog, and GitHub steps.

## Main Exports

  - `getCommits()` and `getCommitsSinceLastTag()`: read commits for workflow decisions.
  - `getCommitsForPackage()`: select commits relevant to one package.
  - `getLastTag()`, `getLastPackageTag()`, `getGlobalTagHistory()`, and `getPackageTagHistory()`: work with tags.
  - `createCommit()`, `createTag()`, `pushToRemote()`, and `getWorkingTreeStatus()`: perform git operations.
  - `formatTag()`, `parseConventionalCommit()`, and `getGitHubRepo()`: shared helpers for higher-level packages.

## Example

```ts
import { createTag, getCommits, getLastTag } from '@monup/git';

const lastTag = await getLastTag(undefined, 'v%s');
const commits = await getCommits(lastTag);

await createTag('v1.1.0', 'Release 1.1.0');
```

## Related Packages

  - [`@monup/version`](../version/README.md): uses tags and commits to determine bumps.
  - [`@monup/changelog`](../changelog/README.md): uses git history to build changelog blocks.
