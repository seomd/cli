import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import YAML from 'yaml';
import { parseSeoMd, getBrand, getPages } from '../utils/parser.js';
import { INTENT_CATEGORIES } from '../utils/constants.js';

export async function statusCommand(options = {}) {
    try {
        const cwd = process.cwd();
        const { data } = await parseSeoMd(cwd);

        let statusData = {};
        const statusPath = path.join(cwd, '.seo', 'STATUS.yml');

        if (await fs.pathExists(statusPath)) {
            const content = await fs.readFile(statusPath, 'utf8');
            statusData = YAML.parse(content) || {};
        }

        const aeoAnalysis = statusData.aeo || {};
        const intentAnalysis = statusData.intent || {};
        const declaredPages = getPages(data);
        const pagesAnalysis = Array.isArray(statusData.pages?.pages) ? statusData.pages.pages : [];

        // Combine declared pages + any ad-hoc analyzed pages not in SEO.md
        const mergedPages = [...declaredPages];
        const declaredIds = new Set(declaredPages.map((p) => p.id));
        for (const analyzed of pagesAnalysis) {
            if (analyzed?.id && !declaredIds.has(analyzed.id)) {
                mergedPages.push({
                    id: analyzed.id,
                    url: analyzed.url || '/',
                    status: 'analyzed',
                    priority: 0,
                });
            }
        }

        const hasOverallData =
            aeoAnalysis.overall_citation_rate !== null &&
            aeoAnalysis.overall_citation_rate !== undefined;

        if (!hasOverallData) {
            if (options.json) {
                console.log(JSON.stringify({ status: 'no_data', message: 'No analysis data found' }, null, 2));
            } else {
                console.log('');
                console.log(chalk.yellow('⚠ No analysis data found in .seo/STATUS.yml.'));
                console.log('');
                console.log('To populate live citation data:');
                console.log('  1. Configure a compatible provider in `.env`:');
                console.log(chalk.cyan('     SEOMD_PROVIDER=foxcite'));
                console.log(chalk.cyan('     SEOMD_API_KEY=your_key_here'));
                console.log('  2. Run citation analysis:');
                console.log(chalk.white('     npx seomd-cli analyze'));
                console.log('');
            }
            process.exitCode = 0;
            return;
        }

        if (options.json) {
            const output = {
                source: statusData.source || null,
                site: {
                    type: data.site?.type || null,
                    domain: data.site?.domain || null,
                    brand: getBrand(data),
                },
                overall: {
                    citation_rate: aeoAnalysis.overall_citation_rate,
                    gap_score: aeoAnalysis.overall_gap_score ?? null,
                    last_analyzed: statusData.last_analyzed || null,
                },
                intent: {},
                pages: [],
            };

            INTENT_CATEGORIES.forEach((cat) => {
                const catData = intentAnalysis[cat] || {};
                const declared = data.intent?.[cat] || {};
                output.intent[cat] = {
                    priority: declared.priority ?? null,
                    citation_rate: catData.citation_rate ?? null,
                    gap_score: catData.gap_score ?? null,
                    trend: catData.trend ?? null,
                };
            });

            mergedPages.forEach((req) => {
                const anal = pagesAnalysis.find((p) => p.id === req.id) || {};
                output.pages.push({
                    id: req.id,
                    url: req.url,
                    status: req.status || 'planned',
                    priority: req.priority ?? 0,
                    citation_rate: anal.citation_rate ?? null,
                    gap_score: anal.gap_score ?? null,
                });
            });

            console.log(JSON.stringify(output, null, 2));
            process.exitCode = 0;
            return;
        }

        const brand = getBrand(data);
        const overallCitation = formatPercentage(aeoAnalysis.overall_citation_rate);
        const overallGap = formatScore(aeoAnalysis.overall_gap_score);

        console.log('');
        console.log(chalk.bold('SEO.md Status Dashboard') + chalk.dim(` — ${brand} (${data.site?.domain || 'domain'})`));
        console.log(
            chalk.dim(
                `Source: ${statusData.source || 'unknown'} | Last analyzed: ${statusData.last_analyzed || 'N/A'}`
            )
        );
        console.log(chalk.dim('─'.repeat(65)));

        console.log(`Overall Citation Rate:  ${colorCitation(aeoAnalysis.overall_citation_rate, overallCitation)}`);
        console.log(`Overall Gap Score:      ${colorGap(aeoAnalysis.overall_gap_score, overallGap)}`);
        console.log(chalk.dim('─'.repeat(65)));

        // Intent Categories Table (pad BEFORE applying ANSI color)
        console.log(chalk.bold('INTENT CATEGORY SUMMARY'));
        console.log('');
        console.log(formatRow('Category', 'Priority', 'Citation Rate', 'Gap Score', 'Trend'));
        console.log(chalk.dim('─'.repeat(65)));

        INTENT_CATEGORIES.forEach((cat) => {
            const declared = data.intent?.[cat] || {};
            const anal = intentAnalysis[cat] || {};

            const name = cat.charAt(0).toUpperCase() + cat.slice(1);
            const priority = declared.priority || 'medium';
            const rawCit = formatPercentage(anal.citation_rate).padEnd(13);
            const rawGap = formatScore(anal.gap_score).padEnd(9);
            const trend = anal.trend || '-';

            console.log(
                `${name.padEnd(16)} │ ${priority.padEnd(10)} │ ${colorCitation(anal.citation_rate, rawCit)} │ ${colorGap(anal.gap_score, rawGap)} │ ${trend}`
            );
        });

        console.log(chalk.dim('─'.repeat(65)));
        console.log('');

        // Pages Table
        console.log(chalk.bold('PAGE ANALYSIS SUMMARY'));
        console.log('');
        console.log(formatRowPage('Page ID', 'URL', 'Status', 'Citation Rate', 'Gap Score'));
        console.log(chalk.dim('─'.repeat(76)));

        mergedPages.forEach((req) => {
            const anal = pagesAnalysis.find((p) => p.id === req.id) || {};
            const id = truncate(req.id, 16).padEnd(16);
            const url = truncate(req.url, 22).padEnd(22);
            const status = String(req.status || 'planned').padEnd(8);
            const rawCit = formatPercentage(anal.citation_rate).padEnd(13);
            const rawGap = formatScore(anal.gap_score).padEnd(9);

            console.log(
                `${id} │ ${url} │ ${status} │ ${colorCitation(anal.citation_rate, rawCit)} │ ${colorGap(anal.gap_score, rawGap)}`
            );
        });

        console.log(chalk.dim('─'.repeat(76)));
        console.log('');
        process.exitCode = 0;
    } catch (err) {
        console.log(chalk.red('✗ ') + chalk.bold('Failed to display status:'));
        console.log(`  ${chalk.dim(err.message)}`);
        console.log('');
        process.exitCode = 1;
    }
}

function truncate(str, max) {
    const s = String(str || '');
    return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function formatRow(cat, pri, cit, gap, trend) {
    return `${cat.padEnd(16)} │ ${pri.padEnd(10)} │ ${cit.padEnd(13)} │ ${gap.padEnd(9)} │ ${trend}`;
}

function formatRowPage(id, url, status, cit, gap) {
    return `${id.padEnd(16)} │ ${url.padEnd(22)} │ ${status.padEnd(8)} │ ${cit.padEnd(13)} │ ${gap.padEnd(9)}`;
}

function formatPercentage(val) {
    if (val === null || val === undefined) return '-';
    if (typeof val === 'number') {
        return `${(val * 100).toFixed(0)}%`;
    }
    return String(val);
}

function formatScore(val) {
    if (val === null || val === undefined) return '-';
    return String(val);
}

function colorCitation(val, str) {
    if (val === null || val === undefined) return chalk.dim(str);
    const num = typeof val === 'number' ? val * 100 : parseFloat(val);
    if (Number.isNaN(num)) return chalk.dim(str);

    if (num >= 20) return chalk.green.bold(str);
    if (num >= 5) return chalk.yellow.bold(str);
    return chalk.red.bold(str);
}

function colorGap(val, str) {
    if (val === null || val === undefined) return chalk.dim(str);
    const num = parseInt(val, 10);
    if (Number.isNaN(num)) return chalk.dim(str);

    if (num < 30) return chalk.green.bold(str);
    if (num <= 70) return chalk.yellow.bold(str);
    return chalk.red.bold(str);
}
