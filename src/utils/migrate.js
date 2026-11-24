import fs from 'fs-extra';
import path from 'path';
import { getBrand, getCompetitors, getIntentQueries, getPages, getProviderConfig } from './parser.js';
import { VALID_SITE_TYPES } from './constants.js';

function cleanList(value) {
    if (!Array.isArray(value)) return [];
    return value.map((v) => (typeof v === 'string' ? v.trim() : v)).filter(Boolean);
}

function domainFrom(data) {
    const raw = data?.site?.domain || data?.site?.canonical || '';
    return String(raw)
        .trim()
        .replace(/^<|>$/g, '')
        .replace(/^https?:\/\//i, '')
        .replace(/\/+$/, '') || null;
}

/**
 * Pulls the founder-declared values out of an existing SEO.md (v1 or v2) so that
 * re-running `init` upgrades the file instead of replacing it with a blank template.
 *
 * Returns init answers (only the fields that were actually set) plus `carry`,
 * the curated lists the generator should keep instead of regenerating.
 *
 * @param {object} data - Parsed SEO.md data (from parseSeoMd)
 */
export function seedFromExisting(data) {
    if (!data || typeof data !== 'object') return { answers: {}, carry: {} };

    const answers = {};
    const siteType = data?.site?.type;
    if (VALID_SITE_TYPES.includes(siteType)) answers.site_type = siteType;

    const domain = domainFrom(data);
    if (domain) answers.domain = domain;

    const brand = getBrand(data);
    if (brand && brand !== 'My Brand') answers.brand = String(brand).trim();

    const primary = data?.keywords?.primary;
    if (typeof primary === 'string' && primary.trim()) answers.primary_keyword = primary.trim();

    const competitors = getCompetitors(data);
    if (competitors.length > 0) answers.competitors = competitors;

    const provider = getProviderConfig(data);
    if (provider.name) answers.provider = provider.name;

    const carry = {};
    const secondary = cleanList(data?.keywords?.secondary);
    if (secondary.length > 0) carry.secondary = secondary;
    const negative = cleanList(data?.keywords?.negative);
    if (negative.length > 0) carry.negative = negative;
    if (data?.site?.locale) carry.locale = data.site.locale;
    if (data?.provider?.endpoint || data?.platform?.endpoint) carry.providerEndpoint = getProviderConfig(data).endpoint;
    const tagline = data?.identity?.tagline || data?.site?.tagline;
    if (typeof tagline === 'string' && tagline.trim()) carry.tagline = tagline.trim();

    if (data?.claims && typeof data.claims === 'object') carry.claims = data.claims;

    // Intent: keep curated queries + priorities per category (drop provider `_analysis` blocks)
    const queries = getIntentQueries(data);
    const intent = {};
    for (const [category, list] of Object.entries(queries)) {
        const cleaned = cleanList(list).filter((q) => typeof q === 'string');
        if (cleaned.length === 0) continue;
        const priority = data.intent?.[category]?.priority;
        intent[category] = { ...(priority ? { priority } : {}), queries: cleaned };
    }
    if (Object.keys(intent).length > 0) carry.intent = intent;

    // Pages: keep declared pages with their keywords and status
    const pages = getPages(data)
        .filter((p) => p.url)
        .map((p) => ({
            id: p.id || null,
            url: p.url,
            status: p.status || 'planned',
            priority: p.priority ?? null,
            keyword: p.primary_keyword || null,
            ...(p.title ? { title: p.title } : {}),
            ...(p.description ? { description: p.description } : {}),
        }));
    if (pages.length > 0) carry.pages = pages;

    return { answers, carry };
}

/**
 * Copies SEO.md to SEO.md.bak (or SEO.md.bak.<timestamp> if a backup already exists).
 * @returns {Promise<string>} the backup file name
 */
export async function backupSeoMd(workingDir) {
    const src = path.join(workingDir, 'SEO.md');
    let name = 'SEO.md.bak';
    if (await fs.pathExists(path.join(workingDir, name))) {
        name = `SEO.md.bak.${new Date().toISOString().replace(/[:.]/g, '-')}`;
    }
    await fs.copy(src, path.join(workingDir, name));
    return name;
}
