import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs-extra';
import dotenv from 'dotenv';
import { parseSeoMd } from '../utils/parser.js';
import { client } from '../utils/api-client.js';
import { writeAnalysisToSeoMd, writeReverseMd, writePageAnalysis } from '../utils/writeback.js';

dotenv.config();

function matchRoute(pattern, url) {
    const cleanPattern = pattern.replace(/\/$/, '');
    const cleanUrl = url.replace(/\/$/, '');

    if (cleanPattern.toLowerCase() === cleanUrl.toLowerCase()) {
        return true;
    }

    // Replace "/[param]" with optional group "(?:/([^/]+))?"
    const regexPattern = cleanPattern
        .replace(/\/\[[^\]]+\]/g, '(?:\\/([^/]+))?')
        .replace(/\//g, '\\/');

    const regex = new RegExp('^' + regexPattern + '\\/?$', 'i');
    return regex.test(url);
}

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
        pagesList = pagesList.filter(p => matchRoute(p.url, options.page));
    }

    // Default fallback if no page matches or list is empty
    if (pagesList.length === 0) {
        let fallbackId = 'homepage';
        if (options.page && options.page !== '/') {
            fallbackId = options.page
                .replace(/^\//, '')
                .replace(/\/$/, '')
                .replace(/[^a-zA-Z0-9-]/g, '-');
        }
        pagesList.push({
            id: fallbackId,
            url: options.page || '/',
            primary_keyword: data.keywords?.primary || `best ${niche}`,
            status: 'planned'
        });
    }

    // Extract engines
    let engines = ['ChatGPT', 'Perplexity', 'Claude']; // Default since we removed _analysis
    if (options.engines) {
        engines = options.engines.split(',').map(e => e.trim());
    }

    console.log(chalk.bold.cyan(`\n📊 Foxcite: Running AI Search Audit for ${chalk.white(domain)}`));
    console.log(chalk.dim(`Engines: ${engines.join(', ')}`));
    console.log(chalk.dim(`Pages to scan: ${pagesList.length}`));
    console.log('');

    const spinner = ora('Initializing scan sessions...').start();

    try {
        const brand = data.identity?.brand || 'My Brand';
        const payload = {
            domain,
            niche,
            brand,
            queries,
            engines,
            pages: pagesList.map(p => ({
                id: p.id,
                url: options.page || p.url, // Use the specific page requested if provided
                primary_keyword: p.primary_keyword || data.keywords?.primary || `best ${niche}`,
                status: p.status
            }))
        };

        spinner.text = 'Scanning AI search engines and compiling citations (this may take up to a minute)...';

        const response = await client.post('/cli/analyze', payload);
        const results = response.data;

        spinner.text = 'Writing analysis blocks back to repository files...';

        // Writeback to .seo/STATUS.yml
        await writeAnalysisToSeoMd(doc, results, cwd);

        // Writeback to .seo/REVERSE.md
        const brandName = data.identity?.brand || 'My Brand';
        await writeReverseMd(cwd, results, domain, brandName);

        // Writeback to .seo/pages/*.md
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
        console.log(chalk.green('✔ .seo/STATUS.yml updated.'));
        console.log(chalk.green('✔ .seo/REVERSE.md updated.'));
        console.log(chalk.green('✔ .seo/pages/ playbooks generated.'));
        console.log('');

    } catch (err) {
        spinner.fail(chalk.red('Analysis failed'));
        console.error(chalk.bold.red(`\nError: ${err.message}`));
        process.exit(1);
    }
}