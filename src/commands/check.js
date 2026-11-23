import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { parseSeoMd, getPages } from '../utils/parser.js';

import { AI_BOTS } from '../utils/constants.js';

// Blocking these removes a site from AI or web search answers
const SEARCH_BOTS = ['OAI-SearchBot', 'ChatGPT-User', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Googlebot', 'Bingbot'];
const TRAINING_BOTS = AI_BOTS.filter((b) => b.purpose === 'training').map((b) => b.userAgent);

/**
 * Inspects HTML content for core SEO/AEO signals.
 */
export function auditHtmlContent(html, urlLabel, negativeKeywords = []) {
    const errors = [];
    const warnings = [];

    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : '';
    if (!title) {
        errors.push({ target: urlLabel, rule: 'title', message: 'Missing <title> tag' });
    } else if (title.length > 70) {
        warnings.push({ target: urlLabel, rule: 'title', message: `<title> is ${title.length} chars (recommended <= 70)` });
    }

    const metaDescMatch =
        html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i) ||
        html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["'][^>]*>/i);
    const metaDesc = metaDescMatch ? metaDescMatch[1].trim() : '';
    if (!metaDesc) {
        warnings.push({ target: urlLabel, rule: 'meta-description', message: 'Missing <meta name="description">' });
    } else if (metaDesc.length < 50 || metaDesc.length > 165) {
        warnings.push({
            target: urlLabel,
            rule: 'meta-description',
            message: `Meta description is ${metaDesc.length} chars (recommended 50-160)`,
        });
    }

    const h1Matches = html.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/gi) || [];
    if (h1Matches.length === 0) {
        errors.push({ target: urlLabel, rule: 'h1', message: 'Missing <h1> heading' });
    } else if (h1Matches.length > 1) {
        warnings.push({ target: urlLabel, rule: 'h1', message: `Found ${h1Matches.length} <h1> tags (recommended 1)` });
    }

    const hasCanonical = /<link[^>]+rel=["']canonical["'][^>]*>/i.test(html);
    if (!hasCanonical) {
        warnings.push({ target: urlLabel, rule: 'canonical', message: 'Missing <link rel="canonical">' });
    }

    const jsonLdMatches = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    if (jsonLdMatches.length === 0) {
        warnings.push({ target: urlLabel, rule: 'json-ld', message: 'No JSON-LD structured data (<script type="application/ld+json">) found' });
    } else {
        for (const m of jsonLdMatches) {
            try {
                JSON.parse(m[1].trim());
            } catch {
                errors.push({ target: urlLabel, rule: 'json-ld', message: 'Invalid JSON inside <script type="application/ld+json">' });
            }
        }
    }

    // Check negative keywords in title/H1 (high-signal dilution check)
    if (Array.isArray(negativeKeywords) && negativeKeywords.length > 0) {
        const headingText = `${title} ${h1Matches.join(' ')}`.toLowerCase();
        for (const neg of negativeKeywords) {
            const term = String(neg || '').trim().toLowerCase();
            if (term && headingText.includes(term)) {
                warnings.push({
                    target: urlLabel,
                    rule: 'negative-keyword',
                    message: `Title/H1 contains negative keyword '${neg}' declared in SEO.md`,
                });
            }
        }
    }

    return { errors, warnings };
}

/**
 * Checks robots.txt against SEO.md crawl settings:
 *   - allow_ai_bots (default true): AI search crawlers must not be blocked
 *   - ai_training (allow | block): training crawlers may be blocked, or must be when 'block'
 */
export function auditRobotsTxt(robotsContent, allowAiBots = true, aiTraining = 'allow') {
    const errors = [];
    const warnings = [];
    const blockedBots = new Set();

    const blocks = robotsContent.split(/\r?\n\s*\r?\n/);
    for (const block of blocks) {
        const lines = block
            .split(/\r?\n/)
            .map((l) => l.replace(/#.*$/, '').trim())
            .filter(Boolean);
        const agents = lines
            .filter((l) => /^user-agent:/i.test(l))
            .map((l) => l.split(':')[1]?.trim().toLowerCase());
        const disallowsRoot = lines.some((l) => /^disallow:\s*\/\s*$/i.test(l));

        if (!disallowsRoot) continue;
        for (const agent of agents) blockedBots.add(agent);
    }

    if (allowAiBots) {
        const mustAllow = aiTraining === 'block' ? SEARCH_BOTS : [...SEARCH_BOTS, ...TRAINING_BOTS];
        for (const bot of mustAllow) {
            if (!blockedBots.has(bot.toLowerCase())) continue;
            const isTraining = TRAINING_BOTS.includes(bot);
            errors.push({
                target: 'robots.txt',
                rule: 'ai-bots',
                message: isTraining
                    ? `${bot} is blocked (Disallow: /) but SEO.md allows AI training. Set crawl.ai_training: block if that's intended.`
                    : `${bot} is blocked (Disallow: /), which keeps the site out of that engine's search answers (crawl.allow_ai_bots: true)`,
            });
        }
    }

    if (aiTraining === 'block') {
        for (const bot of TRAINING_BOTS) {
            if (!blockedBots.has(bot.toLowerCase())) {
                warnings.push({
                    target: 'robots.txt',
                    rule: 'ai-training',
                    message: `crawl.ai_training is block, but ${bot} is not disallowed`,
                });
            }
        }
    }

    return { errors, warnings };
}

async function collectHtmlFiles(dir, baseDir, out = [], depth = 0) {
    if (depth > 4 || out.length >= 50) return out;
    let entries;
    try {
        entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
        return out;
    }

    for (const entry of entries) {
        if (entry.isDirectory()) {
            if (['node_modules', '.git', '.seo', '.next'].includes(entry.name)) continue;
            await collectHtmlFiles(path.join(dir, entry.name), baseDir, out, depth + 1);
        } else if (entry.name.endsWith('.html')) {
            const fullPath = path.join(dir, entry.name);
            out.push({
                fullPath,
                relPath: path.relative(baseDir, fullPath) || entry.name,
            });
        }
    }
    return out;
}

export async function checkCommand(target, options = {}) {
    try {
        const cwd = process.cwd();
        const { data } = await parseSeoMd(cwd);
        const negativeKeywords = Array.isArray(data.keywords?.negative) ? data.keywords.negative : [];
        const allowAiBots = data.crawl?.allow_ai_bots !== false;
        const aiTraining = data.crawl?.ai_training === 'block' ? 'block' : 'allow';

        const errors = [];
        const warnings = [];
        let checkedPages = 0;

        const isUrl = typeof target === 'string' && /^https?:\/\//i.test(target);

        if (isUrl) {
            // Crawl files always live at the site origin. A URL with a path audits just that page;
            // a bare origin audits every live page declared in SEO.md.
            const parsedTarget = new URL(target);
            const baseUrl = parsedTarget.origin;
            const targetPath = parsedTarget.pathname.replace(/\/+$/, '');

            // Check robots.txt
            try {
                const res = await fetch(`${baseUrl}/robots.txt`);
                if (res.ok) {
                    const text = await res.text();
                    const r = auditRobotsTxt(text, allowAiBots, aiTraining);
                    errors.push(...r.errors);
                    warnings.push(...r.warnings);
                } else {
                    warnings.push({ target: `${baseUrl}/robots.txt`, rule: 'robots', message: `robots.txt returned HTTP ${res.status}` });
                }
            } catch (err) {
                warnings.push({ target: `${baseUrl}/robots.txt`, rule: 'robots', message: `Could not fetch robots.txt: ${err.message}` });
            }

            // Check llms.txt if declared
            if (data.crawl?.llms_txt) {
                try {
                    const res = await fetch(`${baseUrl}${data.crawl.llms_txt}`);
                    if (!res.ok) {
                        warnings.push({ target: `${baseUrl}${data.crawl.llms_txt}`, rule: 'llms-txt', message: `llms.txt returned HTTP ${res.status}` });
                    }
                } catch {
                    warnings.push({ target: `${baseUrl}${data.crawl.llms_txt}`, rule: 'llms-txt', message: 'Could not fetch llms.txt' });
                }
            }

            // Audit concrete pages from SEO.md (or homepage fallback)
            const pages = getPages(data).filter((p) => p.url && !p.url.includes('[') && p.status !== 'planned');
            const toFetch = targetPath
                ? [{ id: 'target', url: `${targetPath}${parsedTarget.search}` }]
                : pages.length > 0 ? pages : [{ id: 'homepage', url: '/' }];

            for (const page of toFetch) {
                const pageUrl = `${baseUrl}${page.url === '/' ? '' : page.url}`;
                try {
                    const res = await fetch(pageUrl);
                    if (!res.ok) {
                        errors.push({ target: page.url, rule: 'http-status', message: `Page returned HTTP ${res.status}` });
                        continue;
                    }
                    const html = await res.text();
                    const r = auditHtmlContent(html, page.url, negativeKeywords);
                    errors.push(...r.errors);
                    warnings.push(...r.warnings);
                    checkedPages += 1;
                } catch (err) {
                    errors.push({ target: page.url, rule: 'network', message: `Failed to fetch ${pageUrl}: ${err.message}` });
                }
            }
        } else {
            // Local directory audit
            const targetDir = target ? path.resolve(cwd, target) : cwd;
            if (!(await fs.pathExists(targetDir))) {
                throw new Error(`Target directory not found: ${targetDir}`);
            }

            // Locate robots.txt & llms.txt in targetDir or public/
            const candidateDirs = [targetDir, path.join(targetDir, 'public'), path.join(cwd, 'public')];
            let foundRobots = false;
            let foundLlms = false;

            for (const dir of candidateDirs) {
                const robotsPath = path.join(dir, 'robots.txt');
                if (!foundRobots && (await fs.pathExists(robotsPath))) {
                    foundRobots = true;
                    const robotsContent = await fs.readFile(robotsPath, 'utf8');
                    const r = auditRobotsTxt(robotsContent, allowAiBots, aiTraining);
                    errors.push(...r.errors);
                    warnings.push(...r.warnings);
                }
                const llmsPath = path.join(dir, 'llms.txt');
                if (!foundLlms && (await fs.pathExists(llmsPath))) {
                    foundLlms = true;
                }
            }

            if (!foundRobots) {
                warnings.push({ target: 'robots.txt', rule: 'robots', message: 'robots.txt not found (run `npx seomd-cli generate robots --out public/robots.txt`)' });
            }
            if (data.crawl?.llms_txt && !foundLlms) {
                warnings.push({ target: 'llms.txt', rule: 'llms-txt', message: 'llms.txt not found (run `npx seomd-cli generate llms --out public/llms.txt`)' });
            }

            // Audit any HTML files under targetDir
            const htmlFiles = await collectHtmlFiles(targetDir, targetDir);
            for (const file of htmlFiles) {
                const html = await fs.readFile(file.fullPath, 'utf8');
                const r = auditHtmlContent(html, file.relPath, negativeKeywords);
                errors.push(...r.errors);
                warnings.push(...r.warnings);
                checkedPages += 1;
            }
        }

        const failed = errors.length > 0 || (Boolean(options.strict) && warnings.length > 0);

        if (options.json) {
            console.log(
                JSON.stringify(
                    {
                        passed: !failed,
                        checked_pages: checkedPages,
                        errors,
                        warnings,
                    },
                    null,
                    2
                )
            );
            process.exitCode = failed ? 1 : 0;
            return;
        }

        console.log('');
        console.log(chalk.bold('SEO.md Local Check') + chalk.dim(` (${checkedPages} HTML page(s) inspected)`));
        console.log('');

        if (errors.length > 0) {
            console.log(chalk.red.bold(`  Errors (${errors.length}):`));
            for (const err of errors) {
                console.log(`    ${chalk.red('✗')} ${err.message} ${chalk.dim(`[${err.target}]`)}`);
            }
            console.log('');
        }

        if (warnings.length > 0) {
            console.log(chalk.yellow.bold(`  Warnings (${warnings.length}):`));
            for (const warn of warnings) {
                console.log(`    ${chalk.yellow('⚠')} ${warn.message} ${chalk.dim(`[${warn.target}]`)}`);
            }
            console.log('');
        }

        if (!failed) {
            console.log(chalk.green.bold(`✓ Check passed (${errors.length} error(s), ${warnings.length} warning(s)).`));
        } else {
            console.log(chalk.red.bold(`✗ Check failed (${errors.length} error(s), ${warnings.length} warning(s)).`));
        }
        console.log('');
        process.exitCode = failed ? 1 : 0;
    } catch (err) {
        if (options.json) {
            console.log(JSON.stringify({ passed: false, error: err.message }, null, 2));
        } else {
            console.log(chalk.red(`✗ Check failed: ${err.message}`));
        }
        process.exitCode = 1;
    }
}
