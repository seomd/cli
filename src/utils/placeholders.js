// Template text that `seomd init` writes into SEO.md for the founder to replace.
// Anything that matches must never be published into robots/llms/schema output.
const PLACEHOLDER_PATTERN = /\b(replace with|add real|add concrete)\b/i;

export function isPlaceholder(text) {
    return typeof text === 'string' && PLACEHOLDER_PATTERN.test(text);
}

/**
 * Reads a `- **Label:** value` fact line from the SEO.md Markdown body.
 * Returns null when the fact is missing or still holds template text.
 */
export function getFact(body, label) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = String(body || '').match(new RegExp(`\\*\\*${escaped}:\\*\\*\\s*(.+)`, 'i'));
    if (!match) return null;
    const value = match[1].trim();
    return value && !isPlaceholder(value) ? value : null;
}

/**
 * Lists the `- **Label:**` fact lines in the body that still hold template text.
 * @returns {string[]} labels, e.g. ['One-liner', 'Pricing / offer']
 */
export function findPlaceholders(body) {
    const labels = [];
    for (const match of String(body || '').matchAll(/\*\*([^*]+?):\*\*\s*(.+)/g)) {
        if (isPlaceholder(match[2])) labels.push(match[1].trim());
    }
    return labels;
}
