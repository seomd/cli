import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { parseSeoMd, getBrand, getPages } from '../utils/parser.js';
import { AI_BOTS, SCHEMA_TYPES } from '../utils/constants.js';
import { getFact, findPlaceholders } from '../utils/placeholders.js';

const VALID_TARGETS = ['robots', 'llms', 'schema'];

export function buildRobotsTxt(data) {
    const domain = data.site?.domain || 'example.com';
    const canonical = (data.site?.canonical || `https://${domain}`).replace(/\/$/, '');
    const crawl = data.crawl || {};
    const allowAi = crawl.allow_ai_bots !== false;
    const blockTraining = crawl.ai_training === 'block';
    const disallow = Array.isArray(crawl.disallow) ? crawl.disallow : ['/admin', '/api/*'];
    const sitemap = crawl.sitemap || '/sitemap.xml';

    const lines = [
        `# robots.txt generated from SEO.md — https://seomd.dev`,
        '',
        'User-agent: *',
        'Allow: /',
        ...disallow.map((d) => `Disallow: ${d}`),
        '',
    ];

    // A crawler with its own group ignores the `*` group, so each group repeats the site-wide
    // disallows; otherwise naming a bot would open /admin, /api/* etc. to it.
    if (allowAi) {
        lines.push(blockTraining ? '# AI search crawlers and user-request fetchers' : '# AI search, training and user-request crawlers');
        for (const bot of AI_BOTS) {
            if (blockTraining && bot.purpose === 'training') continue;
            lines.push(`User-agent: ${bot.userAgent}`);
            lines.push(`Allow: ${bot.allow}`);
            lines.push(...disallow.map((d) => `Disallow: ${d}`));
            lines.push('');
        }
    }

    if (blockTraining) {
        lines.push('# AI training crawlers (crawl.ai_training: block). Search visibility is unaffected.');
        for (const bot of AI_BOTS.filter((b) => b.purpose === 'training')) {
            lines.push(`User-agent: ${bot.userAgent}`);
            lines.push('Disallow: /');
            lines.push('');
        }
    }

    lines.push(`Sitemap: ${sitemap.startsWith('http') ? sitemap : `${canonical}${sitemap}`}`);
    lines.push('');

    return lines.join('\n');
}

export function buildLlmsTxt(data, body = '') {
    const brand = getBrand(data);
    const domain = data.site?.domain || 'example.com';
    const canonical = (data.site?.canonical || `https://${domain}`).replace(/\/$/, '');
    const primaryKeyword = data.keywords?.primary || '';
    const pages = getPages(data);

    // Use the founder's one-liner from the Markdown body, unless it is still init's template text
    const summary = getFact(body, 'One-liner')
        || `${brand} (${domain}) — ${primaryKeyword || 'official documentation and product pages'}.`;

    const lines = [
        `# ${brand}`,
        '',
        `> ${summary}`,
        '',
        '## Key Pages',
        '',
    ];

    const concretePages = pages.filter((p) => p.url && !p.url.includes('['));
    if (concretePages.length > 0) {
        for (const page of concretePages) {
            const fullUrl = `${canonical}${page.url === '/' ? '' : page.url}`;
            const label = page.primary_keyword ? `${page.id} — ${page.primary_keyword}` : page.id;
            lines.push(`- [${label}](${fullUrl})`);
        }
    } else {
        lines.push(`- [Homepage](${canonical})`);
    }

    const secondary = Array.isArray(data.keywords?.secondary) ? data.keywords.secondary : [];
    if (primaryKeyword || secondary.length > 0) {
        lines.push('');
        lines.push('## Topics');
        lines.push('');
        if (primaryKeyword) lines.push(`- ${primaryKeyword}`);
        for (const kw of secondary) {
            lines.push(`- ${kw}`);
        }
    }

    lines.push('');
    return lines.join('\n');
}

export function buildSchemaJsonLd(data, body = '') {
    const brand = getBrand(data);
    const domain = data.site?.domain || 'example.com';
    const canonical = (data.site?.canonical || `https://${domain}`).replace(/\/$/, '');
    const siteType = data.site?.type || 'saas';
    const types = Array.isArray(data.schema?.types) && data.schema.types.length > 0
        ? data.schema.types
        : (SCHEMA_TYPES[siteType] || SCHEMA_TYPES.saas);

    const graph = [];

    if (types.includes('Organization')) {
        graph.push({
            '@type': 'Organization',
            name: brand,
            url: canonical,
        });
    }

    if (types.includes('SoftwareApplication')) {
        graph.push({
            '@type': 'SoftwareApplication',
            name: brand,
            applicationCategory: 'BusinessApplication',
            url: canonical,
        });
    }

    if (types.includes('LocalBusiness')) {
        graph.push({
            '@type': 'LocalBusiness',
            name: brand,
            url: canonical,
        });
    }

    if (types.includes('WebSite')) {
        graph.push({
            '@type': 'WebSite',
            name: brand,
            url: canonical,
        });
    }

    // Only emit an FAQ answer the founder actually wrote; never publish template text as a fact
    const oneLiner = getFact(body, 'One-liner');
    if (types.includes('FAQPage') && oneLiner) {
        graph.push({
            '@type': 'FAQPage',
            mainEntity: [
                {
                    '@type': 'Question',
                    name: `What is ${brand}?`,
                    acceptedAnswer: {
                        '@type': 'Answer',
                        text: oneLiner,
                    },
                },
            ],
        });
    }

    if (graph.length === 0) {
        graph.push({
            '@type': 'WebPage',
            name: brand,
            url: canonical,
        });
    }

    return JSON.stringify(
        {
            '@context': 'https://schema.org',
            '@graph': graph,
        },
        null,
        2
    ) + '\n';
}

export async function generateCommand(target, options = {}) {
    const normalizedTarget = String(target || '').trim().toLowerCase();

    if (!VALID_TARGETS.includes(normalizedTarget)) {
        console.log(chalk.red(`✗ Unknown generate target '${target}'. Valid targets: ${VALID_TARGETS.join(', ')}`));
        process.exitCode = 1;
        return;
    }

    try {
        const cwd = process.cwd();
        const { data, body } = await parseSeoMd(cwd);

        // llms.txt and JSON-LD draw on the Canonical Product Facts; flag any still left as template text
        const placeholders = normalizedTarget === 'robots' ? [] : findPlaceholders(body);
        if (placeholders.length > 0) {
            const list = placeholders.join(', ');
            if (options.strict) {
                console.error(chalk.red(`✗ SEO.md still has template text in: ${list}. Fill in Canonical Product Facts, then re-run.`));
                process.exitCode = 1;
                return;
            }
            console.error(chalk.yellow(`⚠ SEO.md still has template text in: ${list}. Those facts were left out of the ${normalizedTarget} output.`));
        }

        let output = '';
        if (normalizedTarget === 'robots') {
            output = buildRobotsTxt(data);
        } else if (normalizedTarget === 'llms') {
            output = buildLlmsTxt(data, body);
        } else if (normalizedTarget === 'schema') {
            output = buildSchemaJsonLd(data, body);
        }

        if (options.out) {
            const outPath = path.resolve(cwd, options.out);
            await fs.ensureDir(path.dirname(outPath));
            await fs.writeFile(outPath, output, 'utf8');
            console.log(chalk.green(`✓ Generated ${normalizedTarget} -> ${path.relative(cwd, outPath) || outPath}`));
        } else {
            process.stdout.write(output);
        }
        process.exitCode = 0;
    } catch (err) {
        console.log(chalk.red(`✗ Generate failed: ${err.message}`));
        process.exitCode = 1;
    }
}
