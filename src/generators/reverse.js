import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Generates the content of the seo.reverse.md file by reading the corresponding site type template
 * and substituting placeholders.
 * 
 * @param {any} answers - Scaffolding inputs (brand, domain, primary_keyword, site_type, competitors)
 * @returns {string} The filled template content
 */
export function generateReverseMd(answers) {
    const { site_type, domain, brand, competitors } = answers;
    const competitorList = Array.isArray(competitors) ? competitors : [];

    // Resolve template file path
    const templatePath = path.join(__dirname, '../templates', site_type, 'SEO.REVERSE.md');

    if (!fs.existsSync(templatePath)) {
        throw new Error(`Template not found for site type: ${site_type}`);
    }

    let content = fs.readFileSync(templatePath, 'utf8');

    const date = new Date().toISOString().split('T')[0];
    const brandLower = brand.toLowerCase();
    const brandSnake = brandLower.replace(/\s+/g, '_');
    const primaryCompetitor = competitorList[0] || '[competitor]';

    // Formatting YAML blocks for competitors
    let reverseCompetitors = '';
    if (competitorList.length > 0) {
        reverseCompetitors = competitorList.map(c => `  - domain: ${c}
    overall_citation_rate: null
    strongest_intent_category: null
    weakest_intent_category: null
    top_cited_pages: []
    citation_patterns: []
    last_analyzed: null`).join('\n\n');
    } else {
        reverseCompetitors = `  - domain: [competitor]
    overall_citation_rate: null
    strongest_intent_category: null
    weakest_intent_category: null
    top_cited_pages: []
    citation_patterns: []
    last_analyzed: null`;
    }

    // Perform simple string replacements
    content = content
        .replaceAll('{{brand}}', brand)
        .replaceAll('{{brand_lower_snake}}', brandSnake)
        .replaceAll('{{domain}}', domain)
        .replaceAll('{{primary_competitor}}', primaryCompetitor)
        .replaceAll('{{date}}', date)
        .replaceAll('{{reverse_competitors}}', reverseCompetitors);

    return content;
}