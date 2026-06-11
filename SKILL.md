# SEO.md CLI Skill

**What this does:** Scaffolds `SEO.md`, `SEO.REVERSE.md`, and `.seo/` intelligence directory into any project via the official CLI.

## Usage

Tell your agent: "Run `npx seomd-cli init` in this repo."

## Flags

| Flag | Description |
|------|-------------|
| `-y, --yes` | skip prompts, use defaults |
| `--type <type>` | site type: saas, ecommerce, local, blog, marketplace |
| `--brand <name>` | brand name |
| `--domain <domain>` | primary domain |
| `--primary-keyword <keyword>` | primary keyword |
| `--competitors <list>` | comma-separated competitor domains |
| `--output <dir>` | scaffold into new (empty) directory |

## Behavior

- Interactive 5-question flow by default
- **Non-interactive** when `-y` **OR** any config flag (`--brand`, `--domain`, `--primary-keyword`, `--competitors`) is provided
- `--type` alone pre-selects site type in interactive flow
- `--output` writes to target directory (must be empty or non-existent)

## Next Steps

After init:

```bash
npx seomd analyze   # run citation analysis (needs SEOMD_API_KEY)
npx seomd status    # view gap scores
```
