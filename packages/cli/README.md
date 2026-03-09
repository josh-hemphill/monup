# @monup/cli

CLI entry point for the Monup workflow.

## Workflow Role

`@monup/cli` is the operator-facing package that ties the workflow together:

```text
version -> changelog -> release -> github
```

The common flow is to run `version` and `changelog` locally, then let CI run `release` and `github`.

## Commands

  - `version`: update package versions from commits.
  - `changelog`: generate changelog entries from commits.
  - `release`: publish packages to npm or JSR.
  - `github`: create GitHub releases.
  - `all`: run the full workflow in order.

## Important Flags

  - `--log-level <level>`: set the default log level.
  - `--ci`: force CI mode.
  - `--set <path=value>`: override config values from the command line.
  - `version --major|--minor|--patch`: force a bump type.
  - `release --dry-run`: validate publish steps without publishing.

## Example

```bash
monup version
monup changelog
monup release --dry-run --log-level debug
```

## Related Packages

  - [`@monup/options`](../options/README.md): config loading and `defineConfig()`.
  - [`@monup/release`](../release/README.md): package publishing.
  - [`@monup/github`](../github/README.md): GitHub release creation.
