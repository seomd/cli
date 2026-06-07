# seomd-cli

The official command-line interface for the **SEO.md** open standard — AEO (AI Engine Optimization) infrastructure for technical founders.

Use the CLI to scaffold, validate, analyze, and synchronize `SEO.md` configuration files directly from your workspace.

---

## Installation

Install the CLI globally using `npm`:

```bash
npm install -g seomd-cli
```

---

## Quick Start

### 1. Initialize a Specification
Run the interactive setup in the root of your project to generate a tailored `SEO.md` file:

```bash
seomd init
```
The CLI will ask you five quick questions (e.g., brand name, domain, site type, primary keyword, and competitors) and scaffold the format matching your site type (SaaS, Blog, eCommerce, Marketplace, or Local).

### 2. Validate the File
Verify that your local file complies with the official open specification rules:

```bash
seomd validate
```

### 3. Check Local Status
Check validation state and connection parameters:

```bash
seomd status
```

---

## Command Reference

### `seomd init`
Scaffolds a new `SEO.md` file in the current working directory.

### `seomd migrate`
Migrates an existing `.seomd/` directory to the latest structure (creates missing files and moves legacy `.seomd/pages/*.md` into `.seomd/pages/md/*.md`).

### `seomd validate`
Validates the structural integrity and required fields of your `SEO.md` file.

### `seomd status`
Displays local validation results, connected platforms, and project identification.

### `seomd analyze`
Analyzes your local specification and requests search visibility summaries from your connected platform.

### `seomd sync`
Synchronizes live engine analysis blocks, keyword gap scores, and cited sources from your connected writeback platform.

---

## Local Development

When testing changes to the CLI from this repository, prefer running the local entrypoint to avoid accidentally using an older globally installed version.

```bash
node ./bin/seomd.js --help
node ./bin/seomd.js init
node ./bin/seomd.js migrate
```

---

## Platform Connections & API Keys

To enable live citation writebacks (using automated platforms like [Foxcite](https://foxcite.com)):

1. Obtain a developer API key from your platform provider.
2. Export the key as an environment variable:
   ```bash
   export SEOMD_API_KEY="your_api_key_here"
   ```
3. Run `seomd sync` or `seomd analyze`.

*Note: Never commit your API keys or `.env` files containing keys to version control.*

---

## Specification Reference

Read the complete specification and guidelines at [seomd.dev/spec](https://seomd.dev/spec).

## License

MIT License. Developed and maintained by the community.
