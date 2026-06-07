import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs-extra';
import path from 'path';
import { parseSeoMd } from '../utils/parser.js';
import { INTENT_CATEGORIES, REQUIRED_PAGES } from '../utils/constants.js';

async function writeIfMissing(filePath, content) {
    if (!(await fs.pathExists(filePath))) {
        await fs.writeFile(filePath, content, 'utf8');
        return true;
    }
    return false;
}

function generateMeta() {
    return `schema_version: 2
generated_at: ${new Date().toISOString()}
tool: seomd-cli
`;
}

function generateSeomdIndex(brand, domain) {
    return `# .seomd Index

This directory is the structured knowledge base for ${brand} (${domain}).

## Start Here

- Strategy: intent clusters in \`intent/\`
- Competitive landscape: competitor dossiers in \`competitors/\`
- Pages:
  - Curated: \`pages/pinned.md\`
  - Deep dives: \`pages/md/\`
  - Registry: \`pages/pages.db\` (planned)
- Reports: \`reports/\`
`;
}

function generateLatestSummary() {
    return `last_analyzed: null
overall_citation_rate: null
overall_gap_score: null
top_opportunities: []
`;
}

function generateIntentIndex() {
    return `version: 1
intents:
  - id: informational
    title: Informational
    file: informational.md
    owner: founder
  - id: comparison
    title: Comparison
    file: comparison.md
    owner: founder
  - id: transactional
    title: Transactional
    file: transactional.md
    owner: founder
  - id: reputational
    title: Reputational
    file: reputational.md
    owner: founder
  - id: category
    title: Category
    file: category.md
    owner: founder
`;
}

function generateIntentPlaceholder(intent) {
    return `# ${intent}

## Founder

- Priority:
- Target queries:
- Positioning constraints:
- Do:
- Don’t:

## Platform

- Last analyzed:
- Citation rate:
- Gap score:
- Top cited competitors:
`;
}

function getCompetitorId(domain) {
    return String(domain)
        .replace(/^(https?:\/\/)?(www\.)?/, '')
        .replace(/\/.*$/, '')
        .replace(/\.[a-z]{2,6}(\.[a-z]{2,6})?$/i, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function generateCompetitorIndex(competitors) {
    const entries = (competitors || [])
        .filter(Boolean)
        .map(c => {
            const id = getCompetitorId(c);
            return `  - id: ${id || 'competitor'}
    domain: ${c}
    file: ${id || 'competitor'}.md
    status: active`;
        })
        .join('\n');

    return `version: 1
competitors:
${entries || '  []'}
`;
}

function generatePinnedPages(pages) {
    const lines = pages.map(p => `- id: ${p.id}\n  url: ${p.url}\n  md: pages/md/${p.id}.md`).join('\n');
    return `# Pinned Pages

This file is a small, curated list of the most important pages.

${lines}
`;
}

export async function migrateCommand() {
    const cwd = process.cwd();
    const seomdDir = path.join(cwd, '.seomd');

    if (!(await fs.pathExists(seomdDir))) {
        console.log(chalk.red('\n❌ .seomd/ not found in this directory.'));
        console.log(chalk.dim('Run `seomd init` first.'));
        console.log('');
        process.exit(1);
    }

    const spinner = ora('Migrating .seomd/ to latest structure...').start();

    let brand = 'My Brand';
    let domain = 'example.com';
    let siteType = 'saas';
    let pages = REQUIRED_PAGES.saas;
    let competitors = [];

    try {
        const { data } = await parseSeoMd(cwd);
        brand = data.identity?.brand || brand;
        domain = data.site?.domain || domain;
        siteType = data.site?.type || siteType;

        const pagesList = [];
        if (Array.isArray(data.pages?.required)) pagesList.push(...data.pages.required);
        if (Array.isArray(data.pages?.optional)) pagesList.push(...data.pages.optional);
        pages = pagesList.length > 0 ? pagesList : (REQUIRED_PAGES[siteType] || REQUIRED_PAGES.saas);

        if (Array.isArray(data.aeo?.competitors_to_monitor)) {
            competitors = data.aeo.competitors_to_monitor;
        }
    } catch {
        pages = REQUIRED_PAGES[siteType] || REQUIRED_PAGES.saas;
    }

    try {
        await fs.ensureDir(path.join(seomdDir, 'intent'));
        await fs.ensureDir(path.join(seomdDir, 'competitors'));
        await fs.ensureDir(path.join(seomdDir, 'pages'));
        await fs.ensureDir(path.join(seomdDir, 'pages', 'md'));
        await fs.ensureDir(path.join(seomdDir, 'pages', 'templates'));
        await fs.ensureDir(path.join(seomdDir, 'reports'));
        await fs.ensureDir(path.join(seomdDir, 'generated'));

        const created = [];
        if (await writeIfMissing(path.join(seomdDir, 'meta.yaml'), generateMeta())) created.push('meta.yaml');
        if (await writeIfMissing(path.join(seomdDir, 'index.md'), generateSeomdIndex(brand, domain))) created.push('index.md');
        if (await writeIfMissing(path.join(seomdDir, 'generated', 'latest-summary.yaml'), generateLatestSummary())) created.push('generated/latest-summary.yaml');
        if (await writeIfMissing(path.join(seomdDir, 'intent', 'index.yaml'), generateIntentIndex())) created.push('intent/index.yaml');
        if (await writeIfMissing(path.join(seomdDir, 'competitors', 'index.yaml'), generateCompetitorIndex(competitors))) created.push('competitors/index.yaml');
        if (await writeIfMissing(path.join(seomdDir, 'pages', 'pinned.md'), generatePinnedPages(pages))) created.push('pages/pinned.md');

        for (const intent of INTENT_CATEGORIES) {
            await writeIfMissing(path.join(seomdDir, 'intent', `${intent}.md`), generateIntentPlaceholder(intent));
        }

        const legacyPagesDir = path.join(seomdDir, 'pages');
        const newPagesDir = path.join(seomdDir, 'pages', 'md');

        if (await fs.pathExists(legacyPagesDir)) {
            const entries = await fs.readdir(legacyPagesDir, { withFileTypes: true });
            for (const entry of entries) {
                if (!entry.isFile()) continue;
                if (!entry.name.toLowerCase().endsWith('.md')) continue;
                if (entry.name === 'pinned.md') continue;
                const src = path.join(legacyPagesDir, entry.name);
                const dst = path.join(newPagesDir, entry.name);
                if (await fs.pathExists(dst)) continue;
                await fs.move(src, dst, { overwrite: false });
            }
        }

        spinner.succeed(chalk.green('.seomd/ migration complete'));
        console.log('');
        if (created.length > 0) {
            console.log(chalk.dim('Created:'));
            for (const f of created) console.log('  ' + chalk.cyan(f));
            console.log('');
        }
        console.log(chalk.dim('Next: run `seomd analyze` or `seomd sync` to populate new files.'));
        console.log('');
    } catch (err) {
        spinner.fail(chalk.red('Migration failed'));
        console.error(chalk.bold.red(`\nError: ${err.message}`));
        process.exit(1);
    }
}

