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

    const seomdPath = path.join(workingDir, 'SEO.md');
    if (await fs.pathExists(seomdPath)) {
        if (!isNonInteractive && !options.force) {
            console.log(chalk.yellow('⚠ SEO.md already exists in this directory.'));
            const { overwrite } = await prompt({
                type: 'confirm',
                name: 'overwrite',
                message: 'Overwrite existing SEO.md?',
                initial: false,
            });
            if (!overwrite) {
                console.log(chalk.dim('Aborted.'));
                process.exitCode = 0;
                return;
            }
        }
    }

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

    const inferredBrand = repoInfo.packageName
        ? repoInfo.packageName.replace(/^@[^/]+\//, '').replace(/[-_]+/g, ' ')
        : 'My Brand';
    const inferredDomain = repoInfo.homepage
        ? normalizeDomain(repoInfo.homepage)
        : 'example.com';

    let answers;
    if (isNonInteractive) {
        const siteType = options.type || 'saas';
        const profile = SITE_TYPE_PROFILES[siteType];
        answers = {
            site_type: siteType,
            domain: normalizeDomain(options.domain || inferredDomain),
            brand: (options.brand || inferredBrand).trim(),
            primary_keyword: (options.primaryKeyword || profile.defaultKeyword).trim(),
            competitors: options.competitors
                ? options.competitors
                    .split(',')
                    .map((c) => normalizeDomain(c))
                    .filter(Boolean)
                    .slice(0, 5)
                : [],
            provider: options.provider || null,
        };
    } else {
        const initialTypeIdx = options.type
            ? Math.max(0, SITE_TYPES.findIndex((t) => t.value === options.type))
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
        answers.provider = options.provider || null;
    }

    console.log('');
    const spinner = ora('Scaffolding your SEO.md workspace...').start();

    try {
        // 1. Generate v2 SEO.md (YAML frontmatter + Markdown body)
        const seomdContent = generateSeoMd(answers, repoInfo);
        await fs.writeFile(path.join(workingDir, 'SEO.md'), seomdContent, 'utf8');
        spinner.succeed(chalk.green('SEO.md created (spec v2.0.0)'));

        // 2. Create .seo/ workspace directory
        await createSeomdDir(workingDir, answers);
        spinner.succeed(chalk.green('.seo/ workspace created'));

        // 3. Initialize .seo/REVERSE.md
        const reverseContent = generateReverseMd(answers);
        await fs.writeFile(path.join(workingDir, '.seo', 'REVERSE.md'), reverseContent, 'utf8');
        spinner.succeed(chalk.green('.seo/REVERSE.md initialized'));

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
