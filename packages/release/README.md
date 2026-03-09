# @monup/release

Package publishing for the Monup release step.

## Workflow Role

`@monup/release` is the publish stage of the workflow. In the default Monup flow, this is usually the CI step that runs after local `version` and `changelog` work has already been reviewed.

## Main Exports

  - `publish()`: publish one package manifest.
  - `publishPackages()`: publish all detected packages with shared context.
  - `listPublishedVersions()`: inspect already published versions.
  - `resolveReleaseOptions()`: normalize release options.
  - `defaultReleaseOptions`: shared release defaults.

One logical package can publish more than once when it has multiple manifest files, because Monup creates one publish target per `packageFile`.

## Notes

  - Publish targets are inferred from the package manifest being handled.
  - Registry and package-manager handling are resolved internally.
  - `dryRun` behavior depends on the resolved release options and CI context.

## Example

```ts
import { publishPackages } from '@monup/release';

await publishPackages(packages, releaseOptions, {
  dryRun: true,
  isCI: false,
});
```

## Related Packages

  - [`@monup/workspace`](../workspace/README.md): provides detected packages and manifest paths.
  - [`@monup/options`](../options/README.md): provides resolved release options.
  - [`@monup/github`](../github/README.md): usually runs after publishing.
