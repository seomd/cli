import fs from 'fs-extra';
import path from 'path';

export const MARKER_START = '<!-- seomd:start -->';
export const MARKER_END = '<!-- seomd:end -->';

export const AGENT_INSTRUCTION_BLOCK = `${MARKER_START}
## SEO & AI Citation Rules (\`SEO.md\`)

Before creating or editing public-facing pages, landing pages, metadata, JSON-LD schema, or marketing copy:
1. Read \`SEO.md\` at the repository root for canonical product facts, target buyer prompts, page rules, and forbidden claims.
2. Check \`.seo/pages/<page-id>.md\` and \`.seo/REVERSE.md\` (if present) for page-specific citation gaps and playbooks.
3. Run \`npx seomd-cli validate\` (and \`npx seomd-cli check\` against built output or localhost) to verify SEO/AEO compliance.
${MARKER_END}`;

const AGENT_FILES = ['AGENTS.md', 'CLAUDE.md'];

/**
 * Wires SEO.md instructions into existing AGENTS.md / CLAUDE.md files.
 * If neither exists, creates a minimal AGENTS.md with the SEO.md pointer.
 * Idempotent: updates existing marker block in place if already wired.
 *
 * @param {string} cwd - Project root directory
 * @returns {Promise<{ updated: string[], created: string[] }>}
 */
export async function wireAgentFiles(cwd) {
    const updated = [];
    const created = [];

    const existing = [];
    for (const fileName of AGENT_FILES) {
        const filePath = path.join(cwd, fileName);
        if (await fs.pathExists(filePath)) {
            existing.push({ fileName, filePath });
        }
    }

    if (existing.length === 0) {
        const agentsPath = path.join(cwd, 'AGENTS.md');
        const content = `# AGENTS.md\n\n${AGENT_INSTRUCTION_BLOCK}\n`;
        await fs.writeFile(agentsPath, content, 'utf8');
        created.push('AGENTS.md');
        return { updated, created };
    }

    const blockRegex = new RegExp(
        `${escapeRegex(MARKER_START)}[\\s\\S]*?${escapeRegex(MARKER_END)}`,
        'm'
    );

    // Claude Code projects often keep a CLAUDE.md that just imports AGENTS.md (`@AGENTS.md`).
    // Wiring both would give the agent the same block twice, so wire AGENTS.md only.
    const hasAgentsMd = existing.some((f) => f.fileName === 'AGENTS.md');
    const IMPORTS_AGENTS_MD = /^\s*@(\.\/)?AGENTS\.md\s*$/m;

    for (const { fileName, filePath } of existing) {
        const current = await fs.readFile(filePath, 'utf8');
        if (fileName === 'CLAUDE.md' && hasAgentsMd && IMPORTS_AGENTS_MD.test(current)) {
            // Remove a block an earlier version added, then leave the import alone
            const stripped = current.replace(blockRegex, '').replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '\n');
            if (stripped !== current) await fs.writeFile(filePath, stripped, 'utf8');
            continue;
        }
        let next;

        if (blockRegex.test(current)) {
            next = current.replace(blockRegex, AGENT_INSTRUCTION_BLOCK);
        } else {
            const sep = current.endsWith('\n\n') ? '' : current.endsWith('\n') ? '\n' : '\n\n';
            next = `${current}${sep}${AGENT_INSTRUCTION_BLOCK}\n`;
        }

        if (next !== current) {
            await fs.writeFile(filePath, next, 'utf8');
        }
        updated.push(fileName);
    }

    return { updated, created };
}

/**
 * Checks whether AGENTS.md or CLAUDE.md exists and references SEO.md.
 *
 * @param {string} cwd
 * @returns {Promise<{ filesFound: string[], wiredFiles: string[] }>}
 */
export async function inspectAgentWiring(cwd) {
    const filesFound = [];
    const wiredFiles = [];

    for (const fileName of AGENT_FILES) {
        const filePath = path.join(cwd, fileName);
        if (await fs.pathExists(filePath)) {
            filesFound.push(fileName);
            const content = await fs.readFile(filePath, 'utf8');
            if (content.includes(MARKER_START) || content.includes('SEO.md')) {
                wiredFiles.push(fileName);
            }
        }
    }

    return { filesFound, wiredFiles };
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
