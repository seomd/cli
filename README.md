# SEO.md CLI

<p align="left" style="padding: 20px 0;">
  <img alt="SEO.md CLI logo" src="./assets/logo.svg" />
</p>

The official CLI for the [SEO.md](https://seomd.dev) open standard — AEO (AI Engine Optimization) infrastructure for technical founders.

Use it to scaffold, validate, analyze, and sync `SEO.md` files directly from your repo.

## Table of Contents

- [Why SEO.md](#why-seomd)
- [Install](#install)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Commands](#commands)
- [Local Development](#local-development)
- [Testing](#testing)
- [Release Notes (Contributor Tagging)](#release-notes-contributor-tagging)
- [Security](#security)
- [Specification Reference](#specification-reference)
- [License](#license)

## Why SEO.md

SEO.md is a structured, version-controlled specification for describing your site, intent queries, and pages so AI engines can cite you more often.

- Declare what matters (site, identity, keywords, intent, pages)
- Run audits via your connected platform
- Write back `_analysis` blocks and per-page playbooks into your repo

## Install

```bash
npm install -g seomd-cli
```

Verify:

```bash
seomd --help
```

## Quick Start

### 1) Initialize

Run in the root of your project:

```bash
seomd init
```

### 2) Validate

```bash
seomd validate
```

### 3) Run an Audit (Analyze) and Sync

```bash
seomd analyze
seomd sync
```

### 4) View Status

```bash
seomd status
seomd status --json
```

## Configuration

Copy the example env file:

```bash
cp .env.example .env
```

Environment variables:

- `SEOMD_API_URL` (optional) API base URL (defaults to `https://api.foxcite.com`)
- `SEOMD_API_KEY` (optional) platform API key (human dashboard auth)
- `SEOMD_PAYMENT_TOKEN` (optional) agent-native payment token (x402 pay-per-scan)
- `SEOMD_DOMAIN` (optional) override domain header

## Commands

### `seomd init`

Scaffolds `SEO.md`, `SEO.REVERSE.md`, and the `.seomd/` intelligence directory.

### `seomd validate`

Validates your `SEO.md` against the spec requirements.

### `seomd status`

Shows current citation rates and gap scores from `_analysis`.

- `--json` outputs machine-readable JSON for scripts/CI

### `seomd analyze`

Runs an AI search audit via your connected platform and writes results back into:

- `SEO.md` (`_analysis` blocks)
- `SEO.REVERSE.md` (generated reverse view)
- `.seomd/pages/*.md` (per-page playbooks when available)

### `seomd sync`

Pulls cached/latest platform intelligence and writes it back to the same files as `analyze`.

- `--dry-run` prints a preview and does not modify files

## Local Development

Prefer the local entrypoint while developing:

```bash
node ./bin/seomd.js --help
node ./bin/seomd.js init
node ./bin/seomd.js validate
node ./bin/seomd.js status --json
```

## Testing

```bash
npm test
```

## Release Notes (Contributor Tagging)

To generate a contributor section for a release (commit-based attribution), maintain mappings in `.github/contributors.yml` and generate markdown from a tag range:

```bash
npm run release:contributors -- --from v1.0.2 --to v1.0.3
```

To write output to a file:

```bash
npm run release:contributors -- --from v1.0.2 --to v1.0.3 --out notes/v1.0.3-contributors.md
```

To generate a full release note (changes + contributors) for a tag:

```bash
npm run release:notes -- --tag v1.0.3
```

Automation: the repository includes a GitHub Actions workflow that runs on tag push (`v*`) and creates/updates the GitHub Release using `scripts/release-notes.js`.

## Platform Connections & API Keys

To enable live intelligence writebacks (using automated platforms like [Foxcite](https://foxcite.com)):

1. Obtain a developer API key from your platform provider.
2. Export the key as an environment variable:
   ```bash
   export SEOMD_API_KEY="your_api_key_here"
   ```
3. Run `seomd sync` or `seomd analyze`.

_Note: Never commit your API keys or `.env` files containing keys to version control._

## Security

- Never commit `.env` files or API keys
- Use `.env.example` as the template for required variables

## Specification Reference

Read the complete specification and guidelines at [seomd.dev/spec](https://seomd.dev/spec).

## License

MIT License. Developed and maintained by the community.
