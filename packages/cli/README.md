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
- `jsr-prepare`: prepare JSR package entries and settings for tokenless CI publishing.
- `release`: publish packages to npm or JSR.
- `github`: create GitHub releases.
- `all`: run the full workflow in order.

## Important Flags

- `--log-level <level>`: set the default log level.
- `--ci`: force CI mode.
- `--set <path=value>`: override config values from the command line.
- `jsr-prepare --github-owner/--github-name`: set the shared GitHub repo for JSR packages.
- `jsr-prepare --readme-source`: set a shared `readme` or `jsdoc` source.
- `jsr-prepare --runtime-*`: set shared runtime compatibility values using `supported|unsupported|unknown`.
- `jsr-prepare --infer-descriptions`: infer per-package descriptions from `package.json` or `README.md`.
- `version --major|--minor|--patch`: force a bump type.
- `release --dry-run`: validate publish steps without publishing.

## Example

```bash
monup version
monup changelog
monup release --dry-run --log-level debug
```

`jsr-prepare` is local-only and is meant to prepare packages before CI uses JSR's GitHub repository-linked OIDC publishing flow. In interactive terminals it now defaults to JSR's browser-based authorization flow, opens the verification URL for you, shows the fallback code in the terminal, and keeps the returned device token only for the current run. In non-interactive mode it falls back to `JSR_TOKEN`.

Non-interactive example:

```bash
JSR_TOKEN=your_token_here monup jsr-prepare
```

## Related Packages

- [`@monup/options`](../options/README.md): config loading and `defineConfig()`.
- [`@monup/release`](../release/README.md): package publishing.
- [`@monup/github`](../github/README.md): GitHub release creation.
