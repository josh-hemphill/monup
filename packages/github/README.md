# @monup/github

GitHub release creation for the final Monup workflow step.

## Workflow Role

`@monup/github` turns changelog content into GitHub releases after versioning and publishing are complete. In the default Monup flow, this is usually a CI step.

## Main Exports

  - `createRelease()`: create one GitHub release for a tag.
  - `createReleasesForPackages()`: create releases for all detected packages.
  - `listReleases()`: read existing GitHub releases.
  - `extractChangelogForRelease()`: build release notes from changelog content.
  - `defaultGitHubOptions`: shared GitHub defaults.

## Requirements

  - `repo` or `releaseRepo` must resolve to `owner/repo`.
  - `GITHUB_TOKEN` must be available in the environment.
  - Git and changelog context are needed to build the tag name and release notes.

## Example

```ts
import { createReleasesForPackages } from '@monup/github';

await createReleasesForPackages(packages, {
  github: {
    repo: 'owner/repo',
    changelogMethod: 'auto',
  },
  git: {
    tagStrategy: 'package',
    tagTemplate: 'v%s',
  },
  changelog: {
    strategy: 'per-package',
    location: 'CHANGELOG.md',
  },
});
```

## Related Packages

  - [`@monup/changelog`](../changelog/README.md): provides the release note source.
  - [`@monup/git`](../git/README.md): provides tag formatting and repo context.
  - [`@monup/release`](../release/README.md): usually runs before GitHub release creation.
