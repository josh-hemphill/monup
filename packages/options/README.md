# @monup/options

Configuration resolution and normalization.

## Purpose

Resolves and merges monup configuration from multiple sources (config files, CLI arguments, programmatic overrides). Detects CI environments and applies appropriate defaults.

## Use Case

Use when you need centralized configuration management. Merges defaults with file-based config (using c12) and runtime overrides, ensuring consistent options across all monup packages.

## Example

```typescript
import { resolveOptions } from '@monup/options';

const options = await resolveOptions({
	version: { prerelease: true },
	logLevel: { default: 'debug' },
});
```
