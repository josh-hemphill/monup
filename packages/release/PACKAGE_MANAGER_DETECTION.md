# Package Manager Detection & Command Selection - Analysis & Design

## Current State Analysis

### Current Implementation

The release package currently:

1. **Determines package type** by file extension:
   - `package.json` → npm package → uses `npm publish`
   - `jsr.json` → JSR package → uses `deno publish`

2. **Hardcoded commands** in `npm.ts` and `jsr.ts`:
   - `npm.ts`: Executes `npm publish` directly
   - `jsr.ts`: Executes `deno publish` directly

3. **No detection logic** for:
   - Available package managers in PATH
   - Workspace context (pnpm-workspace.yaml, npm workspaces)
   - `packageManager` field in package.json
   - Lock files (package-lock.json, pnpm-lock.yaml, yarn.lock)
   - Command availability before execution

### Problems with Current Approach

1. **Assumes command availability**: Hardcodes `npm` and `deno` without checking if they exist
2. **No workspace awareness**: Doesn't consider that a pnpm workspace should likely use `pnpm` for all packages
3. **No flexibility**: Can't use alternative tools (pnpm, yarn, corepack) for npm packages
4. **No override mechanism**: Can't specify a different package manager to use

## Requirements

1. **Separate detection from execution**: Split package manager determination from command execution
2. **Command availability checking**: Use zx's `which()` to verify commands exist before using them
3. **Workspace-aware detection**: Consider workspace files and context when determining which manager to use
4. **Prioritization logic**: Sort detection by likelihood based on file presence and workspace context
5. **Override support**: Allow explicit overrides via options
6. **Support multiple npm-compatible managers**: npm, pnpm, yarn, corepack, even deno, using the package-manager-detector library's execute wrapper
7. **Support JSR publishing**: Use the package-manager-detector library's execute wrapper (deno might need to be a special case that just uses its native publish command)

## Design Overview

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Release Options (with optional overrides)              │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  Package Manager Detector                                │
│  - Analyzes package & workspace context                  │
│  - Checks command availability                           │
│  - Returns prioritized list of options                   │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  Package Manager Selector                                │
│  - Applies override if provided                         │
│  - Selects best available option                         │
│  - Returns command configuration                        │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  Command Executor                                        │
│  - Executes selected command with args                  │
│  - Handles dry-run, publish, etc.                       │
└─────────────────────────────────────────────────────────┘
```

### Key Components

1. **Detector Module** (`detector.ts`):
   - Unified detection function for both npm and JSR packages
   - Uses `package-manager-detector` library for lock file and `packageManager` field detection
   - Analyzes workspace context (workspace root vs package root) - applies to both npm and JSR
   - Checks command availability using zx's `which()`
   - Applies JSR-specific deno preference (when deno.json exists AND deno available)
   - Returns detection results with priorities and execution mode

2. **Selector Module** (`selector.ts`):
   - Applies user overrides
   - Selects best available option based on priority
   - Supports configurable command priority
   - Returns command configuration with execution mode (execute wrapper vs native)

3. **Executor Module** (`executor.ts`):
   - Unified execution function for both npm and JSR packages
   - Uses `package-manager-detector`'s execute wrapper for npm-compatible commands
   - Uses execute wrapper for deno when publishing npm packages
   - Uses native deno command when publishing JSR packages (only if execute wrapper not used)
   - Implements dry-run and publish logic (only difference is a flag)

4. **Options Extension** (`options.ts`):
   - Add `packageManager` override option
   - Add configurable command priority/exclusion

## Detection Strategy

### Package Type Detection

#### For npm-compatible packages (package.json)

**Priority 1: Explicit Override**

- User specifies `packageManager` in options
- Highest priority, no further detection needed

**Priority 2: Workspace Context**

- Check workspace root (where `PackageInfo.root` points)
- If `pnpm-workspace.yaml` exists at workspace root → prefer `pnpm`
- If `package.json` has `workspaces` field at workspace root → prefer workspace manager
- Workspace context takes precedence over package-level detection

**Priority 3: package-manager-detector Library**

- Use `package-manager-detector` to detect from package directory
- Handles lock files automatically: `pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`
- Handles `packageManager` field parsing automatically
- Traverses up directory tree from package location
- Note: Does not consider workspace membership, only file traversal

**Priority 4: Command Availability with Default Priority**

- Check which commands are available: `npm`, `pnpm`, `yarn`, `deno`
- Default priority order: `pnpm` > `yarn` > `npm` > `deno`
- Priority order is configurable via options
- Commands can be excluded via options
- Only consider available commands
- **Note**: `corepack` excluded by default (project being sunset), only used if explicitly specified

**Fallback:**

- If nothing detected, error with helpful message (strict mode by default)

#### For JSR packages (jsr.json)

**Detection follows same priority structure as npm packages**, with one additional consideration:

**Special Case for JSR: Deno Preference**

- After Priority 2 (workspace context) but before Priority 3 (package-manager-detector)
- Check if `deno.json` exists in package directory **AND** `deno` command is available
- If **both** conditions are true → prefer `deno` with native command (faster)
- This is only a preference, not exclusive - falls through if deno not available

**Note**: All npm-compatible package managers can publish to JSR via execute wrapper, same as npm packages.

### Detection Algorithm Pseudocode

```
function detectPackageManager(pkg: PackageInfo, options: ReleaseOptions):
  // Determine package type
  packageType = determinePackageType(pkg)
  isJsr = (packageType === 'jsr')

  // Priority 1: Override
  if (options.packageManager):
    command = checkAvailability(options.packageManager, options.excludedCommands)
    if (command):
      // For JSR packages, deno uses native command, others use execute wrapper
      // For npm packages, all use execute wrapper
      useExecuteWrapper = !(isJsr && options.packageManager === 'deno')
      return { command, available: true, useExecuteWrapper }
    else:
      if (options.strict !== false):
        throw error('Specified package manager not available: ' + options.packageManager)
      // Continue to next priority if not strict

  // Priority 2: Workspace context (at workspace root)
  workspaceContext = analyzeWorkspace(pkg.root)
  if (workspaceContext.preferredManager):
    command = checkAvailability(workspaceContext.preferredManager, options.excludedCommands)
    if (command):
      useExecuteWrapper = !(isJsr && command === 'deno')
      return { command, available: true, useExecuteWrapper }

  // Priority 2.5: JSR-specific deno preference (only if deno.json exists AND deno available)
  if (isJsr):
    if (exists(join(pkg.path, 'deno.json'))):
      deno = checkAvailability('deno', options.excludedCommands)
      if (deno):
        return { command: deno, available: true, useExecuteWrapper: false }

  // Priority 3: package-manager-detector (from package directory)
  detectedManager = packageManagerDetector.detect(pkg.path)
  if (detectedManager):
    command = checkAvailability(detectedManager, options.excludedCommands)
    if (command):
      useExecuteWrapper = !(isJsr && command === 'deno')
      return { command, available: true, useExecuteWrapper }

  // Priority 4: Command availability with default priority
  priority = options.commandPriority ?? ['pnpm', 'yarn', 'npm', 'deno']
  for (cmd in priority):
    if (cmd not in options.excludedCommands):
      available = checkAvailability(cmd)
      if (available):
        useExecuteWrapper = !(isJsr && cmd === 'deno')
        return { command: available, available: true, useExecuteWrapper }

  // Fallback: error
  if (options.strict !== false):
    errorMsg = isJsr
      ? 'No package manager available. Install deno or an npm-compatible manager (npm, pnpm, yarn).'
      : 'No package manager available. Install one of: npm, pnpm, yarn, or deno.'
    throw error(errorMsg)
  throw error('No package manager available')
```

## File Structure

```
packages/release/src/
├── index.ts              # Main exports (refactored)
├── options.ts            # Options with new fields
├── detector.ts           # NEW: Package manager detection using package-manager-detector
├── selector.ts           # NEW: Command selection logic with prioritization
├── executor.ts           # NEW: Generic command execution using execute wrapper
└── logger.ts
```

**Note**: `npm.ts` and `jsr.ts` will be removed as they're not released yet.

## Options Extension

```typescript
export interface ReleaseOptions {
	dryRun?: boolean | 'auto';

	// NEW: Package manager overrides
	packageManager?: string; // Override for any package type (e.g., 'deno', 'pnpm', 'yarn')

	// NEW: Command priority configuration
	commandPriority?: string[]; // Custom priority order (e.g., ['yarn', 'npm', 'pnpm'])
	excludedCommands?: string[]; // Commands to exclude from detection (e.g., ['corepack'])

	// NEW: Error handling
	strict?: boolean; // Default: true - error on conflicts vs auto-resolve
}
```

**Default Command Priority**: `['pnpm', 'yarn', 'npm', 'deno']`

**Default Excluded Commands**: `['corepack']` (unless explicitly specified)

## Implementation Decisions (RESOLVED)

### 1. Workspace Context Detection ✅

**Decision**: Check workspace root (from `PackageInfo.root`) first, then package directory. Workspace context takes priority as it indicates the intended manager for all packages in the workspace.

**Implementation**: Use `PackageInfo.root` to check for workspace files (`pnpm-workspace.yaml`, workspace-enabled `package.json`), then fall back to package-level detection via `package-manager-detector`.

### 2. packageManager Field Parsing ✅

**Decision**: Use `package-manager-detector` library which handles `packageManager` field parsing automatically. No manual parsing needed.

**Implementation**: Leverage `package-manager-detector`'s built-in detection which traverses up the directory tree from package location.

### 3. Command Availability Priority ✅

**Decision**: Default priority order: `pnpm` > `yarn` > `npm` > `deno`. Priority is configurable via options, and commands can be excluded.

**Default Priority**: `['pnpm', 'yarn', 'npm', 'deno']`

### 4. Error Handling ✅

**Decision**: **Strict mode is default** - error on conflicts or missing managers with helpful messages. Auto-resolve mode available via `strict: false`.

**Implementation**: By default, strict mode errors on:

- No package manager detected
- Specified override not available
- Conflicting signals (with clear error messages)

### 5. Corepack Integration ✅

**Decision**: **Exclude corepack by default** (project being sunset). Only include if explicitly specified in options.

**Implementation**: Corepack excluded from default command priority list. Can be added via `commandPriority` option if needed.

### 6. Backward Compatibility ✅

**Decision**: **No backward compatibility needed** - code is not released yet. Remove `npm.ts` and `jsr.ts` files directly.

**Implementation**: Delete existing files and implement new architecture from scratch.

### 7. Testing Strategy ✅

**Decision**:

- Mock `which()` calls in tests (using vitest mocks)
- Create test fixtures with different workspace configurations
- Test each priority level independently
- Integration tests for dry-run only using pnpm, since that can be assumed to be present in this project

**Implementation**: Create test fixtures in `test/fixtures/` with various workspace setups, mock zx's `which()` function.

## Implementation Plan

### Phase 1: Detection Infrastructure

1. Add `package-manager-detector` dependency to release package
2. Create `detector.ts`:
   - Integrate `package-manager-detector` library
   - Create workspace context analyzer (checks workspace root)
   - Implement command availability checking using zx's `which()`
   - Combine workspace context with package-manager-detector results

### Phase 2: Selection Logic

1. Create `selector.ts`:
   - Implement prioritization with configurable order
   - Add override handling
   - Add command exclusion logic
   - Implement strict mode error handling

### Phase 3: Execution Refactoring

1. Create `executor.ts`:
   - Use `package-manager-detector`'s execute wrapper for npm-compatible commands, and when using deno to release to npm
   - Handle deno natively for JSR packages (direct command execution)
   - Implement dry-run and publish logic (since the only difference is a flag, we can )
2. Update `index.ts` to use new detection/selection/execution
3. Remove `npm.ts` and `jsr.ts` files

### Phase 4: Options & Integration

1. Extend `options.ts` with new fields:
   - `packageManager` override
   - `commandPriority` configuration
   - `excludedCommands` configuration
   - `strict` mode (default: true)
2. Update CLI to pass options through
3. Add comprehensive tests with mocked `which()` calls

### Phase 5: Testing & Documentation

1. Create test fixtures with various workspace configurations
2. Mock `which()` calls in all tests
3. Test each priority level independently
4. Update documentation

## Example Usage

```typescript
// Automatic detection
await publish(pkg, { dryRun: 'auto', isCI: false });
// → Detects pnpm-workspace.yaml, uses pnpm if available

// Override package manager
await publish(pkg, {
	packageManager: 'yarn',
	dryRun: 'auto',
	isCI: false
});
// → Uses yarn instead of auto-detected manager

// Custom command priority
await publish(pkg, {
	commandPriority: ['yarn', 'npm'],
	excludedCommands: ['pnpm'],
	dryRun: 'auto',
	isCI: false
});
// → Prefers yarn, then npm, excludes pnpm

// JSR with npm-compatible manager (via execute wrapper)
await publish(jsrPkg, {
	packageManager: 'pnpm',
	dryRun: 'auto',
	isCI: false
});
// → Uses pnpm execute wrapper for JSR publishing
```

## Key Implementation Notes

### package-manager-detector Integration

- Use `package-manager-detector` for lock file detection and `packageManager` field parsing
- Library traverses up directory tree from package location (doesn't consider workspace membership)
- We combine this with workspace context analysis for complete detection

### Workspace Context

- Check workspace root first (from `PackageInfo.root`)
- Workspace files like `pnpm-workspace.yaml` indicate all packages should use that manager
- Fall back to package-manager-detector for package-level detection

### Execute Wrapper

- Use `package-manager-detector`'s execute wrapper for npm-compatible package managers
- Allows publishing JSR packages via npm, pnpm, yarn, etc.
- Deno uses native command when available (faster)

### Testing Strategy

- Mock zx's `which()` function in all tests
- Create test fixtures with:
  - Different workspace configurations (pnpm, npm, yarn)
  - Various lock file scenarios
  - packageManager field variations
  - Missing command scenarios
- Test each priority level in isolation

## Next Steps

1. ✅ All decisions resolved
2. **Ready for implementation** following phased approach
3. Start with Phase 1: Detection Infrastructure
