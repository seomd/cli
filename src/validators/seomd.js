import { SITE_TYPES, INTENT_CATEGORIES } from '../utils/constants.js';

/**
 * Validates a parsed seo.md configuration object against the spec.
 * 
 * @param {any} data - The parsed seo.md JS object
 * @returns {{errors: Array<{path: string, message: string}>, warnings: Array<{path: string, message: string}>}} Validation results
 */
export function validateSeoMd(data) {
    const errors = [];
    const warnings = [];

    if (!data || typeof data !== 'object') {
        errors.push({ path: '', message: 'Specification must be a valid YAML object' });
        return { errors, warnings };
    }

    // 1. Required top-level sections
    const requiredSections = [
        'site',
        'identity',
        'keywords',
        'intent',
        'pages',
        'schema',
        'crawl',
        'performance',
        'monitoring'
    ];

    for (const section of requiredSections) {
        if (!(section in data) || data[section] === null) {
            errors.push({ path: section, message: `Missing required top-level section: '${section}'` });
        }
    }

    // If critical sections are missing, stop early to avoid nested property access errors
    if (errors.some(e => ['site', 'identity', 'keywords', 'intent', 'pages'].includes(e.path))) {
        return { errors, warnings };
    }

    // 2. Validate 'site' section
    const site = data.site || {};
    const validSiteTypes = SITE_TYPES.map(t => t.value);
    
    if (!site.type) {
        errors.push({ path: 'site.type', message: 'site.type is required' });
    } else if (!validSiteTypes.includes(site.type)) {
        errors.push({ 
            path: 'site.type', 
            message: `Invalid site.type '${site.type}'. Must be one of: ${validSiteTypes.join(', ')}` 
        });
    }

    if (!site.domain) {
        errors.push({ path: 'site.domain', message: 'site.domain is required' });
    } else if (typeof site.domain !== 'string') {
        errors.push({ path: 'site.domain', message: 'site.domain must be a string' });
    }

    if (site.canonical && typeof site.canonical !== 'string') {
        errors.push({ path: 'site.canonical', message: 'site.canonical must be a string' });
    }

    // 3. Validate 'identity' section
    const identity = data.identity || {};
    if (!identity.brand) {
        errors.push({ path: 'identity.brand', message: 'identity.brand is required' });
    } else if (typeof identity.brand !== 'string') {
        errors.push({ path: 'identity.brand', message: 'identity.brand must be a string' });
    }

    if (!identity.tagline) {
        warnings.push({ path: 'identity.tagline', message: 'identity.tagline is missing or empty' });
    }

    // 4. Validate 'keywords' section
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

    // 5. Validate 'intent' section
    const intent = data.intent || {};
    for (const cat of INTENT_CATEGORIES) {
        const catData = intent[cat];
        if (!catData || typeof catData !== 'object') {
            errors.push({ path: `intent.${cat}`, message: `Missing or invalid intent category: 'intent.${cat}'` });
            continue;
        }

        const validPriorities = ['low', 'medium', 'high', 'critical'];
        if (!catData.priority) {
            errors.push({ path: `intent.${cat}.priority`, message: `intent.${cat}.priority is required` });
        } else if (!validPriorities.includes(String(catData.priority).toLowerCase())) {
            errors.push({ 
                path: `intent.${cat}.priority`, 
                message: `Invalid priority '${catData.priority}' for intent.${cat}. Must be one of: ${validPriorities.join(', ')}` 
            });
        }

        if (!catData.queries || !Array.isArray(catData.queries)) {
            errors.push({ path: `intent.${cat}.queries`, message: `intent.${cat}.queries must be an array` });
        } else if (catData.queries.length === 0) {
            warnings.push({ path: `intent.${cat}.queries`, message: `intent.${cat}.queries list is empty. Add queries to track.` });
        }
    }

    // 6. Validate 'pages' section
    const pages = data.pages || {};
    if (!pages.required || !Array.isArray(pages.required)) {
        errors.push({ path: 'pages.required', message: 'pages.required must be an array' });
    } else if (pages.required.length === 0) {
        errors.push({ path: 'pages.required', message: 'pages.required array cannot be empty' });
    } else {
        pages.required.forEach((page, index) => {
            const prefix = `pages.required[${index}]`;
            if (!page || typeof page !== 'object') {
                errors.push({ path: prefix, message: `Page entry at index ${index} must be an object` });
                return;
            }

            if (!page.id) {
                errors.push({ path: `${prefix}.id`, message: `Page at index ${index} is missing 'id'` });
            }
            if (!page.url) {
                errors.push({ path: `${prefix}.url`, message: `Page '${page.id || index}' is missing 'url'` });
            }
            
            const validStatus = ['live', 'draft', 'planned'];
            if (!page.status) {
                errors.push({ path: `${prefix}.status`, message: `Page '${page.id || index}' is missing 'status'` });
            } else if (!validStatus.includes(page.status)) {
                errors.push({ 
                    path: `${prefix}.status`, 
                    message: `Invalid status '${page.status}' for page '${page.id || index}'. Must be one of: ${validStatus.join(', ')}` 
                });
            }

            if (page.priority === undefined || page.priority === null) {
                errors.push({ path: `${prefix}.priority`, message: `Page '${page.id || index}' is missing 'priority'` });
            } else if (typeof page.priority !== 'number') {
                errors.push({ path: `${prefix}.priority`, message: `Priority for page '${page.id || index}' must be a number` });
            }
        });
    }

    // 7. Validate 'schema' section
    const schema = data.schema || {};
    if (schema.types && !Array.isArray(schema.types)) {
        errors.push({ path: 'schema.types', message: 'schema.types must be an array' });
    }

    // 8. Validate 'crawl' section
    const crawl = data.crawl || {};
    if (crawl.sitemap && typeof crawl.sitemap !== 'string') {
        errors.push({ path: 'crawl.sitemap', message: 'crawl.sitemap must be a string' });
    }
    if (crawl.robots_txt && typeof crawl.robots_txt !== 'string') {
        errors.push({ path: 'crawl.robots_txt', message: 'crawl.robots_txt must be a string' });
    }

    // 9. Validate 'performance' section
    const perf = data.performance || {};
    const stringFields = ['lcp', 'cls', 'fid', 'page_size', 'ttfb'];
    for (const field of stringFields) {
        if (perf[field] !== undefined && perf[field] !== null && typeof perf[field] !== 'string' && typeof perf[field] !== 'number') {
            errors.push({ path: `performance.${field}`, message: `performance.${field} must be a string or number` });
        }
    }

    // 10. Validate 'authority' section
    const authority = data.authority || {};
    if (authority.eeat_signals) {
        const eeat = authority.eeat_signals;
        if (typeof eeat === 'object') {
            const fields = ['experience', 'expertise', 'authority', 'trust'];
            const missingEeat = fields.filter(f => !eeat[f]);
            if (missingEeat.length > 0) {
                warnings.push({ 
                    path: 'authority.eeat_signals', 
                    message: `EEAT signals are missing values for: ${missingEeat.join(', ')}` 
                });
            }
        }
    } else {
        warnings.push({ path: 'authority.eeat_signals', message: 'authority.eeat_signals section is missing. Highly recommended for AEO.' });
    }

    // 11. Validate 'platform' section
    const platform = data.platform || {};
    if (!platform.provider) {
        warnings.push({ path: 'platform.provider', message: 'platform.provider is null. CLI requires connection for analyze/sync.' });
    }

    return { errors, warnings };
}
