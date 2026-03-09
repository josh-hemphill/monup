# Monup

Monup is a monorepo release workflow for versioning packages from commits, generating changelogs, publishing packages, and creating GitHub releases.

It is designed around a simple flow: run `version` and `changelog` locally for review, then let CI handle `release` and `github` release.

## What It Does

  - Calculates semantic version bumps from conventional commits.
  - Updates package versions across workspace manifests.
  - Generates changelogs from git history.
  - Publishes packages to npm or JSR.
  - Creates GitHub releases from changelog entries.
  - Detects workspace packages in monorepos and can also work in a single-package repo.

## Typical Workflow

```text
version -> changelog -> release -> github
```

In practice:

  - Run `version` locally to update package versions.
  - Run `changelog` locally to update changelog files.
  - Push your changes and tags.
  - Let CI run `release` to publish packages.
  - Let CI run `github` to create GitHub releases.

## Quick Start

Create a `monup.config.ts` file:

```ts
import { defineConfig } from '@monup/options';
// These are already defaults, but listed as example
export default defineConfig({
  git: {
    tagStrategy: 'package',
    commit: true,
    push: true,
    tag: true,
  },
  changelog: {
    strategy: 'per-package',
    location: 'CHANGELOG.md',
    commitLinks: true,
    issueLinks: true,
    contributors: true,
  },
  release: {
    dryRun: 'auto',
  },
  github: {
    changelogMethod: 'auto',
  },
});
```

From this repository, the main local commands are:

```bash
pnpm exec monup version
pnpm exec monup changelog
```

Useful command variants:

```bash
pnpm exec monup version --minor
pnpm exec monup release --dry-run --log-level debug
pnpm exec monup github --log-level debug
pnpm exec monup all
```

## CLI Commands

  - `version`: update package versions based on commits.
  - `changelog`: generate changelog entries from commits.
  - `release`: publish packages to npm or JSR.
  - `github`: create GitHub releases.
  - `all`: run the full workflow in order.

Global options:

  - `--log-level <level>` to set logging.
  - `--ci` to force CI mode.
  - `--set <path=value>` to override config values from the command line.

## CI Release Flow

The repository release workflow lives in [`.github/workflows/release.yml`](.github/workflows/release.yml).

  - It runs on tag pushes matching `v*` or `*@*`, and can also be started manually.
  - A dry-run job runs first to build packages and validate the release flow.
  - The real release job runs only after the dry run succeeds.
  - The release job publishes packages with `release`.
  - The final step creates GitHub releases with `github`.

Current authentication is token-based:

  - `NPM_TOKEN` is used for publishing.
  - `GITHUB_TOKEN` is used for GitHub release creation.
  - OIDC is prepared in the workflow comments, but not the default path yet.

## GitHub Action

The composite action in [`action.yml`](action.yml) wraps the CLI and can run:

  - `version`
  - `changelog`
  - `release`
  - `github`
  - `all`

Important inputs:

  - `command`
  - `dry-run`
  - `working-directory`
  - `auth-mode`
  - `npm-token`

Example:

```yaml
- uses: ./
  with:
    command: release
    dry-run: true
    working-directory: .
    auth-mode: token
    npm-token: ${{ secrets.NPM_TOKEN }}
```

## Packages

  - [`packages/cli`](packages/cli/README.md): CLI entry point and command orchestration.
  - [`packages/version`](packages/version/README.md): semantic version calculation and manifest updates.
  - [`packages/changelog`](packages/changelog/README.md): changelog generation from conventional commits.
  - [`packages/release`](packages/release/README.md): publishing to npm and JSR.
  - [`packages/github`](packages/github/README.md): GitHub release creation.
  - [`packages/options`](packages/options/README.md): config loading, merging, and normalization.
  - [`packages/workspace`](packages/workspace/README.md): workspace and package detection.
  - [`packages/git`](packages/git/README.md): git operations and conventional commit parsing.

## Development

This repo uses `pnpm`.

```bash
pnpm install
pnpm run build
pnpm run lint
pnpm run test
```

The root scripts are intended for maintainers working on the Monup toolchain itself.
