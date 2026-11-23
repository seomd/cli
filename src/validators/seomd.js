import { findPlaceholders } from '../utils/placeholders.js';
import {
    VALID_SITE_TYPES,
    INTENT_CATEGORIES,
    VALID_PRIORITIES,
    VALID_PAGE_STATUSES,
} from '../utils/constants.js';

/**
 * Validates a parsed SEO.md configuration object against spec v2.0 (or legacy v1.0).
 *
 * @param {any} data - Parsed YAML data (frontmatter in v2, full doc in v1)
 * @param {{ format?: 'v2'|'v1', body?: string }} [meta] - Optional parser metadata
 * @returns {{ errors: Array<{path: string, message: string}>, warnings: Array<{path: string, message: string}>, specVersion: string }}
 */
export function validateSeoMd(data, meta = {}) {
    const errors = [];
    const warnings = [];

    if (!data || typeof data !== 'object') {
        errors.push({ path: '', message: 'Specification must be a valid YAML object' });
        return { errors, warnings, specVersion: 'unknown' };
    }

    const isV2 =
        meta.format === 'v2' ||
        (typeof data.spec === 'string' && data.spec.startsWith('2')) ||
        Array.isArray(data.pages);

    if (isV2) {
        validateV2(data, meta.body || '', errors, warnings);
        return { errors, warnings, specVersion: String(data.spec || '2.0.0') };
    }

    validateV1(data, errors, warnings);
    return { errors, warnings, specVersion: '1.0' };
}

function validatePageEntry(page, prefix, seenIds, errors) {
    if (!page || typeof page !== 'object') {
        errors.push({ path: prefix, message: `Page entry at ${prefix} must be an object` });
        return;
    }

    if (!page.id || typeof page.id !== 'string') {
        errors.push({ path: `${prefix}.id`, message: `Page at ${prefix} is missing a valid 'id'` });
    } else if (seenIds.has(page.id)) {
        errors.push({ path: `${prefix}.id`, message: `Duplicate page id '${page.id}'` });
    } else {
        seenIds.add(page.id);
    }

    if (!page.url || typeof page.url !== 'string') {
        errors.push({ path: `${prefix}.url`, message: `Page '${page.id || prefix}' is missing 'url'` });
    } else if (!page.url.startsWith('/')) {
        errors.push({ path: `${prefix}.url`, message: `Page '${page.id || prefix}' url '${page.url}' must start with '/'` });
    }

    if (!page.status) {
        errors.push({ path: `${prefix}.status`, message: `Page '${page.id || prefix}' is missing 'status'` });
    } else if (!VALID_PAGE_STATUSES.includes(page.status)) {
        errors.push({
            path: `${prefix}.status`,
            message: `Invalid status '${page.status}' for page '${page.id || prefix}'. Must be one of: ${VALID_PAGE_STATUSES.join(', ')}`,
        });
    }

    if (page.priority === undefined || page.priority === null) {
        errors.push({ path: `${prefix}.priority`, message: `Page '${page.id || prefix}' is missing 'priority'` });
    } else if (typeof page.priority !== 'number') {
        errors.push({ path: `${prefix}.priority`, message: `Priority for page '${page.id || prefix}' must be a number` });
    }
}

function validateDomain(domain, errors, warnings) {
    if (!domain) {
        errors.push({ path: 'site.domain', message: 'site.domain is required' });
    } else if (typeof domain !== 'string') {
        errors.push({ path: 'site.domain', message: 'site.domain must be a string' });
    } else if (/^https?:\/\//i.test(domain) || domain.includes('/')) {
        warnings.push({
            path: 'site.domain',
            message: `site.domain '${domain}' should be a bare hostname (e.g. 'example.com') without protocol or path`,
        });
    }
}

function validateCanonical(canonical, errors) {
    if (canonical === undefined || canonical === null) return;
    if (typeof canonical !== 'string') {
        errors.push({ path: 'site.canonical', message: 'site.canonical must be a string' });
    } else if (!/^https?:\/\/.+/i.test(canonical)) {
        errors.push({ path: 'site.canonical', message: `site.canonical '${canonical}' must be a full http(s) URL` });
    }
}

function validateV2(data, body, errors, warnings) {
    if (!data.spec) {
        warnings.push({ path: 'spec', message: "Missing 'spec' version field in frontmatter (recommended: '2.0.0')" });
    }

    // 1. Required top-level keys
    for (const section of ['site', 'keywords', 'pages']) {
        if (!(section in data) || data[section] === null || data[section] === undefined) {
            errors.push({ path: section, message: `Missing required frontmatter section: '${section}'` });
        }
    }

    if (errors.some((e) => ['site', 'keywords', 'pages'].includes(e.path))) {
        return;
    }

    // 2. site
    const site = data.site;
    if (typeof site !== 'object') {
        errors.push({ path: 'site', message: 'site must be an object' });
    } else {
        const brand = site.brand || data.identity?.brand;
        if (!brand || typeof brand !== 'string') {
            errors.push({ path: 'site.brand', message: 'site.brand is required' });
        }

        if (!site.type) {
            errors.push({ path: 'site.type', message: 'site.type is required' });
        } else if (!VALID_SITE_TYPES.includes(site.type)) {
            errors.push({
                path: 'site.type',
                message: `Invalid site.type '${site.type}'. Must be one of: ${VALID_SITE_TYPES.join(', ')}`,
            });
        }

        validateDomain(site.domain, errors, warnings);
        validateCanonical(site.canonical, errors);
    }

    // 3. keywords
    const keywords = data.keywords;
    if (typeof keywords !== 'object') {
        errors.push({ path: 'keywords', message: 'keywords must be an object' });
    } else {
        if (!keywords.primary || typeof keywords.primary !== 'string' || !keywords.primary.trim()) {
            errors.push({ path: 'keywords.primary', message: 'keywords.primary is required' });
        }
        if (keywords.secondary !== undefined && !Array.isArray(keywords.secondary)) {
            errors.push({ path: 'keywords.secondary', message: 'keywords.secondary must be an array' });
        } else if (!keywords.secondary || keywords.secondary.length === 0) {
            warnings.push({ path: 'keywords.secondary', message: 'keywords.secondary is empty. Consider adding secondary terms.' });
        }
        if (keywords.negative !== undefined && !Array.isArray(keywords.negative)) {
            errors.push({ path: 'keywords.negative', message: 'keywords.negative must be an array' });
        }
    }

    // 4. pages
    const seenIds = new Set();
    if (!Array.isArray(data.pages)) {
        errors.push({ path: 'pages', message: 'pages must be an array in spec v2' });
    } else if (data.pages.length === 0) {
        errors.push({ path: 'pages', message: 'pages array cannot be empty' });
    } else {
        data.pages.forEach((page, index) => {
            validatePageEntry(page, `pages[${index}]`, seenIds, errors);
        });
    }

    // 5. intent (optional in v2, validated if present)
    if (data.intent !== undefined && data.intent !== null) {
        if (typeof data.intent !== 'object') {
            errors.push({ path: 'intent', message: 'intent must be an object' });
        } else {
            for (const [cat, catData] of Object.entries(data.intent)) {
                if (cat === '_analysis') continue;
                if (!INTENT_CATEGORIES.includes(cat)) {
                    warnings.push({
                        path: `intent.${cat}`,
                        message: `Unrecognized intent category '${cat}'. Standard categories: ${INTENT_CATEGORIES.join(', ')}`,
                    });
                }
                if (!catData || typeof catData !== 'object') {
                    errors.push({ path: `intent.${cat}`, message: `intent.${cat} must be an object` });
                    continue;
                }
                if (catData.priority && !VALID_PRIORITIES.includes(String(catData.priority).toLowerCase())) {
                    errors.push({
                        path: `intent.${cat}.priority`,
                        message: `Invalid priority '${catData.priority}' for intent.${cat}. Must be one of: ${VALID_PRIORITIES.join(', ')}`,
                    });
                }
                if (catData.queries !== undefined && !Array.isArray(catData.queries)) {
                    errors.push({ path: `intent.${cat}.queries`, message: `intent.${cat}.queries must be an array` });
                } else if (!catData.queries || catData.queries.length === 0) {
                    warnings.push({ path: `intent.${cat}.queries`, message: `intent.${cat}.queries is empty.` });
                }
            }
        }
    }

    // 6. crawl (optional)
    if (data.crawl && typeof data.crawl === 'object') {
        const robots = data.crawl.robots ?? data.crawl.robots_txt;
        if (robots !== undefined && robots !== null && typeof robots !== 'string') {
            errors.push({ path: 'crawl.robots', message: 'crawl.robots must be a string' });
        }
        if (data.crawl.sitemap !== undefined && data.crawl.sitemap !== null && typeof data.crawl.sitemap !== 'string') {
            errors.push({ path: 'crawl.sitemap', message: 'crawl.sitemap must be a string' });
        }
        if (data.crawl.llms_txt !== undefined && data.crawl.llms_txt !== null && typeof data.crawl.llms_txt !== 'string') {
            errors.push({ path: 'crawl.llms_txt', message: 'crawl.llms_txt must be a string' });
        }
        if (data.crawl.ai_training !== undefined && data.crawl.ai_training !== null && !['allow', 'block'].includes(data.crawl.ai_training)) {
            errors.push({ path: 'crawl.ai_training', message: "crawl.ai_training must be 'allow' or 'block'" });
        }
    }

    // 7. provider (optional)
    const provider = data.provider || data.platform || {};
    if (provider.endpoint && typeof provider.endpoint === 'string' && !/^https?:\/\/.+/i.test(provider.endpoint)) {
        errors.push({ path: 'provider.endpoint', message: 'provider.endpoint must be a valid http(s) URL' });
    }

    // 8. Markdown body check
    const placeholders = findPlaceholders(body);
    if (placeholders.length > 0) {
        warnings.push({
            path: 'body',
            message: `Canonical Product Facts still have template text: ${placeholders.join(', ')}. Coding agents and generated llms.txt/JSON-LD need real facts.`,
        });
    }
    if (!body || body.trim().length < 20) {
        warnings.push({
            path: 'body',
            message: 'Markdown body is empty or very short. Add canonical product facts and agent rules so coding agents can act on SEO.md.',
        });
    }
}

function validateV1(data, errors, warnings) {
    const requiredSections = [
        'site',
        'identity',
        'keywords',
        'intent',
        'pages',
        'schema',
        'crawl',
        'performance',
        'monitoring',
    ];

    for (const section of requiredSections) {
        if (!(section in data) || data[section] === null) {
            errors.push({ path: section, message: `Missing required top-level section: '${section}'` });
        }
    }

    if (errors.some((e) => ['site', 'identity', 'keywords', 'intent', 'pages'].includes(e.path))) {
        return;
    }

    // site
    const site = data.site || {};
    if (!site.type) {
        errors.push({ path: 'site.type', message: 'site.type is required' });
    } else if (!VALID_SITE_TYPES.includes(site.type)) {
        errors.push({
            path: 'site.type',
            message: `Invalid site.type '${site.type}'. Must be one of: ${VALID_SITE_TYPES.join(', ')}`,
        });
    }
    validateDomain(site.domain, errors, warnings);
    validateCanonical(site.canonical, errors);

    // identity
    const identity = data.identity || {};
    if (!identity.brand) {
        errors.push({ path: 'identity.brand', message: 'identity.brand is required' });
    } else if (typeof identity.brand !== 'string') {
        errors.push({ path: 'identity.brand', message: 'identity.brand must be a string' });
    }
    if (!identity.tagline) {
        warnings.push({ path: 'identity.tagline', message: 'identity.tagline is missing or empty' });
    }

    // keywords
    const keywords = data.keywords || {};
    if (!keywords.primary) {
        errors.push({ path: 'keywords.primary', message: 'keywords.primary is required' });
    } else if (typeof keywords.primary !== 'string') {
        errors.push({ path: 'keywords.primary', message: 'keywords.primary must be a string' });
    }
    if (!keywords.secondary || !Array.isArray(keywords.secondary) || keywords.secondary.length === 0) {
        warnings.push({ path: 'keywords.secondary', message: 'keywords.secondary is empty. Consider adding target secondary terms.' });
    }
    if (!keywords.negative || !Array.isArray(keywords.negative)) {
        warnings.push({ path: 'keywords.negative', message: 'keywords.negative should be an array of terms to filter out' });
    }
    if (!keywords.long_tail || !Array.isArray(keywords.long_tail) || keywords.long_tail.length === 0) {
        warnings.push({ path: 'keywords.long_tail', message: 'keywords.long_tail is empty. Consider adding long-tail variations.' });
    }

    // intent
    const intent = data.intent || {};
    for (const cat of INTENT_CATEGORIES) {
        const catData = intent[cat];
        if (!catData || typeof catData !== 'object') {
            errors.push({ path: `intent.${cat}`, message: `Missing or invalid intent category: 'intent.${cat}'` });
            continue;
        }
        if (!catData.priority) {
            errors.push({ path: `intent.${cat}.priority`, message: `intent.${cat}.priority is required` });
        } else if (!VALID_PRIORITIES.includes(String(catData.priority).toLowerCase())) {
            errors.push({
                path: `intent.${cat}.priority`,
                message: `Invalid priority '${catData.priority}' for intent.${cat}. Must be one of: ${VALID_PRIORITIES.join(', ')}`,
            });
        }
        if (!catData.queries || !Array.isArray(catData.queries)) {
            errors.push({ path: `intent.${cat}.queries`, message: `intent.${cat}.queries must be an array` });
        } else if (catData.queries.length === 0) {
            warnings.push({ path: `intent.${cat}.queries`, message: `intent.${cat}.queries list is empty. Add queries to track.` });
        }
    }

    // pages
    const pages = data.pages || {};
    const seenIds = new Set();
    if (!pages.required || !Array.isArray(pages.required)) {
        errors.push({ path: 'pages.required', message: 'pages.required must be an array' });
    } else if (pages.required.length === 0) {
        errors.push({ path: 'pages.required', message: 'pages.required array cannot be empty' });
    } else {
        pages.required.forEach((page, index) => {
            validatePageEntry(page, `pages.required[${index}]`, seenIds, errors);
        });
    }
    if (Array.isArray(pages.optional)) {
        pages.optional.forEach((page, index) => {
            validatePageEntry(page, `pages.optional[${index}]`, seenIds, errors);
        });
    }

    // schema
    const schema = data.schema || {};
    if (schema.types && !Array.isArray(schema.types)) {
        errors.push({ path: 'schema.types', message: 'schema.types must be an array' });
    }

    // crawl
    const crawl = data.crawl || {};
    if (crawl.sitemap && typeof crawl.sitemap !== 'string') {
        errors.push({ path: 'crawl.sitemap', message: 'crawl.sitemap must be a string' });
    }
    if (crawl.robots_txt && typeof crawl.robots_txt !== 'string') {
        errors.push({ path: 'crawl.robots_txt', message: 'crawl.robots_txt must be a string' });
    }

    // performance
    const perf = data.performance || {};
    for (const field of ['lcp', 'cls', 'fid', 'inp', 'page_size', 'ttfb']) {
        if (perf[field] !== undefined && perf[field] !== null && typeof perf[field] !== 'string' && typeof perf[field] !== 'number') {
            errors.push({ path: `performance.${field}`, message: `performance.${field} must be a string or number` });
        }
    }

    // authority
    const authority = data.authority || {};
    if (authority.eeat_signals && typeof authority.eeat_signals === 'object') {
        const missingEeat = ['experience', 'expertise', 'authority', 'trust'].filter((f) => !authority.eeat_signals[f]);
        if (missingEeat.length > 0) {
            warnings.push({
                path: 'authority.eeat_signals',
                message: `EEAT signals are missing values for: ${missingEeat.join(', ')}`,
            });
        }
    } else {
        warnings.push({ path: 'authority.eeat_signals', message: 'authority.eeat_signals section is missing. Highly recommended for AEO.' });
    }

    // platform
    const platform = data.platform || {};
    if (!platform.provider) {
        warnings.push({ path: 'platform.provider', message: 'platform.provider is null. Configure a provider for analyze/sync.' });
    }
}
