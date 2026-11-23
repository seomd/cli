# SEO.md CLI

<p align="left" style="padding: 40px 0;">
  <img alt="SEO.md CLI logo" src="./assets/logo.svg" />
</p>

The official CLI for the [SEO.md](https://seomd.dev) open standard (spec **v2.0.0**) — the `AGENTS.md` / `CLAUDE.md` / `DESIGN.md` equivalent for search and AI Engine Optimization (AEO).

Use it to scaffold a Markdown + YAML frontmatter `SEO.md`, wire coding agents automatically via `AGENTS.md` / `CLAUDE.md`, audit local pages offline, generate `robots.txt` / `llms.txt` / JSON-LD, and optionally connect any compatible AI citation intelligence provider.

---

## Why SEO.md?

Coding agents are great at shipping pages fast, but terrible at SEO/AEO without ground truth. `SEO.md` gives both humans and coding agents one repo-native source of truth:

- **Markdown-first (`---` frontmatter + prose):** Agents read Canonical Product Facts, Page & AEO Rules, Target Buyer Prompts, and Do Not Claim guardrails directly — while the CLI parses the structured frontmatter safely.
- **Zero-friction agent discovery:** `seomd init` automatically wires a concise pointer block into `AGENTS.md` / `CLAUDE.md` so coding agents pick up `SEO.md` on day one.
- **Useful offline with zero API keys:** `validate`, `check`, `generate`, and `doctor` all work locally.
- **Vendor-agnostic provider protocol:** Connect **Foxcite** (native reference implementation) or any provider/bridge implementing [`PROVIDER_SPEC.md`](./PROVIDER_SPEC.md) (SEMrush, Ahrefs, Profound, Peec AI, or custom).

---

## Install

```bash
npm install -g seomd-cli
```

Or run zero-install:

```bash
npx seomd-cli init
```

---

## Quick Start

### 1) Initialize (Repo-Aware + Agent Wiring)

```bash
npx seomd-cli init
```

`init` inspects your repo (Next.js, Astro, SvelteKit, etc.) to discover live routes, generates `SEO.md` (v2.0.0) and `.seo/`, and wires `AGENTS.md` / `CLAUDE.md` so coding agents read `SEO.md` automatically.

Non-interactive mode:

```bash
npx seomd-cli init -y --type saas --brand "Acme" --domain acme.com --primary-keyword "billing automation"
```

### 2) Validate & Audit Locally (Zero API Key)

```bash
npx seomd-cli validate --strict
npx seomd-cli check ./out                 # audit static HTML output
npx seomd-cli check http://localhost:3000 # audit running dev server
npx seomd-cli doctor                      # check SEO.md, agent wiring, crawl files, provider
```

### Catch invented prices and claims

List the facts your pages may state in the `claims` block of `SEO.md`:

```yaml
claims:
  prices: ["$0", "$99", "$0.08"]   # the only prices any page may show (text and JSON-LD offers)
  forbidden:                        # phrases no page may assert
    - SOC 2 certified
    - real-time
    - unlimited
    - free trial
```

`seomd check` then fails a page that shows any other price or asserts a forbidden phrase, quoting the sentence. A forbidden phrase is fine in a question ("Is there a free trial?") or after a negation ("There is no free trial"). A price worked out from listed ones ("$99 + 500 × $0.08 = $139") is a warning to check the math. Unfinished copy (TBD, TODO, lorem ipsum) fails on every page, with or without `claims`.

### 3) Generate Crawl & AI Discovery Artifacts

```bash
npx seomd-cli generate robots --out public/robots.txt
npx seomd-cli generate llms --out public/llms.txt
npx seomd-cli generate schema
```

### 4) Connect a Live Intelligence Provider (Optional)

Live citation scans (`analyze` / `sync`) write results into `.seo/STATUS.yml`, `.seo/REVERSE.md`, and `.seo/pages/*.md` (merge-safe on partial `--page` runs):

```bash
# Example using Foxcite (native reference implementation)
export SEOMD_PROVIDER=foxcite
export SEOMD_API_KEY="your_api_key_here"

npx seomd-cli analyze
npx seomd-cli analyze --page /pricing --intent transactional
npx seomd-cli sync --dry-run
npx seomd-cli status --json
```

See [`PROVIDER_SPEC.md`](./PROVIDER_SPEC.md) to connect custom endpoints or third-party platforms (`semrush`, `ahrefs`, `profound`, `peec`, `custom`).

---

## Commands

| Command | Offline? | Description |
|---|---|---|
| `seomd init` | Yes | Repo-aware scaffold for `SEO.md` (v2.0.0), `.seo/`, and `AGENTS.md` / `CLAUDE.md` wiring |
| `seomd validate` | Yes | Validate `SEO.md` (supports v2 frontmatter + legacy v1 YAML); `--strict`, `--json` |
| `seomd check [target]` | Yes | Audit local HTML/build dir or URL against `SEO.md`: prices and forbidden claims (`claims`), placeholder text, title, meta, H1, canonical, JSON-LD, AI bots, negative terms |
| `seomd generate <target>` | Yes | Generate `robots`, `llms`, or `schema` from `SEO.md` |
| `seomd doctor` | Yes | Inspect `SEO.md`, agent wiring, crawl files, and provider readiness |
| `seomd analyze` | Provider | Run live AI citation audit (`--page`, `--intent`, `--engines`) and merge into `.seo/` |
| `seomd sync` | Provider | Pull cached provider intelligence (`--dry-run` shows deltas) |
| `seomd status` | Yes | Display citation rates and gap scores from `.seo/STATUS.yml` (`--json`) |

---

## Development & Testing

```bash
npm run lint
npm test
node ./bin/seomd.js --help
```

## License

MIT License.
