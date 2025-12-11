# @monup/cli

Command-line interface for the monup toolchain.

## Purpose

Provides the main CLI entry point with commands: `version`, `changelog`, `release`, `github`, and `all`. Handles option resolution, log level configuration, and orchestrates the workflow.

## Use Case

Use as the primary interface for running monup operations. Accepts CLI arguments, resolves configuration from files and environment, and delegates to appropriate package handlers.

## Example

```bash
# Update versions based on commits
monup version

# Generate changelog
monup changelog

# Run complete workflow
monup all
```
