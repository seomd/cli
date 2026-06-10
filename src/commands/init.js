import chalk from 'chalk';
import enquirer from 'enquirer';
const { prompt } = enquirer;
import ora from 'ora';
import fs from 'fs-extra';
import path from 'path';
import { generateSeoMd } from '../generators/seomd.js';
import { generateReverseMd } from '../generators/reverse.js';
import { createSeomdDir } from '../generators/directory.js';
import { SITE_TYPES } from '../utils/constants.js';

export async function initCommand(options) {
    console.log('');
    console.log(chalk.bold('SEO.md') + chalk.dim(' v0.1.0 — https://seomd.dev'));
    console.log('');
    console.log(chalk.dim('The open standard for AI-era SEO configuration.'));
    console.log('');

    // Determine target directory
    let workingDir = process.cwd();
    if (options.output) {
        const resolved = path.resolve(options.output);
        if (await fs.pathExists(resolved) && (await fs.readdir(resolved)).length > 0) {
            console.log(chalk.red(`Output directory must be empty or non-existent: ${resolved}`));
            process.exit(1);
        }
        await fs.ensureDir(resolved);
        workingDir = resolved;
    }

    const seomdPath = path.join(workingDir, 'SEO.md');
    if (await fs.pathExists(seomdPath)) {
        console.log(chalk.yellow('⚠ SEO.md already exists in this directory.'));
        const { overwrite } = await prompt({
            type: 'confirm',
            name: 'overwrite',
            message: 'Overwrite existing SEO.md?',
            initial: false,
        });
        if (!overwrite) {
            console.log(chalk.dim('Aborted.'));
            process.exit(0);
        }
    }

    let answers;

    // Mode 5: non-interactive if -y OR any config field provided
    const hasConfigFlags =
        options.brand !== undefined ||
        options.domain !== undefined ||
        options.primaryKeyword !== undefined ||
        options.competitors !== undefined;

    if (options.yes || hasConfigFlags) {
        answers = {
            site_type: options.type || 'saas',
            domain: options.domain || 'example.com',
            brand: options.brand || 'My Brand',
            primary_keyword: options.primaryKeyword || '',
            competitors: options.competitors
                ? options.competitors
                      .split(',')
                      .map((c) => c.trim())
                      .filter(Boolean)
                      .slice(0, 3)
                : [],
        };
    } else {
        // The 5-question init flow
        answers = await prompt([
            {
                type: 'select',
                name: 'site_type',
                message: 'Site type:',
                choices: SITE_TYPES.map(t => ({ name: t.value, message: t.name })),
                initial: options.type ? SITE_TYPES.findIndex(t => t.value === options.type) : 0,
            },
            {
                type: 'input',
                name: 'domain',
                message: 'Primary domain:',
                hint: 'e.g. myapp.com',
                validate(value) {
                    if (!value) return 'Domain is required';
                    // Strip protocol if provided
                    return true;
                },
                result(value) {
                    return value.replace(/^https?:\/\//, '').replace(/\/$/, '');
                },
            },
            {
                type: 'input',
                name: 'brand',
                message: 'Brand name:',
                hint: 'e.g. MyApp',
                validate(value) {
                    if (!value) return 'Brand name is required';
                    return true;
                },
            },
            {
                type: 'input',
                name: 'primary_keyword',
                message: 'Primary keyword:',
                hint: 'e.g. project management software',
                validate(value) {
                    if (!value) return 'Primary keyword is required';
                    return true;
                },
            },
            {
                type: 'input',
                name: 'competitors',
                message: 'Top 3 competitors (comma separated):',
                hint: 'e.g. asana.com, monday.com, notion.so',
                result(value) {
                    return value
                        .split(',')
                        .map(c => c.trim())
                        .filter(Boolean)
                        .slice(0, 3);
                },
            },
        ]);
    }

    console.log('');
    const spinner = ora('Scaffolding your SEO.md files...').start();

    try {
        // 1. Generate SEO.md
        const seomdContent = generateSeoMd(answers);
        await fs.writeFile(path.join(workingDir, 'SEO.md'), seomdContent, 'utf8');
        spinner.succeed(chalk.green('SEO.md created'));

        // 2. Generate SEO.REVERSE.md
        const reverseContent = generateReverseMd(answers);
        await fs.writeFile(path.join(workingDir, 'SEO.REVERSE.md'), reverseContent, 'utf8');
        spinner.succeed(chalk.green('SEO.REVERSE.md initialized'));

        // 3. Create .seomd/ directory structure
        await createSeomdDir(workingDir, answers);
        spinner.succeed(chalk.green('.seomd/ directory created'));

        // 4. Add .seomd/ to .gitignore if it exists
        await updateGitignore(workingDir);

        console.log('');
        console.log(chalk.bold.green('✓ SEO.md initialized successfully'));
        console.log('');
        console.log(chalk.dim('Files created:'));
        console.log('  ' + chalk.cyan('SEO.md') + chalk.dim('             — your living SEO config'));
        console.log('  ' + chalk.cyan('SEO.REVERSE.md') + chalk.dim('     — reverse engineer output (platform generated)'));
        console.log('  ' + chalk.cyan('.seomd/') + chalk.dim('            — intelligence directory'));
        console.log('');
        console.log(chalk.dim('Next steps:'));
        console.log('  ' + chalk.white('npx seomd analyze') + chalk.dim('  — run your first citation analysis'));
        console.log('  ' + chalk.white('npx seomd status') + chalk.dim('   — view current gap scores'));
        console.log('');
        console.log(chalk.dim('Connect your platform at ') + chalk.cyan('https://seomd.dev/connect'));
        console.log('');

    } catch (err) {
        spinner.fail(chalk.red('Failed to scaffold SEO.md'));
        console.error(chalk.dim(err.message));
        process.exit(1);
    }
}

async function updateGitignore(cwd) {
    const gitignorePath = path.join(cwd, '.gitignore');
    const entry = '\n# seomd intelligence directory\n.seomd/reports/\n';

    if (await fs.pathExists(gitignorePath)) {
        const content = await fs.readFile(gitignorePath, 'utf8');
        if (!content.includes('.seomd')) {
            await fs.appendFile(gitignorePath, entry);
        }
    }
}