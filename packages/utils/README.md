# @monup/utils

Shared utility functions.

## Purpose

Provides common utilities used across monup packages: CI environment detection and deep object merging.

## Use Case

Use when you need CI detection or configuration merging utilities in monup packages.

## Example

```typescript
import { detectCI, mergeWithDefaults } from '@monup/utils';

const isCI = detectCI();

const merged = mergeWithDefaults(
	{ version: '1.0.0', name: 'test' },
	{ version: '2.0.0' },
);
```
