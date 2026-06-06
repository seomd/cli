import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs-extra';
import path from 'path';
import dotenv from 'dotenv';
import { parseSeoMd } from '../utils/parser.js';
import { client } from '../utils/api-client.js';
import { writeAnalysisToSeoMd, writeReverseMd, writePageAnalysis } from '../utils/writeback.js';

dotenv.config();

export async function analyzeCommand(options) {
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

    const niche = data.site?.type || 'saas';

    // Extract intent queries
    const queries = {};
    if (data.intent) {
        for (const [intentType, obj] of Object.entries(data.intent)) {
            if (intentType !== '_analysis' && obj && Array.isArray(obj.queries)) {
                queries[intentType] = obj.queries;
            }
        }
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

    // Filter by options.page if specified
    if (options.page) {
        pagesList = pagesList.filter(p => p.url === options.page);
    }

    // Default to homepage if no pages defined
    if (pagesList.length === 0) {
        pagesList.push({
            id: 'homepage',
            url: options.page || '/',
            primary_keyword: `best ${niche}`,
            status: 'planned'
        });
    }

    // Extract engines
    const engines = data.aeo?._analysis?.engines_tracked || ['ChatGPT'];

    console.log(chalk.bold.cyan(`\n📊 Foxcite: Running AI Search Audit for ${chalk.white(domain)}`));
    console.log(chalk.dim(`Engines: ${engines.join(', ')}`));
    console.log(chalk.dim(`Pages to scan: ${pagesList.length}`));
    console.log('');

    const spinner = ora('Initializing scan sessions...').start();

    try {
        const payload = {
            domain,
            niche,
            queries,
            engines,
            pages: pagesList.map(p => ({
                id: p.id,
                url: p.url,
                primary_keyword: p.primary_keyword || data.keywords?.primary || `best ${niche}`,
                status: p.status
            }))
        };

        spinner.text = 'Scanning AI search engines and compiling citations (this may take up to a minute)...';

        const response = await client.post('/cli/analyze', payload);
        const results = response.data;

        spinner.text = 'Writing analysis blocks back to repository files...';

        // Writeback to SEO.md
        await writeAnalysisToSeoMd(doc, results, cwd);

        // Writeback to SEO.REVERSE.md
        await writeReverseMd(cwd, results);

        // Writeback to .seomd/pages/*.md
        await writePageAnalysis(cwd, results);

        spinner.succeed(chalk.green('Analysis completed successfully!'));
        console.log('');

        // Display results summary
        const aeo = results.aeo_analysis;
        console.log(chalk.bold('--- Results Summary ---'));
        console.log(`Overall Citation Rate : ${chalk.bold.green((aeo.overall_citation_rate * 100).toFixed(0) + '%')}`);
        console.log(`Overall Gap Score     : ${chalk.bold.red(aeo.overall_gap_score)}`);

        if (results.credits_remaining !== null) {
            console.log(`Credits Remaining     : ${chalk.cyan(results.credits_remaining)}`);
        }
        console.log(`Last Analyzed         : ${chalk.dim(aeo.last_analyzed)}`);
        console.log(`Next Analysis Target  : ${chalk.dim(aeo.next_analysis)}`);
        console.log('-----------------------');
        console.log('');
        console.log(chalk.green('✔ SEO.md updated.'));
        console.log(chalk.green('✔ SEO.REVERSE.md updated.'));
        console.log(chalk.green('✔ .seomd/pages/ playbooks generated.'));
        console.log('');

    } catch (err) {
        spinner.fail(chalk.red('Analysis failed'));
        console.error(chalk.bold.red(`\nError: ${err.message}`));
        process.exit(1);
    }
}