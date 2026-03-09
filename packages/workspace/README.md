# @monup/workspace

Workspace detection and package metadata for Monup.

## Workflow Role

`@monup/workspace` discovers the packages Monup should operate on before versioning, changelog generation, publishing, or release creation.

## Main Exports

- `detectPackages()`: detect packages in pnpm, npm, Deno, or single-package repos.
- `getPackageInfo()`: look up one detected package.
- `updatePackageVersions()`: write version updates across detected packages.
- `registerDetector()`: add custom workspace detectors.
- `PackageInfo`: shared package metadata used across Monup packages.

Each logical package has a canonical `packageFile`, and may also expose `packageFiles` when multiple manifests map to the same package path.

## Example

```ts
import { detectPackages, getPackageInfo } from '@monup/workspace';

const packages = await detectPackages();
const pkg = await getPackageInfo('@my/package');
```

## Related Packages

- [`@monup/version`](../version/README.md): updates manifest versions for detected packages.
- [`@monup/release`](../release/README.md): publishes one target per manifest when needed.
