#!/usr/bin/env node

import { program } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));

// Commands
import { initCommand } from '../src/commands/init.js';
import { validateCommand } from '../src/commands/validate.js';
import { checkCommand } from '../src/commands/check.js';
import { generateCommand } from '../src/commands/generate.js';
import { doctorCommand } from '../src/commands/doctor.js';
import { analyzeCommand } from '../src/commands/analyze.js';
import { syncCommand } from '../src/commands/sync.js';
import { statusCommand } from '../src/commands/status.js';

program
    .name('seomd')
    .description('Open-standard SEO.md CLI — AEO infrastructure for technical founders & coding agents (seomd.dev)')
    .version(pkg.version);

program
    .command('init')
    .description('Scaffold SEO.md (v2.0.0), .seo/ workspace, and AGENTS.md/CLAUDE.md wiring')
    .option('-y, --yes', 'skip prompts and use smart defaults')
    .option('-f, --force', 'overwrite existing SEO.md without prompting')
    .option('--type <type>', 'site type: saas, ecommerce, local, blog, marketplace')
    .option('--brand <brand>', 'brand name')
    .option('--domain <domain>', 'primary domain')
    .option('--primary-keyword <keyword>', 'primary keyword')
    .option('--competitors <list>', 'comma-separated competitor list')
    .option('--provider <name>', 'optional provider: foxcite, semrush, ahrefs, profound, peec, custom')
    .option('--no-wire-agents', 'skip wiring SEO.md instructions into AGENTS.md / CLAUDE.md')
    .option('--output <dir>', 'scaffold into a new directory instead of cwd')
    .addHelpText('after', `

Examples:
  seomd init                                        # interactive flow with repo route detection
  seomd init -y --type saas                         # skip prompts, auto-detect routes + wire AGENTS.md
  seomd init --brand "Acme" --domain acme.com --primary-keyword "billing automation"
  seomd init --type local --no-wire-agents --output ./new-project
`)
    .action(initCommand);

program
    .command('validate')
    .description('Validate SEO.md against spec v2.0.0 (or legacy v1.0)')
    .option('--strict', 'treat warnings as errors (useful in CI)')
    .option('--json', 'output machine-readable JSON')
    .addHelpText('after', `

Examples:
  seomd validate
  seomd validate --strict --json
`)
    .action(validateCommand);

program
    .command('check [target]')
    .description('Audit local HTML/build output or a URL against SEO.md (offline, zero API key)')
    .option('--strict', 'treat warnings as errors')
    .option('--json', 'output machine-readable JSON')
    .addHelpText('after', `

Examples:
  seomd check ./out                                 # audit static build output
  seomd check http://localhost:3000                 # audit running dev server
  seomd check ./public --json                       # machine-readable check for CI / agents
`)
    .action(checkCommand);

program
    .command('generate <target>')
    .description('Generate robots.txt, llms.txt, or JSON-LD schema from SEO.md (offline)')
    .option('--out <file>', 'write output to file instead of stdout')
    .addHelpText('after', `

Targets:
  robots    AI-crawler-friendly robots.txt
  llms      llms.txt directory for AI agents
  schema    JSON-LD starter graph

Examples:
  seomd generate robots --out public/robots.txt
  seomd generate llms --out public/llms.txt
  seomd generate schema
`)
    .action(generateCommand);

program
    .command('doctor')
    .description('Check SEO.md validity, agent wiring, crawl files, and provider readiness')
    .option('--json', 'output as JSON')
    .action(doctorCommand);

program
    .command('analyze')
    .description('Run live AI citation analysis via your configured provider and update .seo/')
    .option('--page <url>', 'analyze a specific page only (merges into .seo/)')
    .option('--intent <category>', 'analyze a specific intent category only')
    .option('--engines <list>', 'comma-separated list of engines to scan (e.g. ChatGPT,Claude)')
    .addHelpText('after', `

Examples:
  seomd analyze                                     # full audit
  seomd analyze --page /pricing                     # single page audit (merge-safe)
  seomd analyze --intent transactional --engines ChatGPT,Claude
`)
    .action(analyzeCommand);

program
    .command('sync')
    .description('Pull latest cached intelligence from your configured provider into .seo/')
    .option('--dry-run', 'preview metric deltas without modifying files')
    .addHelpText('after', `

Examples:
  seomd sync
  seomd sync --dry-run
`)
    .action(syncCommand);

program
    .command('status')
    .description('Show current citation rates and gap scores from .seo/STATUS.yml')
    .option('--json', 'output as JSON')
    .addHelpText('after', `

Examples:
  seomd status
  seomd status --json
`)
    .action(statusCommand);

program.parse();
