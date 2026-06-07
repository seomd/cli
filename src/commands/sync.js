import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs-extra';
import path from 'path';
import dotenv from 'dotenv';
import { parseSeoMd } from '../utils/parser.js';
import { client } from '../utils/api-client.js';
import { writeAnalysisToSeoMd, writeReverseMd, writePageAnalysis } from '../utils/writeback.js';

dotenv.config();

export async function syncCommand(options) {
    const apiKey = process.env.SEOMD_API_KEY;
    const paymentToken = process.env.SEOMD_PAYMENT_TOKEN;

    if (!apiKey && !paymentToken) {
        console.log('');
        console.log(chalk.yellow('⚠ No API key or payment token found.'));
        console.log('');
        console.log('Add your API key to .env:');
        console.log(chalk.cyan('  SEOMD_API_KEY=your_key_here'));
        console.log('');
        console.log('Get your API key at ' + chalk.cyan('https://seomd.dev/connect'));
        console.log('');
        process.exit(1);
    }

    const cwd = process.cwd();
    let doc, data;

    try {
        const parsed = await parseSeoMd(cwd);
        doc = parsed.doc;
        data = parsed.data;
    } catch (err) {
        console.log(chalk.red(`\n❌ Error: ${err.message}`));
        process.exit(1);
    }

    const domain = data.site?.domain;
    if (!domain) {
        console.log(chalk.red('\n❌ Error: "site.domain" is required in SEO.md.'));
        process.exit(1);
    }

    // Extract pages
    let pagesList = [];
    if (data.pages) {
        if (Array.isArray(data.pages.required)) {
            pagesList = pagesList.concat(data.pages.required);
        }
        if (Array.isArray(data.pages.optional)) {
            pagesList = pagesList.concat(data.pages.optional);
        }
    }

    console.log(chalk.bold.cyan(`\n🔄 foxcite: Syncing AI Search Audit for ${chalk.white(domain)}`));
    const spinner = ora('Fetching cached analysis from platform...').start();

    try {
        const pagesParam = JSON.stringify(pagesList.map(p => ({
            id: p.id,
            url: p.url,
            primary_keyword: p.primary_keyword
        })));

        const response = await client.get('/cli/sync', {
            params: { domain, pages: pagesParam }
        });
        const results = response.data;

        if (options.dryRun) {
            spinner.succeed(chalk.green('Sync check completed (Dry Run)!'));
            console.log('');
            console.log(chalk.bold('--- Dry-Run Updates Preview ---'));
            const aeo = results.aeo_analysis;
            console.log(`Overall Citation Rate : ${chalk.bold.green((aeo.overall_citation_rate * 100).toFixed(0) + '%')}`);
            console.log(`Overall Gap Score     : ${chalk.bold.red(aeo.overall_gap_score)}`);
            console.log(`Last Analyzed         : ${chalk.dim(aeo.last_analyzed)}`);
            console.log(chalk.yellow('\n⚠ Dry-run enabled: No files were modified.'));
            console.log('');
            return;
        }

        spinner.text = 'Updating repository files...';

        // Writeback to SEO.md
        await writeAnalysisToSeoMd(doc, results, cwd);

        // Writeback to SEO.REVERSE.md
        const brandName = data.identity?.brand || 'My Brand';
        await writeReverseMd(cwd, results, domain, brandName);

        // Writeback to .seomd/pages/*.md
        await writePageAnalysis(cwd, results);

        spinner.succeed(chalk.green('Sync completed successfully!'));
        console.log('');

        // Display results summary
        const aeo = results.aeo_analysis;
        console.log(chalk.bold('--- Sync Results Summary ---'));
        console.log(`Overall Citation Rate : ${chalk.bold.green((aeo.overall_citation_rate * 100).toFixed(0) + '%')}`);
        console.log(`Overall Gap Score     : ${chalk.bold.red(aeo.overall_gap_score)}`);

        if (results.credits_remaining !== null) {
            console.log(`Credits Remaining     : ${chalk.cyan(results.credits_remaining)}`);
        }
        console.log(`Last Analyzed         : ${chalk.dim(aeo.last_analyzed)}`);
        console.log(`Next Analysis Target  : ${chalk.dim(aeo.next_analysis)}`);
        console.log('----------------------------');
        console.log('');
        console.log(chalk.green('✔ SEO.md updated.'));
        console.log(chalk.green('✔ SEO.REVERSE.md updated.'));
        console.log(chalk.green('✔ .seomd/pages/ playbooks synchronized.'));
        console.log('');

    } catch (err) {
        spinner.fail(chalk.red('Sync failed'));
        console.error(chalk.bold.red(`\nError: ${err.message}`));
        process.exit(1);
    }
}
