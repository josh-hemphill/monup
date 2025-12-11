# @monup/workspace

Monorepo workspace detection and package management.

## Purpose

Detects packages in pnpm, npm, or Deno workspaces. Supports plugin-based detectors for different workspace types and can treat root as a single package.

## Use Case

Use when you need to discover packages in a monorepo or single-package repository. Maps package names to paths and package files for workspace-aware operations.

## Example

```typescript
import { detectPackages, getPackageInfo } from '@monup/workspace';

// Detect all packages in workspace
const packages = await detectPackages();

// Get specific package info
const pkg = await getPackageInfo('@my/package');
```
