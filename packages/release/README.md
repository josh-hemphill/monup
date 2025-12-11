# @monup/release

Package publishing for npm and JSR.

## Purpose

Publishes packages to npm or JSR registries. Supports dry-run validation before actual publication.

## Use Case

Use when you need to publish versioned packages. Automatically detects package type (package.json → npm, jsr.json → JSR) and publishes accordingly.

## Example

```typescript
import { dryRun, publish } from '@monup/release';

// Validate before publishing
await dryRun(packageInfo, options);

// Publish to registry
await publish(packageInfo, options);
```
