# @monup/version

Version calculation and manifest updates for the first Monup workflow step.

## Workflow Role

`@monup/version` determines the next version from commits and writes that version back to package manifests before changelog generation and publishing.

## Main Exports

  - `calculateVersion()`: derive bump type and next version from commits.
  - `getPreviousVersion()`: resolve the previous version from package files, tags, registries, changelogs, or releases.
  - `runVersionBump()`: apply version bumps across detected packages.
  - `getCurrentVersionFromFile()` and `updateVersionInFile()`: read and write versions in one manifest.
  - `updateVersionInAdditionalFiles()`: replace version strings in extra files.
  - `registerUpdater()`: add support for more manifest types.

## Example

```ts
import { calculateVersion, updateVersionInFile } from '@monup/version';

const { nextVersion } = calculateVersion('1.0.0', commits);

if (typeof nextVersion === 'string') {
  await updateVersionInFile('./package.json', nextVersion);
}
```

## Related Packages

  - [`@monup/git`](../git/README.md): provides commit history and tags.
  - [`@monup/changelog`](../changelog/README.md): usually runs after versioning.
