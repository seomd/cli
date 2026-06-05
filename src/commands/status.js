import chalk from 'chalk';
import { parseSeoMd } from '../utils/parser.js';

export async function statusCommand(options) {
    try {
        const { data } = await parseSeoMd(process.cwd());

        const aeoAnalysis = data.aeo?._analysis || {};
        const intentAnalysis = data.intent?._analysis || {};
        const pagesRequired = data.pages?.required || [];
        const pagesAnalysis = data.pages?._analysis?.pages || [];

        // Check if there is any analysis data
        const hasOverallData = aeoAnalysis.overall_citation_rate !== null && aeoAnalysis.overall_citation_rate !== undefined;
        
        if (!hasOverallData) {
            if (options.json) {
                console.log(JSON.stringify({ status: "no_data", message: "No analysis data found" }, null, 2));
            } else {
                console.log('');
                console.log(chalk.yellow('⚠ No analysis data found in SEO.md.'));
                console.log('');
                console.log('To populate analysis data:');
                console.log(`  1. Get an API key at ${chalk.cyan('https://seomd.dev/connect')}`);
                console.log('  2. Add it to your .env file:');
                console.log(chalk.cyan('     SEOMD_API_KEY=your_key_here'));
                console.log('  3. Run citation analysis:');
                console.log(chalk.white('     npx seomd analyze'));
                console.log('');
            }
            process.exit(0);
        }

        // Format overall metrics
        const overallCitation = formatPercentage(aeoAnalysis.overall_citation_rate);
        const overallGap = formatScore(aeoAnalysis.overall_gap_score);

        if (options.json) {
            // Output structured JSON
            const output = {
                site: {
                    type: data.site?.type || null,
                    domain: data.site?.domain || null,
                    brand: data.identity?.brand || null,
                },
                overall: {
                    citation_rate: aeoAnalysis.overall_citation_rate,
                    gap_score: aeoAnalysis.overall_gap_score,
                    last_analyzed: aeoAnalysis.last_analyzed || null,
                },
                intent: {},
                pages: []
            };

            const categories = ['informational', 'comparison', 'transactional', 'reputational', 'category'];
            categories.forEach(cat => {
                const catData = intentAnalysis[cat] || {};
                const declared = data.intent?.[cat] || {};
                output.intent[cat] = {
                    priority: declared.priority || null,
                    citation_rate: catData.citation_rate || null,
                    gap_score: catData.gap_score || null,
                    trend: catData.trend || null
                };
            });

            pagesRequired.forEach(req => {
                const anal = pagesAnalysis.find(p => p.id === req.id) || {};
                output.pages.push({
                    id: req.id,
                    url: req.url,
                    status: req.status || 'planned',
                    priority: req.priority || 0,
                    citation_rate: anal.citation_rate !== undefined ? anal.citation_rate : null,
                    gap_score: anal.gap_score !== undefined ? anal.gap_score : null,
                });
            });

            console.log(JSON.stringify(output, null, 2));
            process.exit(0);
        }

        // Output beautiful terminal dashboard
        console.log('');
        console.log(chalk.bold('SEO.md Status Dashboard') + chalk.dim(` — ${data.identity?.brand || 'Brand'} (${data.site?.domain || 'domain'})`));
        console.log(chalk.dim(`Last analyzed: ${aeoAnalysis.last_analyzed || 'N/A'}`));
        console.log(chalk.dim('─'.repeat(60)));
        
        // Overall block
        console.log(`Overall Citation Rate:  ${colorCitation(aeoAnalysis.overall_citation_rate, overallCitation)}`);
        console.log(`Overall Gap Score:      ${colorGap(aeoAnalysis.overall_gap_score, overallGap)}`);
        console.log(chalk.dim('─'.repeat(60)));

        // Intent Categories Table
        console.log(chalk.bold('INTENT CATEGORY SUMMARY'));
        console.log('');
        console.log(formatRow('Category', 'Priority', 'Citation Rate', 'Gap Score', 'Trend'));
        console.log(chalk.dim('─'.repeat(65)));

        const categories = ['informational', 'comparison', 'transactional', 'reputational', 'category'];
        categories.forEach(cat => {
            const declared = data.intent?.[cat] || {};
            const anal = intentAnalysis[cat] || {};
            
            const name = cat.charAt(0).toUpperCase() + cat.slice(1);
            const priority = declared.priority || 'medium';
            const citationVal = anal.citation_rate;
            const gapVal = anal.gap_score;
            const trend = anal.trend || '-';

            const citationStr = colorCitation(citationVal, formatPercentage(citationVal));
            const gapStr = colorGap(gapVal, formatScore(gapVal));
            
            console.log(formatRow(name, priority, citationStr, gapStr, trend));
        });
        
        console.log(chalk.dim('─'.repeat(65)));
        console.log('');

        // Pages Table
        console.log(chalk.bold('PAGE ANALYSIS SUMMARY'));
        console.log('');
        console.log(formatRowPage('Page ID', 'URL', 'Status', 'Citation Rate', 'Gap Score'));
        console.log(chalk.dim('─'.repeat(70)));

        pagesRequired.forEach(req => {
            const anal = pagesAnalysis.find(p => p.id === req.id) || {};
            
            const id = req.id;
            const url = req.url;
            const status = req.status || 'planned';
            const citationVal = anal.citation_rate;
            const gapVal = anal.gap_score;

            const citationStr = colorCitation(citationVal, formatPercentage(citationVal));
            const gapStr = colorGap(gapVal, formatScore(gapVal));

            console.log(formatRowPage(id, url, status, citationStr, gapStr));
        });

        console.log(chalk.dim('─'.repeat(70)));
        console.log('');

    } catch (err) {
        console.log(chalk.red('✗ ') + chalk.bold('Failed to display status:'));
        console.log(`  ${chalk.dim(err.message)}`);
        console.log('');
        process.exit(1);
    }
}

// Helpers for string formatting/alignment
function formatRow(cat, pri, cit, gap, trend) {
    return `${cat.padEnd(16)} │ ${pri.padEnd(10)} │ ${cit.padEnd(23)} │ ${gap.padEnd(19)} │ ${trend}`;
}

function formatRowPage(id, url, status, cit, gap) {
    return `${id.padEnd(14)} │ ${url.padEnd(20)} │ ${status.padEnd(8)} │ ${cit.padEnd(23)} │ ${gap.padEnd(19)}`;
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
    if (isNaN(num)) return chalk.dim(str);
    
    if (num >= 20) return chalk.green.bold(str);
    if (num >= 5) return chalk.yellow.bold(str);
    return chalk.red.bold(str);
}

function colorGap(val, str) {
    if (val === null || val === undefined) return chalk.dim(str);
    const num = parseInt(val, 10);
    if (isNaN(num)) return chalk.dim(str);

    if (num < 30) return chalk.green.bold(str);
    if (num <= 70) return chalk.yellow.bold(str);
    return chalk.red.bold(str);
}
