import YAML from 'yaml';
import {
    SPEC_VERSION,
    INTENT_PRIORITIES,
    REQUIRED_PAGES,
    SCHEMA_TYPES,
    SITE_TYPE_PROFILES,
    VALID_SITE_TYPES,
} from '../utils/constants.js';
import { routeToPageId } from '../utils/repo-scanner.js';

function getBrandNameFromDomain(domain) {
    return String(domain || '')
        .replace(/^(https?:\/\/)?(www\.)?/i, '')
        .replace(/\/.*$/, '')
        .replace(/\.[a-z]{2,6}(\.[a-z]{2,6})?$/i, '');
}

/**
 * Normalizes a domain string by stripping protocol, leading/trailing slashes, and whitespace.
 */
export function normalizeDomain(domain) {
    return String(domain || '')
        .trim()
        .replace(/^<|>$/g, '')
        .replace(/^https?:\/\//i, '')
        .replace(/\/+$/, '');
}

/**
 * Generates a v2.0.0 SEO.md file (YAML frontmatter + agent-readable Markdown body).
 * Safely serializes all user inputs via YAML.stringify (zero YAML injection).
 *
 * @param {object} answers
 * @param {object} [repoInfo] - Optional output from scanRepo()
 * @returns {string}
 */
export function generateSeoMd(answers, repoInfo = null) {
    const siteType = answers.site_type || 'saas';
    if (!VALID_SITE_TYPES.includes(siteType)) {
        throw new Error(`Invalid site type '${siteType}'. Must be one of: ${VALID_SITE_TYPES.join(', ')}`);
    }

    const profile = SITE_TYPE_PROFILES[siteType];
    const priorities = INTENT_PRIORITIES[siteType];
    const domain = normalizeDomain(answers.domain || 'example.com');
    const brand = String(answers.brand || 'My Brand').trim();
    const brandLower = brand.toLowerCase();
    const primaryKeyword = String(answers.primary_keyword || profile.defaultKeyword).trim();
    const competitorList = Array.isArray(answers.competitors)
        ? answers.competitors.map(normalizeDomain).filter(Boolean)
        : [];
    const year = new Date().getFullYear();
    // Founder-curated values carried over from an existing SEO.md (v1 or v2) on re-init
    const carry = answers.carry || {};

    // Build intent queries tailored to site type
    const comparisonQueries = competitorList.length > 0
        ? [
            ...competitorList.map((c) => `${getBrandNameFromDomain(c)} vs ${brandLower}`),
            profile.comparisonSuffix(primaryKeyword),
        ]
        : [
            `${brandLower} alternatives`,
            profile.comparisonSuffix(primaryKeyword),
        ];

    const intent = {
        informational: {
            priority: priorities.informational,
            queries: [
                `what is ${primaryKeyword}`,
                `how does ${primaryKeyword} work`,
            ],
        },
        comparison: {
            priority: priorities.comparison,
            queries: comparisonQueries,
        },
        transactional: {
            priority: priorities.transactional,
            queries: profile.transactionalQueries(brandLower),
        },
        reputational: {
            priority: priorities.reputational,
            queries: [
                `${brandLower} reviews`,
                `is ${brandLower} legit`,
            ],
        },
        category: {
            priority: priorities.category,
            queries: profile.categoryQuery(primaryKeyword, year),
        },
    };
    if (carry.intent) {
        for (const [category, kept] of Object.entries(carry.intent)) {
            intent[category] = {
                priority: kept.priority || intent[category]?.priority || 'medium',
                queries: kept.queries,
            };
        }
    }

    // Merge discovered live routes with recommended site-type pages
    const recommendedPages = REQUIRED_PAGES[siteType] || REQUIRED_PAGES.saas;
    const discoveredRoutes = Array.isArray(repoInfo?.routes) ? repoInfo.routes : [];
    const discoveredSet = new Set(discoveredRoutes.map((r) => r.toLowerCase()));

    const pages = [];
    const seenUrls = new Set();
    const seenIds = new Set();

    // Pages declared in an existing SEO.md come first, keeping their keywords
    for (const kept of carry.pages || []) {
        const urlKey = kept.url.toLowerCase();
        if (seenUrls.has(urlKey)) continue;
        let id = kept.id || routeToPageId(kept.url);
        if (seenIds.has(id)) id = `${id}-${pages.length + 1}`;
        pages.push({
            id,
            url: kept.url,
            status: discoveredSet.has(urlKey) ? 'live' : kept.status,
            priority: kept.priority ?? pages.length + 1,
            keyword: kept.keyword,
        });
        seenUrls.add(urlKey);
        seenIds.add(id);
    }

    // Then add recommended pages (marking as 'live' if discovered in repo)
    for (const rec of recommendedPages) {
        if (seenUrls.has(rec.url.toLowerCase())) continue;
        const isLive = discoveredSet.has(rec.url.toLowerCase());
        pages.push({
            id: rec.id,
            url: rec.url,
            status: isLive ? 'live' : 'planned',
            priority: carry.pages ? pages.length + 1 : rec.priority,
            keyword: rec.url === '/' ? primaryKeyword : null,
        });
        seenUrls.add(rec.url.toLowerCase());
        seenIds.add(rec.id);
    }

    // Then append any additional discovered live routes (capped at 20 total to keep manifest concise)
    let nextPriority = Math.max(0, ...pages.map((p) => Number(p.priority) || 0)) + 1;
    for (const route of discoveredRoutes) {
        if (pages.length >= 20) break;
        if (seenUrls.has(route.toLowerCase())) continue;
        let id = routeToPageId(route);
        if (seenIds.has(id)) {
            id = `${id}-${nextPriority}`;
        }
        pages.push({
            id,
            url: route,
            status: 'live',
            priority: nextPriority++,
            keyword: null,
        });
        seenUrls.add(route.toLowerCase());
        seenIds.add(id);
    }

    const frontmatter = {
        spec: SPEC_VERSION,
        site: {
            brand,
            domain,
            canonical: `https://${domain}`,
            type: siteType,
            locale: carry.locale || 'en-US',
        },
        keywords: {
            primary: primaryKeyword,
            secondary: carry.secondary || [],
            negative: carry.negative || profile.negativeKeywords,
        },
        competitors: competitorList.map((c) => ({ domain: c })),
        intent,
        pages,
        schema: {
            types: SCHEMA_TYPES[siteType] || SCHEMA_TYPES.saas,
        },
        crawl: {
            sitemap: '/sitemap.xml',
            robots: '/robots.txt',
            llms_txt: '/llms.txt',
            allow_ai_bots: true,
            disallow: profile.disallow,
        },
        provider: {
            name: answers.provider || null,
            endpoint: carry.providerEndpoint || null,
        },
    };

    const yamlBlock = YAML.stringify(frontmatter, { lineWidth: 100 }).trimEnd();

    const rulesMarkdown = profile.agentRules.map((rule) => `- ${rule}`).join('\n');
    const negativeMarkdown = frontmatter.keywords.negative.map((kw) => `\`${kw}\``).join(', ');
    const promptLines = [
        `- **Category:** ${intent.category.queries.map((q) => `"${q}"`).join(', ')}`,
        `- **Comparison:** ${intent.comparison.queries.map((q) => `"${q}"`).join(', ')}`,
        `- **Transactional:** ${intent.transactional.queries.map((q) => `"${q}"`).join(', ')}`,
    ].join('\n');

    const body = `# SEO.md — ${brand}

> Open standard for search & AI-citation configuration (spec v${SPEC_VERSION} — https://seomd.dev).
> Coding agents: read this file and matching playbooks in \`.seo/pages/\` before creating or editing public pages.

## Canonical Product Facts
- **One-liner:** ${carry.tagline ? `${brand} — ${carry.tagline}` : `${brand} — replace with a clear, factual 1-sentence description of what you offer.`}
- **Primary category:** ${primaryKeyword}
- **Pricing / offer:** Add real pricing or offer facts here so coding agents never invent vague copy.
- **Proof points:** Add concrete, verifiable metrics, certifications, or customer outcomes.

## Target Buyer Prompts (AI Search)
${promptLines}

## Page & AEO Rules (For Coding Agents)
${rulesMarkdown}

## Do Not Claim
- Avoid diluting intent with negative terms: ${negativeMarkdown}.
- Never fabricate competitor pricing, benchmarks, or unverified customer quotes.

## Live Intelligence
- Metrics & gap scores: \`.seo/STATUS.yml\`
- Competitor reverse-engineering: \`.seo/REVERSE.md\`
- Per-page playbooks: \`.seo/pages/<id>.md\`
`;

    return `---\n${yamlBlock}\n---\n\n${body}`;
}
