import fs from 'fs-extra';
import path from 'path';
import YAML from 'yaml';

/**
 * Parses the SEO.md file in the specified directory.
 * Returns both the plain JavaScript object and the YAML Document (for comment preservation).
 * 
 * @param {string} [cwd=process.cwd()] - Current working directory
 * @returns {Promise<{doc: YAML.Document, data: any}>} Parsed SEO.md representation
 */
export async function parseSeoMd(cwd = process.cwd()) {
    const seomdPath = path.join(cwd, 'SEO.md');
    
    if (!(await fs.pathExists(seomdPath))) {
        throw new Error(`SEO.md not found at ${seomdPath}. Run 'seomd init' first.`);
    }
    
    const content = await fs.readFile(seomdPath, 'utf8');
    
    try {
        const doc = YAML.parseDocument(content);
        const data = doc.toJS();
        
        if (!data || typeof data !== 'object') {
            throw new Error('SEO.md is empty or invalid YAML structure');
        }
        
        return { doc, data };
    } catch (err) {
        throw new Error(`Failed to parse SEO.md: ${err.message}`);
    }
}

/**
 * Writes the YAML Document back to SEO.md in the specified directory.
 * 
 * @param {YAML.Document} doc - The YAML Document to write
 * @param {string} [cwd=process.cwd()] - Current working directory
 * @returns {Promise<void>}
 */
export async function writeSeoMd(doc, cwd = process.cwd()) {
    const seomdPath = path.join(cwd, 'SEO.md');
    const content = doc.toString();
    await fs.writeFile(seomdPath, content, 'utf8');
}
