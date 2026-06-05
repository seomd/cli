import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs-extra';
import path from 'path';
import dotenv from 'dotenv';
import { parseSeoMd } from '../utils/parser.js';

dotenv.config();

export async function syncCommand(options) {
    const apiKey = process.env.SEOMD_API_KEY;

    if (!apiKey) {
        console.log('');
        console.log(chalk.yellow('⚠ No API key found.'));
        console.log('');
        console.log('Add your API key to .env:');
        console.log(chalk.cyan('  SEOMD_API_KEY=your_key_here'));
        console.log('');
        console.log('Get your API key at ' + chalk.cyan('https://seomd.dev/connect'));
        console.log('');
        process.exit(1);
    }

    // Check SEO.md exists
    const seomdPath = path.join(process.cwd(), 'SEO.md');
    if (!await fs.pathExists(seomdPath)) {
        console.log(chalk.yellow('⚠ No SEO.md found. Run `npx seomd init` first.'));
        process.exit(1);
    }

    const spinner = ora('Connecting to platform...').start();

    try {
        // Read SEO.md configuration to check platform settings
        const { data } = await parseSeoMd(process.cwd());
        const provider = data.platform?.provider;

        if (!provider) {
            spinner.warn(chalk.yellow('Platform provider not configured in SEO.md.'));
            console.log('');
            console.log('Update the platform section in your ' + chalk.cyan('SEO.md') + ':');
            console.log(chalk.dim('  platform:'));
            console.log(chalk.dim('    provider: trafficbench  # (or ahrefs, semrush, manual)'));
            console.log(chalk.dim('    project_id: your_project_id'));
            console.log('');
            console.log('Connect at ' + chalk.cyan('https://seomd.dev/connect'));
            console.log('');
            process.exit(1);
        }

        if (options.dryRun) {
            spinner.info(chalk.dim('Dry-run: Previewing updates (no changes will be written).'));
            console.log('');
            console.log(chalk.dim('Dry-run is not available until platform is connected.'));
            console.log('');
            process.exit(0);
        }

        spinner.info(chalk.dim('Sync requires a connected platform.'));
        console.log('');
        console.log('Connect your project at ' + chalk.cyan('https://seomd.dev/connect'));
        console.log('');
    } catch (err) {
        spinner.fail(chalk.red('Sync failed'));
        console.error(chalk.dim(err.message));
        process.exit(1);
    }
}
