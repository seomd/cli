import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs-extra';
import path from 'path';
import YAML from 'yaml';
import { parseSeoMd, getBrand, getPages } from '../utils/parser.js';
import { resolveProvider } from '../providers/index.js';
import { writeAnalysisToSeoMd, writeReverseMd, writePageAnalysis } from '../utils/writeback.js';

export async function syncCommand(options = {}) {
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
        console.log('Set your provider credentials in `.env`:');
        console.log(chalk.cyan('  SEOMD_PROVIDER=foxcite       # or custom | semrush | ahrefs | profound | peec'));
        console.log(chalk.cyan('  SEOMD_API_KEY=your_key_here'));
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

    const pagesList = getPages(data);

    console.log(chalk.bold.cyan(`\n🔄 ${provider.displayName}: Syncing AI Search Audit for ${chalk.white(domain)}`));
    const spinner = ora('Fetching cached analysis from provider...').start();

    try {
        const results = await provider.sync({ domain, pages: pagesList });
        const aeo = results?.aeo_analysis || {};

        if (options.dryRun) {
            spinner.succeed(chalk.green('Sync check completed (Dry Run)!'));
            console.log('');
            console.log(chalk.bold('--- Dry-Run Updates Preview ---'));

            // Load previous STATUS.yml if available to show metric deltas
            let prevAeo = {};
            const statusPath = path.join(cwd, '.seo', 'STATUS.yml');
            if (await fs.pathExists(statusPath)) {
                try {
                    const prev = YAML.parse(await fs.readFile(statusPath, 'utf8')) || {};
                    prevAeo = prev.aeo || {};
                } catch {
                    prevAeo = {};
                }
            }

            if (typeof aeo.overall_citation_rate === 'number') {
                const delta =
                    typeof prevAeo.overall_citation_rate === 'number'
                        ? ` (${formatDelta((aeo.overall_citation_rate - prevAeo.overall_citation_rate) * 100, '%')})`
                        : '';
                console.log(
                    `Overall Citation Rate : ${chalk.bold.green((aeo.overall_citation_rate * 100).toFixed(0) + '%')}${chalk.dim(delta)}`
                );
            }
            if (aeo.overall_gap_score !== undefined && aeo.overall_gap_score !== null) {
                const delta =
                    typeof prevAeo.overall_gap_score === 'number'
                        ? ` (${formatDelta(aeo.overall_gap_score - prevAeo.overall_gap_score, '')})`
                        : '';
                console.log(`Overall Gap Score     : ${chalk.bold.red(aeo.overall_gap_score)}${chalk.dim(delta)}`);
            }
            console.log(`Pages in payload      : ${Array.isArray(results?.page_analysis) ? results.page_analysis.length : 0}`);
            console.log(`Last Analyzed         : ${chalk.dim(aeo.last_analyzed || 'N/A')}`);
            console.log(chalk.yellow('\n⚠ Dry-run enabled: No files were modified.'));
            console.log('');
            process.exitCode = 0;
            return;
        }

        spinner.text = 'Updating .seo/ workspace files...';

        const brandName = getBrand(data);
        await writeAnalysisToSeoMd(doc, results, cwd, { provider: provider.name });
        await writeReverseMd(cwd, results, domain, brandName, { provider: provider.name });
        await writePageAnalysis(cwd, results);

        spinner.succeed(chalk.green('Sync completed successfully!'));
        console.log('');

        console.log(chalk.bold('--- Sync Results Summary ---'));
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
        console.log('----------------------------');
        console.log('');
        console.log(chalk.green('✔ .seo/STATUS.yml updated.'));
        console.log(chalk.green('✔ .seo/REVERSE.md updated.'));
        console.log(chalk.green('✔ .seo/pages/ playbooks synchronized.'));
        console.log('');
        process.exitCode = 0;
    } catch (err) {
        spinner.fail(chalk.red('Sync failed'));
        console.error(chalk.bold.red(`\nError: ${err.message}`));
        process.exitCode = 1;
    }
}

function formatDelta(diff, suffix) {
    const rounded = Math.round(diff);
    if (rounded === 0) return `no change`;
    return `${rounded > 0 ? '+' : ''}${rounded}${suffix}`;
}
