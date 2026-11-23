import chalk from 'chalk';
import ora from 'ora';
import { parseSeoMd, getBrand, getPages, getIntentQueries } from '../utils/parser.js';
import { resolveProvider } from '../providers/index.js';
import { writeAnalysisToSeoMd, writeReverseMd, writePageAnalysis } from '../utils/writeback.js';
import { INTENT_CATEGORIES } from '../utils/constants.js';

function escapeRegexSegment(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function matchRoute(pattern, url) {
    const cleanPattern = String(pattern || '').replace(/\/$/, '') || '/';
    const cleanUrl = String(url || '').replace(/\/$/, '') || '/';

    if (cleanPattern.toLowerCase() === cleanUrl.toLowerCase()) {
        return true;
    }

    // Replace dynamic segments like [competitor] with a required single path segment [^/]+
    const parts = cleanPattern.split('/').map((seg) => {
        if (/^\[[^\]]+\]$/.test(seg)) {
            return '[^/]+';
        }
        return escapeRegexSegment(seg);
    });

    const regex = new RegExp(`^${parts.join('\\/')}\\/?$`, 'i');
    return regex.test(cleanUrl);
}

export async function analyzeCommand(options = {}) {
    const cwd = process.cwd();
    let doc, data;

    try {
        const parsed = await parseSeoMd(cwd);
        doc = parsed.doc;
        data = parsed.data;
    } catch (err) {
        console.log(chalk.red(`\n✗ Error: ${err.message}`));
        process.exitCode = 1;
        return;
    }

    const provider = resolveProvider(data);
    if (!provider) {
        console.log('');
        console.log(chalk.yellow('⚠ No intelligence provider configured.'));
        console.log('');
        console.log('Local commands (`validate`, `check`, `generate`, `doctor`) work offline without a provider.');
        console.log('To run live AI citation analysis, configure any SEO.md-compatible provider in `.env`:');
        console.log(chalk.cyan('  SEOMD_PROVIDER=foxcite       # or custom | semrush | ahrefs | profound | peec'));
        console.log(chalk.cyan('  SEOMD_API_KEY=your_key_here'));
        console.log(chalk.cyan('  # SEOMD_API_URL=https://api.your-provider.com  (for custom endpoints)'));
        console.log('');
        console.log('Provider protocol & compatible platforms: ' + chalk.cyan('https://seomd.dev/providers'));
        console.log('');
        process.exitCode = 1;
        return;
    }

    const domain = data.site?.domain;
    if (!domain) {
        console.log(chalk.red('\n✗ Error: "site.domain" is required in SEO.md.'));
        process.exitCode = 1;
        return;
    }

    // Validate --intent option if provided
    if (options.intent && !INTENT_CATEGORIES.includes(String(options.intent).toLowerCase())) {
        console.log(
            chalk.red(
                `\n✗ Error: Invalid --intent '${options.intent}'. Must be one of: ${INTENT_CATEGORIES.join(', ')}`
            )
        );
        process.exitCode = 1;
        return;
    }

    const niche = data.site?.type || 'saas';
    const queries = getIntentQueries(data, options.intent || null);

    // Extract & filter pages
    let pagesList = getPages(data);
    if (options.page) {
        pagesList = pagesList.filter((p) => matchRoute(p.url, options.page));
    }

    // Fallback when --page does not match any declared route or pages list is empty
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
            status: 'planned',
        });
    }

    let engines = ['ChatGPT', 'Perplexity', 'Claude'];
    if (options.engines) {
        engines = options.engines
            .split(',')
            .map((e) => e.trim())
            .filter(Boolean);
    }

    console.log(chalk.bold.cyan(`\n📊 ${provider.displayName}: Running AI Search Audit for ${chalk.white(domain)}`));
    console.log(chalk.dim(`Engines: ${engines.join(', ')}`));
    if (options.intent) {
        console.log(chalk.dim(`Intent filter: ${options.intent}`));
    }
    console.log(chalk.dim(`Pages to scan: ${pagesList.length}`));
    console.log('');

    const spinner = ora('Initializing scan sessions...').start();

    try {
        const brand = getBrand(data);
        const payload = {
            domain,
            niche,
            brand,
            queries,
            engines,
            pages: pagesList.map((p) => ({
                id: p.id,
                url: options.page && pagesList.length === 1 ? options.page : p.url,
                primary_keyword: p.primary_keyword || data.keywords?.primary || `best ${niche}`,
                status: p.status,
            })),
        };

        spinner.text = 'Scanning AI search engines and compiling citations (this may take up to a minute)...';

        const results = await provider.analyze(payload);

        spinner.text = 'Writing analysis results back to .seo/ workspace...';

        await writeAnalysisToSeoMd(doc, results, cwd, { provider: provider.name });
        await writeReverseMd(cwd, results, domain, brand, { provider: provider.name });
        await writePageAnalysis(cwd, results);

        spinner.succeed(chalk.green('Analysis completed successfully!'));
        console.log('');

        const aeo = results?.aeo_analysis || {};
        console.log(chalk.bold('--- Results Summary ---'));
        if (typeof aeo.overall_citation_rate === 'number') {
            console.log(`Overall Citation Rate : ${chalk.bold.green((aeo.overall_citation_rate * 100).toFixed(0) + '%')}`);
        }
        if (aeo.overall_gap_score !== undefined && aeo.overall_gap_score !== null) {
            console.log(`Overall Gap Score     : ${chalk.bold.red(aeo.overall_gap_score)}`);
        }
        if (results?.credits_remaining !== null && results?.credits_remaining !== undefined) {
            console.log(`Credits Remaining     : ${chalk.cyan(results.credits_remaining)}`);
        }
        console.log(`Last Analyzed         : ${chalk.dim(aeo.last_analyzed || 'N/A')}`);
        console.log(`Next Analysis Target  : ${chalk.dim(aeo.next_analysis || 'N/A')}`);
        console.log('-----------------------');
        console.log('');
        console.log(chalk.green('✔ .seo/STATUS.yml updated.'));
        console.log(chalk.green('✔ .seo/REVERSE.md updated.'));
        console.log(chalk.green('✔ .seo/pages/ playbooks updated.'));
        console.log('');
        process.exitCode = 0;
    } catch (err) {
        spinner.fail(chalk.red('Analysis failed'));
        console.error(chalk.bold.red(`\nError: ${err.message}`));
        process.exitCode = 1;
    }
}
