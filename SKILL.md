# SEO.md CLI Skill

**What this does:** Scaffolds, validates, and audits `SEO.md` (spec v2.0.0) — the `AGENTS.md` / `CLAUDE.md` / `DESIGN.md` equivalent for search and AI-citation strategy — and wires coding-agent instructions directly into `AGENTS.md` / `CLAUDE.md`.

## Workflow for Coding Agents

1. **Initialize in a repo** (auto-detects routes and wires `AGENTS.md` / `CLAUDE.md`):
   ```bash
   npx seomd-cli init
   # or non-interactively:
   npx seomd-cli init -y --type saas --brand "Acme" --domain acme.com --primary-keyword "billing automation"
   ```
2. **Read `SEO.md` before creating or editing public pages** — follow the Canonical Product Facts, Page & AEO Rules, Target Buyer Prompts, and Do Not Claim sections.
3. **Check page playbooks** in `.seo/pages/<page-id>.md` and `.seo/REVERSE.md` (when populated by a provider) to fix citation gaps.
4. **Verify locally (zero API key required):**
   ```bash
   npx seomd-cli validate --strict
   npx seomd-cli check ./out                  # or http://localhost:3000
   npx seomd-cli generate robots --out public/robots.txt
   npx seomd-cli generate llms --out public/llms.txt
   npx seomd-cli doctor
   ```
5. **Run live AI citation scans (optional, any compatible provider):**
   ```bash
   npx seomd-cli analyze                      # full audit -> updates .seo/
   npx seomd-cli analyze --page /pricing      # single page (merge-safe)
   npx seomd-cli sync --dry-run               # preview cached deltas
   npx seomd-cli status --json                # machine-readable metrics
   ```

## `init` Flags

| Flag | Description |
|------|-------------|
| `-y, --yes` | skip prompts, use inferred defaults |
| `-f, --force` | overwrite existing `SEO.md` without prompting |
| `--type <type>` | `saas`, `ecommerce`, `local`, `blog`, `marketplace` |
| `--brand <name>` | brand name |
| `--domain <domain>` | primary domain |
| `--primary-keyword <keyword>` | primary keyword |
| `--competitors <list>` | comma-separated competitor domains |
| `--provider <name>` | optional provider (`foxcite`, `semrush`, `ahrefs`, `profound`, `peec`, `custom`) |
| `--no-wire-agents` | skip wiring `AGENTS.md` / `CLAUDE.md` |
| `--output <dir>` | scaffold into a new (empty) directory |
