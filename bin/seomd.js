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
    .action(initCommand);

program
    .command('analyze')
    .description('Run citation analysis and write back _analysis blocks')
    .option('--page <url>', 'analyze a specific page only')
    .option('--intent <category>', 'analyze a specific intent category only')
    .option('--engines <list>', 'comma-separated list of engines to scan (e.g. chatgpt,claude)')
    .action(analyzeCommand);

program
    .command('sync')
    .description('Sync latest platform intelligence to your SEO.md files')
    .option('--dry-run', 'preview changes without writing')
    .action(syncCommand);

program
    .command('status')
    .description('Show current citation rates and gap scores')
    .option('--json', 'output as JSON')
    .action(statusCommand);

program
    .command('validate')
    .description('Validate your SEO.md against the spec')
    .action(validateCommand);

program.parse();
