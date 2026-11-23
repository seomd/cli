import fs from 'fs-extra';
import path from 'path';
import YAML from 'yaml';

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n([\s\S]*))?$/;

/**
 * Parses SEO.md in the specified directory.
 * Supports both:
 *   - v2: Markdown with YAML frontmatter (`--- ... ---`)
 *   - v1 (legacy): Raw YAML document with `#` comment headings
 *
 * @param {string} [cwd=process.cwd()] - Directory containing SEO.md
 * @returns {Promise<{format: 'v2'|'v1', doc: YAML.Document, data: any, body: string, raw: string, filePath: string}>}
 */
export async function parseSeoMd(cwd = process.cwd()) {
    const filePath = path.join(cwd, 'SEO.md');

    if (!(await fs.pathExists(filePath))) {
        throw new Error(`SEO.md not found at ${filePath}. Run 'npx seomd-cli init' first.`);
    }

    const raw = await fs.readFile(filePath, 'utf8');
    const match = raw.match(FRONTMATTER_REGEX);

    try {
        if (match) {
            const frontmatterText = match[1];
            const body = (match[2] || '').trim();
            const doc = YAML.parseDocument(frontmatterText);
            if (doc.errors && doc.errors.length > 0) {
                throw new Error(doc.errors[0].message);
            }
            const data = doc.toJS();
            if (!data || typeof data !== 'object') {
                throw new Error('SEO.md frontmatter is empty or not a valid YAML object');
            }
            return { format: 'v2', doc, data, body, raw, filePath };
        }

        // Legacy v1 raw YAML
        const doc = YAML.parseDocument(raw);
        if (doc.errors && doc.errors.length > 0) {
            throw new Error(doc.errors[0].message);
        }
        const data = doc.toJS();
        if (!data || typeof data !== 'object') {
            throw new Error('SEO.md is empty or invalid YAML structure');
        }
        return { format: 'v1', doc, data, body: '', raw, filePath };
    } catch (err) {
        throw new Error(`Failed to parse SEO.md: ${err.message}`);
    }
}

/**
 * Extracts normalized brand name from v1 or v2 SEO.md data.
 */
export function getBrand(data) {
    return data?.site?.brand || data?.identity?.brand || 'My Brand';
}

/**
 * Extracts normalized page list from v2 (`pages: [...]`) or v1 (`pages.required` + `pages.optional`).
 */
export function getPages(data) {
    if (!data?.pages) return [];

    let rawPages = [];
    if (Array.isArray(data.pages)) {
        rawPages = data.pages;
    } else {
        if (Array.isArray(data.pages.required)) {
            rawPages = rawPages.concat(data.pages.required);
        }
        if (Array.isArray(data.pages.optional)) {
            rawPages = rawPages.concat(data.pages.optional);
        }
    }

    return rawPages
        .filter((p) => p && typeof p === 'object')
        .map((p) => ({
            ...p,
            primary_keyword: p.primary_keyword || p.keyword || null,
            status: p.status || 'planned',
            priority: p.priority ?? 0,
        }));
}

/**
 * Extracts normalized intent queries map from v1 or v2 SEO.md data.
 */
export function getIntentQueries(data, filterCategory = null) {
    const queries = {};
    if (!data?.intent || typeof data.intent !== 'object') return queries;

    const filterLower = filterCategory ? String(filterCategory).trim().toLowerCase() : null;

    for (const [intentType, obj] of Object.entries(data.intent)) {
        if (intentType === '_analysis') continue;
        if (filterLower && intentType.toLowerCase() !== filterLower) continue;

        if (Array.isArray(obj)) {
            queries[intentType] = obj;
        } else if (obj && Array.isArray(obj.queries)) {
            queries[intentType] = obj.queries;
        }
    }

    return queries;
}

/**
 * Extracts normalized competitor domains from v1 or v2 SEO.md data.
 */
export function getCompetitors(data) {
    const raw = data?.competitors ?? data?.aeo?.competitors_to_monitor ?? [];
    if (!Array.isArray(raw)) return [];
    return raw
        .map((c) => (typeof c === 'string' ? c : c?.domain))
        .filter(Boolean);
}

/**
 * Extracts provider configuration from v2 (`provider`) or v1 (`platform`).
 */
export function getProviderConfig(data) {
    const p = data?.provider || data?.platform || {};
    return {
        name: p.name || p.provider || null,
        endpoint: p.endpoint || p.url || null,
        project_id: p.project_id || null,
    };
}
