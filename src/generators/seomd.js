import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getBrandName(domain) {
    return domain
        .replace(/^(https?:\/\/)?(www\.)?/, '')
        .replace(/\.[a-z]{2,6}(\.[a-z]{2,6})?$/i, '');
}

/**
 * Generates the content of the seo.md file by reading the corresponding site type template
 * and substituting placeholders.
 * 
 * @param {any} answers - Scaffolding inputs (brand, domain, primary_keyword, site_type, competitors)
 * @returns {string} The filled template content
 */
export function generateSeoMd(answers) {
    const { site_type, domain, brand, primary_keyword, competitors } = answers;
    const competitorList = Array.isArray(competitors) ? competitors : [];

    // Resolve template file path
    const templatePath = path.join(__dirname, '../templates', site_type, 'SEO.md');

    if (!fs.existsSync(templatePath)) {
        throw new Error(`Template not found for site type: ${site_type}`);
    }

    let content = fs.readFileSync(templatePath, 'utf8');

    const date = new Date().toISOString().split('T')[0];
    const brandLower = brand.toLowerCase();
    const brandSnake = brandLower.replace(/\s+/g, '_');

    // Formatting YAML blocks for competitors
    const competitorTerms = competitorList.map(c => `    - "${getBrandName(c)} alternative"`).join('\n') || '    []';
    const comparisonQueries = competitorList.map(c => `      - "${getBrandName(c)} vs ${brandLower}"`).join('\n') || `      - "${brandLower} vs [competitor]"`;
    const toMonitor = competitorList.map(c => `    - ${c}`).join('\n') || '    []';

    // Perform simple string replacements
    content = content
        .replaceAll('{{brand}}', brand)
        .replaceAll('{{brand_lower}}', brandLower)
        .replaceAll('{{brand_lower_snake}}', brandSnake)
        .replaceAll('{{domain}}', domain)
        .replaceAll('{{primary_keyword}}', primary_keyword)
        .replaceAll('{{date}}', date)
        .replaceAll('{{competitor_terms}}', competitorTerms)
        .replaceAll('{{competitors_comparison_queries}}', comparisonQueries)
        .replaceAll('{{competitors_to_monitor}}', toMonitor);

    return content;
}