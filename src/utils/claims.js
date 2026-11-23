// Fact checks for rendered pages, driven by the `claims` block in SEO.md frontmatter:
//
//   claims:
//     prices: ["$0", "$99", "$0.08"]   # the only prices a page may show (HTML text and JSON-LD offers)
//     forbidden:                        # phrases a page must never assert
//       - SOC 2 certified
//       - real-time
//       - unlimited
//
// A forbidden phrase is allowed in a question ("Is there a free trial?") and when a negation comes
// shortly before it in the same sentence ("There is no free trial", "not yet SOC 2 certified"),
// because that is how a correct page says it. Everything else is reported with the sentence, so a
// person can review it.

const CURRENCY_SYMBOLS = '$€£';
const PRICE_RE = new RegExp(`([${CURRENCY_SYMBOLS}])\\s?(\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.(\\d+))?`, 'g');
const NEGATION_RE = /\b(no|not|never|without|none|neither|nor|isn't|aren't|don't|doesn't|won't|can't|cannot)\b/i;
const NEGATION_WINDOW_WORDS = 8;
// A sentence that shows its arithmetic or says "for example" is a worked example, not a new price
const WORKED_EXAMPLE_RE = /[+×*=]|\bfor example\b|\be\.g\.|\bfor instance\b/i;
// Unfinished copy that should never reach a rendered page
const PLACEHOLDER_RE = /\b(TBD|TODO|FIXME|lorem ipsum)\b|\[insert [^\]]*\]/i;

function parsePrice(text) {
    const m = String(text).trim().match(new RegExp(`^([${CURRENCY_SYMBOLS}])?\\s?(\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.(\\d+))?$`));
    if (!m) return null;
    const value = Number(`${m[2].replace(/,/g, '')}.${m[3] || '0'}`);
    return { symbol: m[1] || null, value };
}

function priceLabel({ symbol, value }) {
    return `${symbol || ''}${value}`;
}

/**
 * Reads `claims` from SEO.md data. Returns null when there is nothing to check.
 */
export function getClaims(data) {
    const raw = data?.claims;
    if (!raw || typeof raw !== 'object') return null;
    const prices = (Array.isArray(raw.prices) ? raw.prices : [])
        .map((p) => parsePrice(p))
        .filter(Boolean);
    const forbidden = (Array.isArray(raw.forbidden) ? raw.forbidden : [])
        .map((f) => String(f || '').trim())
        .filter(Boolean);
    if (prices.length === 0 && forbidden.length === 0) return null;
    return { prices, forbidden };
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', hellip: '…' };

function decodeEntities(text) {
    return text
        .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
        .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
        .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

/**
 * Visible text of a page split into blocks (paragraphs, list items, cells, headings), so a
 * sentence never runs across two elements. Scripts, styles and comments are dropped.
 */
export function visibleBlocks(html) {
    const body = String(html)
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1>/gi, ' ')
        .replace(/<(br|hr)\b[^>]*>/gi, '\n')
        .replace(/<\/(p|li|dt|dd|td|th|tr|h[1-6]|div|section|article|header|footer|blockquote|figcaption|summary|details|button|label)>/gi, '\n')
        .replace(/<[^>]+>/g, ' ');
    return decodeEntities(body)
        .split('\n')
        .map((b) => b.replace(/\s+/g, ' ').trim())
        .filter(Boolean);
}

function excerpt(text, index, length) {
    const start = Math.max(0, index - 70);
    const end = Math.min(text.length, index + length + 70);
    return `${start > 0 ? '...' : ''}${text.slice(start, end)}${end < text.length ? '...' : ''}`;
}

function sentencesOf(block) {
    return block.split(/(?<=[.!?])\s+/).filter(Boolean);
}

function phraseRegex(phrase) {
    // "real-time" also matches "real time" and "realtime"; matching is case-insensitive and whole-word
    const words = phrase
        .split(/[\s-]+/)
        .filter(Boolean)
        .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return new RegExp(`(^|[^\\p{L}\\p{N}])(${words.join('[\\s-]?')})(?=$|[^\\p{L}\\p{N}])`, 'giu');
}

function isNegatedOrAsked(sentence, matchIndex) {
    if (sentence.trim().endsWith('?')) return true;
    const before = sentence.slice(0, matchIndex).split(/\s+/).slice(-NEGATION_WINDOW_WORDS).join(' ');
    return NEGATION_RE.test(before);
}

function collectJsonLdPrices(node, out) {
    if (Array.isArray(node)) {
        node.forEach((n) => collectJsonLdPrices(n, out));
    } else if (node && typeof node === 'object') {
        for (const [key, value] of Object.entries(node)) {
            if (['price', 'lowPrice', 'highPrice', 'minPrice', 'maxPrice'].includes(key)) {
                const p = parsePrice(typeof value === 'number' ? String(value) : String(value ?? ''));
                if (p) out.push(p);
            } else {
                collectJsonLdPrices(value, out);
            }
        }
    }
}

/**
 * Checks a rendered page against SEO.md claims. Returns { errors, warnings }.
 */
export function auditClaims(html, urlLabel, claims) {
    const errors = [];
    const warnings = [];
    if (!claims) return { errors, warnings };

    const blocks = visibleBlocks(html);

    if (claims.prices.length > 0) {
        const allowed = claims.prices;
        const isAllowed = (p) => allowed.some((a) => a.value === p.value && (!a.symbol || !p.symbol || a.symbol === p.symbol));
        const allowedLabel = allowed.map(priceLabel).join(', ');
        const seen = new Set();
        const report = (p, label, where, context, workedExample = false) => {
            // one report per amount, whether it appears in the text, JSON-LD or both
            if (isAllowed(p) || seen.has(p.value)) return;
            seen.add(p.value);
            if (workedExample) {
                warnings.push({
                    target: urlLabel,
                    rule: 'claims-price',
                    message: `${label} ${where} looks like a worked example from listed prices; check the math: "${context}"`,
                });
                return;
            }
            errors.push({
                target: urlLabel,
                rule: 'claims-price',
                message: `${label} ${where} isn't in claims.prices (${allowedLabel})${context ? `: "${context}"` : ''}`,
            });
        };
        for (const block of blocks) {
            for (const sentence of sentencesOf(block)) {
                const found = [...sentence.matchAll(PRICE_RE)].map((m) => ({
                    m,
                    p: { symbol: m[1], value: Number(`${m[2].replace(/,/g, '')}.${m[3] || '0'}`) },
                }));
                const usesListedPrice = found.some(({ p }) => isAllowed(p));
                const worked = usesListedPrice && WORKED_EXAMPLE_RE.test(sentence);
                for (const { m, p } of found) {
                    report(p, m[0].replace(/\s/g, ''), 'on the page', excerpt(sentence, m.index, m[0].length), worked);
                }
            }
        }
        for (const m of String(html).matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
            try {
                const found = [];
                collectJsonLdPrices(JSON.parse(m[1].trim()), found);
                found.forEach((p) => report(p, priceLabel(p), 'in JSON-LD', ''));
            } catch {
                // invalid JSON-LD is reported by the structural audit
            }
        }
    }

    for (const phrase of claims.forbidden) {
        const re = phraseRegex(phrase);
        for (const block of blocks) {
            let hit = null;
            for (const sentence of sentencesOf(block)) {
                for (const m of sentence.matchAll(re)) {
                    const index = m.index + m[1].length;
                    if (!isNegatedOrAsked(sentence, index)) {
                        hit = sentence;
                        break;
                    }
                }
                if (hit) break;
            }
            if (hit) {
                errors.push({
                    target: urlLabel,
                    rule: 'claims-forbidden',
                    message: `Forbidden claim "${phrase}" (claims.forbidden): "${hit.length > 160 ? `${hit.slice(0, 157)}...` : hit}"`,
                });
                break; // one report per phrase per page
            }
        }
    }

    return { errors, warnings };
}

/**
 * Flags unfinished copy (TBD, TODO, FIXME, lorem ipsum, [insert ...]) on a rendered page.
 * Runs on every page, with or without `claims`.
 */
const QUOTES = `"'“”‘’\``;

export function auditPlaceholders(html, urlLabel) {
    for (const block of visibleBlocks(html)) {
        const m = block.match(PLACEHOLDER_RE);
        // A quoted placeholder ("TBD") is prose talking about one, not unfinished copy
        const before = m ? block[m.index - 1] : undefined;
        const after = m ? block[m.index + m[0].length] : undefined;
        const quoted = Boolean(before && after && QUOTES.includes(before) && QUOTES.includes(after));
        if (m && !quoted) {
            return [{
                target: urlLabel,
                rule: 'placeholder',
                message: `Placeholder text "${m[0]}" on the page: "${excerpt(block, m.index, m[0].length)}"`,
            }];
        }
    }
    return [];
}
