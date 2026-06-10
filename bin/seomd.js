#!/usr/bin/env node

import { program } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));

// Commands
import { initCommand } from '../src/commands/init.js';
import { analyzeCommand } from '../src/commands/analyze.js';
import { syncCommand } from '../src/commands/sync.js';
import { statusCommand } from '../src/commands/status.js';
import { validateCommand } from '../src/commands/validate.js';

program
    .name('seomd')
    .description('AEO infrastructure for technical founders — seomd.dev')
    .version(pkg.version);

program
    .command('init')
    .description('Scaffold SEO.md for your project')
    .option('-y, --yes', 'skip prompts and use defaults')
    .option('--type <type>', 'site type: saas, ecommerce, local, blog, marketplace')
    .option('--brand <brand>', 'brand name')
    .option('--domain <domain>', 'primary domain')
    .option('--primary-keyword <keyword>', 'primary keyword')
    .option('--competitors <list>', 'comma-separated competitor list')
    .option('--output <dir>', 'scaffold into a new directory instead of cwd')
    .addHelpText('after', `

Examples:
  seomd init                              # interactive 5-question flow
  seomd init -y --type local              # skip prompts, use defaults
  seomd init --brand "Acme" --domain acme.com --primary-keyword "local seo"
  seomd init --type saas --brand "MyApp" --domain myapp.com --output ./new-project
`)
    .action(initCommand);

program
    .command('analyze')
    .description('Run citation analysis and write back _analysis blocks')
    .option('--page <url>', 'analyze a specific page only')
    .option('--intent <category>', 'analyze a specific intent category only')
    .option('--engines <list>', 'comma-separated list of engines to scan (e.g. chatgpt,claude)')
    .addHelpText('after', `

Examples:
  seomd analyze                           # full audit
  seomd analyze --page /pricing           # single page audit
  seomd analyze --intent transactional --engines chatgpt,claude
`)
    .action(analyzeCommand);

program
    .command('sync')
    .description('Sync latest platform intelligence to your SEO.md files')
    .option('--dry-run', 'preview changes without writing')
    .addHelpText('after', `

Examples:
  seomd sync                              # sync latest data
  seomd sync --dry-run                    # preview changes only
`)
    .action(syncCommand);

program
    .command('status')
    .description('Show current citation rates and gap scores')
    .option('--json', 'output as JSON')
    .addHelpText('after', `

Examples:
  seomd status                            # human-readable summary
  seomd status --json                     # machine-readable JSON
`)
    .action(statusCommand);

program
    .command('validate')
    .description('Validate your SEO.md against the spec')
    .addHelpText('after', `

Example:
  seomd validate
`)
    .action(validateCommand);

program.parse();
