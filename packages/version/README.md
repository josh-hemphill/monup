# @monup/version

Version calculation and file updates based on commits.

## Purpose

Calculates next version using semantic versioning rules from conventional commits. Updates version in package files (package.json, deno.json, jsr.json) via plugin-based updaters.

## Use Case

Use when you need to determine version bumps from commit types (feat → minor, fix → patch, breaking → major) and update version fields in package files.

## Example

```typescript
import { calculateVersion, updateVersionInFile } from '@monup/version';

const { bumpType, nextVersion } = calculateVersion('1.0.0', commits);

if (nextVersion) {
	await updateVersionInFile('./package.json', nextVersion);
}
```
