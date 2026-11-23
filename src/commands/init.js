import chalk from 'chalk';
import enquirer from 'enquirer';
import ora from 'ora';
import fs from 'fs-extra';
import path from 'path';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { generateSeoMd, normalizeDomain } from '../generators/seomd.js';
import { generateReverseMd } from '../generators/reverse.js';
import { createSeomdDir } from '../generators/directory.js';
import { scanRepo } from '../utils/repo-scanner.js';
import { wireAgentFiles } from '../utils/agent-wiring.js';
import { parseSeoMd } from '../utils/parser.js';
import { seedFromExisting, backupSeoMd } from '../utils/migrate.js';
import { SITE_TYPES, VALID_SITE_TYPES, SITE_TYPE_PROFILES } from '../utils/constants.js';

const { prompt } = enquirer;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.join(__dirname, '../../package.json'), 'utf8'));

export async function initCommand(options = {}) {
    console.log('');
    console.log(chalk.bold('SEO.md') + chalk.dim(` v${pkg.version} — https://seomd.dev`));
    console.log('');
    console.log(chalk.dim('The open standard for AI-era search & citation configuration.'));
    console.log('');

    // Validate --type upfront before touching the filesystem
    if (options.type && !VALID_SITE_TYPES.includes(options.type)) {
        console.log(
            chalk.red(`Invalid --type '${options.type}'. Must be one of: ${VALID_SITE_TYPES.join(', ')}`)
        );
        process.exitCode = 1;
        return;
    }

    // Determine target directory
    let workingDir = process.cwd();
    if (options.output) {
        const resolved = path.resolve(options.output);
        if ((await fs.pathExists(resolved)) && (await fs.readdir(resolved)).length > 0) {
            console.log(chalk.red(`Output directory must be empty or non-existent: ${resolved}`));
            process.exitCode = 1;
            return;
        }
        await fs.ensureDir(resolved);
        workingDir = resolved;
    }

    // Non-interactive if -y OR any config flag provided
    const hasConfigFlags =
        options.brand !== undefined ||
        options.domain !== undefined ||
        options.primaryKeyword !== undefined ||
        options.competitors !== undefined;
    const isNonInteractive = Boolean(options.yes || hasConfigFlags);

    // An existing SEO.md is never replaced silently:
    //   - v1 (legacy) files are upgraded in place, keeping their values
    //   - v2 / unreadable files need --force (or an interactive yes)
    // and the previous file is always backed up first.
    const seomdPath = path.join(workingDir, 'SEO.md');
    let existing = null;
    if (await fs.pathExists(seomdPath)) {
        let parsed = null;
        try {
            parsed = await parseSeoMd(workingDir);
        } catch {
            parsed = null;
        }
        const isLegacy = parsed?.format === 'v1';

        if (!options.force) {
            if (isNonInteractive && !isLegacy) {
                console.log(chalk.red('✗ SEO.md already exists in this directory. Nothing was changed.'));
                console.log(chalk.dim('  Re-run with --force to regenerate it (the current file is backed up to SEO.md.bak).'));
                process.exitCode = 1;
                return;
            }
            if (!isNonInteractive) {
                console.log(chalk.yellow(isLegacy
                    ? '⚠ Found a v1 SEO.md. init can upgrade it to v2, keeping your brand, keywords, intent queries, and pages.'
                    : '⚠ SEO.md already exists in this directory.'));
                const { overwrite } = await prompt({
                    type: 'confirm',
                    name: 'overwrite',
                    message: isLegacy
                        ? 'Upgrade SEO.md to v2? (current file is backed up to SEO.md.bak)'
                        : 'Overwrite existing SEO.md? (current file is backed up to SEO.md.bak)',
                    initial: isLegacy,
                });
                if (!overwrite) {
                    console.log(chalk.dim('Aborted.'));
                    process.exitCode = 0;
                    return;
                }
            }
        }
        existing = { parsed, isLegacy };
    }
    const seed = seedFromExisting(existing?.parsed?.data);

    // Inspect repository for framework, existing routes, and crawl files
    const repoInfo = await scanRepo(workingDir);
    if (repoInfo.framework || repoInfo.routes.length > 0) {
        const fwLabel = repoInfo.framework ? ` (${repoInfo.framework})` : '';
        console.log(
            chalk.dim(
                `Detected project${fwLabel}: ${repoInfo.routes.length} route(s) discovered`
            )
        );
        console.log('');
    }

    const inferredBrand = seed.answers.brand || (repoInfo.packageName
        ? repoInfo.packageName.replace(/^@[^/]+\//, '').replace(/[-_]+/g, ' ')
        : 'My Brand');
    const inferredDomain = seed.answers.domain || (repoInfo.homepage
        ? normalizeDomain(repoInfo.homepage)
        : 'example.com');

    let answers;
    if (isNonInteractive) {
        const siteType = options.type || seed.answers.site_type || 'saas';
        const profile = SITE_TYPE_PROFILES[siteType];
        answers = {
            site_type: siteType,
            domain: normalizeDomain(options.domain || inferredDomain),
            brand: (options.brand || inferredBrand).trim(),
            primary_keyword: (options.primaryKeyword || seed.answers.primary_keyword || profile.defaultKeyword).trim(),
            competitors: options.competitors
                ? options.competitors
                    .split(',')
                    .map((c) => normalizeDomain(c))
                    .filter(Boolean)
                    .slice(0, 5)
                : (seed.answers.competitors || []).map((c) => normalizeDomain(c)).filter(Boolean),
            provider: options.provider || seed.answers.provider || null,
        };
    } else {
        const typeForPrompt = options.type || seed.answers.site_type;
        const initialTypeIdx = typeForPrompt
            ? Math.max(0, SITE_TYPES.findIndex((t) => t.value === typeForPrompt))
            : 0;

        answers = await prompt([
            {
                type: 'select',
                name: 'site_type',
                message: 'Site type:',
                choices: SITE_TYPES.map((t) => ({ name: t.value, message: t.name })),
                initial: initialTypeIdx,
            },
            {
                type: 'input',
                name: 'domain',
                message: 'Primary domain:',
                initial: inferredDomain !== 'example.com' ? inferredDomain : undefined,
                hint: 'e.g. myapp.com',
                validate(value) {
                    if (!value || !value.trim()) return 'Domain is required';
                    return true;
                },
                result(value) {
                    return normalizeDomain(value);
                },
            },
            {
                type: 'input',
                name: 'brand',
                message: 'Brand name:',
                initial: inferredBrand !== 'My Brand' ? inferredBrand : undefined,
                hint: 'e.g. MyApp',
                validate(value) {
                    if (!value || !value.trim()) return 'Brand name is required';
                    return true;
                },
            },
            {
                type: 'input',
                name: 'primary_keyword',
                message: 'Primary keyword:',
                initial: seed.answers.primary_keyword,
                hint: 'e.g. project management software',
                validate(value) {
                    if (!value || !value.trim()) return 'Primary keyword is required';
                    return true;
                },
            },
            {
                type: 'input',
                name: 'competitors',
                message: 'Top competitors (comma separated, optional):',
                initial: seed.answers.competitors ? seed.answers.competitors.join(', ') : undefined,
                hint: 'e.g. asana.com, monday.com, notion.so',
                result(value) {
                    return String(value || '')
                        .split(',')
                        .map((c) => normalizeDomain(c))
                        .filter(Boolean)
                        .slice(0, 5);
                },
            },
        ]);
        answers.provider = options.provider || seed.answers.provider || null;
    }
    answers.carry = seed.carry;

    console.log('');
    const spinner = ora('Scaffolding your SEO.md workspace...').start();

    try {
        // 1. Generate v2 SEO.md (YAML frontmatter + Markdown body), backing up any existing file
        const seomdContent = generateSeoMd(answers, repoInfo);
        if (existing) {
            const backupName = await backupSeoMd(workingDir);
            spinner.succeed(chalk.green(`Previous SEO.md backed up to ${backupName}`));
        }
        await fs.writeFile(path.join(workingDir, 'SEO.md'), seomdContent, 'utf8');
        spinner.succeed(chalk.green(existing?.isLegacy
            ? 'SEO.md upgraded from v1 to spec v2.0.0 (values carried over)'
            : 'SEO.md created (spec v2.0.0)'));

        // 2. Create .seo/ workspace directory (keeps an existing .seo/README.md)
        await createSeomdDir(workingDir, answers);
        spinner.succeed(chalk.green('.seo/ workspace ready'));

        // 3. Initialize .seo/REVERSE.md: provider-generated intelligence, never overwritten
        const reversePath = path.join(workingDir, '.seo', 'REVERSE.md');
        if (await fs.pathExists(reversePath)) {
            spinner.succeed(chalk.green('.seo/REVERSE.md kept (existing provider intelligence)'));
        } else {
            await fs.writeFile(reversePath, generateReverseMd(answers), 'utf8');
            spinner.succeed(chalk.green('.seo/REVERSE.md initialized'));
        }

        // 4. Wire AGENTS.md / CLAUDE.md unless opted out via --no-wire-agents
        let agentResult = { updated: [], created: [] };
        if (options.wireAgents !== false) {
            agentResult = await wireAgentFiles(workingDir);
            const wiredList = [...agentResult.created, ...agentResult.updated];
            if (wiredList.length > 0) {
                spinner.succeed(chalk.green(`Agent instructions wired into ${wiredList.join(', ')}`));
            }
        }

        console.log('');
        console.log(chalk.bold.green('✓ SEO.md initialized successfully'));
        console.log('');
        console.log(chalk.dim('Files created / updated:'));
        console.log('  ' + chalk.cyan('SEO.md') + chalk.dim('             — your Markdown + frontmatter SEO/AEO spec'));
        console.log('  ' + chalk.cyan('.seo/REVERSE.md') + chalk.dim('    — competitor intelligence scaffold'));
        console.log('  ' + chalk.cyan('.seo/') + chalk.dim('              — provider intelligence workspace'));
        for (const f of [...agentResult.created, ...agentResult.updated]) {
            console.log('  ' + chalk.cyan(f.padEnd(18)) + chalk.dim(' — wired so coding agents auto-read SEO.md'));
        }
        console.log('');
        console.log(chalk.dim('Next steps (works locally with zero API key):'));
        console.log('  ' + chalk.white('npx seomd-cli validate') + chalk.dim('         — validate SEO.md'));
        console.log('  ' + chalk.white('npx seomd-cli check ./public') + chalk.dim('   — audit local files / localhost against SEO.md'));
        console.log('  ' + chalk.white('npx seomd-cli generate robots') + chalk.dim('  — generate AI-bot-friendly robots.txt or llms.txt'));
        console.log('  ' + chalk.white('npx seomd-cli doctor') + chalk.dim('           — inspect repo & provider readiness'));
        console.log('');
        console.log(chalk.dim('Optional live AI citation scans (any compatible provider — see PROVIDER_SPEC.md):'));
        console.log('  ' + chalk.white('npx seomd-cli analyze') + chalk.dim('          — run live multi-LLM citation analysis'));
        console.log('');
        process.exitCode = 0;
    } catch (err) {
        spinner.fail(chalk.red('Failed to scaffold SEO.md'));
        console.error(chalk.dim(err.message));
        process.exitCode = 1;
    }
}
