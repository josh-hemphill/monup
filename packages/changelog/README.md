# @monup/changelog

Changelog generation and extraction for the second Monup workflow step.

## Workflow Role

`@monup/changelog` turns commit history into changelog blocks after versioning. It also stores version markers so later steps can extract release notes for GitHub releases.

## Main Exports

- `generateChangelog()`: write a new changelog block for a version.
- `runChangelog()`: update root or per-package changelogs across a workspace.
- `extractChangelogForVersion()`: read one version block back out of a changelog.
- `getLatestVersionFromChangelog()`: detect the latest documented version.
- `createVersionMarkers()`, `findVersionMarkers()`, and `findVersionBlocks()`: marker helpers for extraction and sync.

## Example

```ts
import { defaultChangelogOptions, generateChangelog } from '@monup/changelog';

await generateChangelog(
	'1.1.0',
	commits,
	'my-package',
	defaultChangelogOptions,
);
```

## Related Packages

- [`@monup/version`](../version/README.md): usually provides the version first.
- [`@monup/github`](../github/README.md): extracts release notes from changelog content.
