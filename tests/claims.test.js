import { getClaims, auditClaims, auditPlaceholders, visibleBlocks } from '../src/utils/claims.js';

const claims = getClaims({
    claims: {
        prices: ['$0', '$99', '$0.08'],
        forbidden: ['SOC 2 certified', 'real-time', 'unlimited', 'free trial', 'Chargebee'],
    },
});
const page = (body, jsonLd) =>
    `<html><head>${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ''}</head><body>${body}</body></html>`;
const audit = (body, jsonLd) => auditClaims(page(body, jsonLd), '/pricing', claims);

describe('claims: prices', () => {
    test('listed prices pass, including thousands separators and decimals', () => {
        const r = audit('<p>Starter $0/month.</p><p>Growth $99 per month, then $0.08 per 1,000 events.</p>');
        expect(r.errors).toEqual([]);
    });

    test('an invented plan price is an error, quoted as written', () => {
        const r = audit('<li>Pro</li><li>$49 per month</li><li>$0.20 per additional 1,000 events</li>');
        expect(r.errors.map((e) => e.message.split(' ')[0])).toEqual(['$49', '$0.20']);
    });

    test('invented prices in JSON-LD offers are caught, once per amount', () => {
        const r = audit('<p>$49 per month</p>', { '@type': 'SoftwareApplication', offers: [{ '@type': 'Offer', price: '49' }, { '@type': 'Offer', price: '99' }] });
        expect(r.errors).toHaveLength(1);
    });

    test('a worked example built from listed prices is a warning, not an error', () => {
        const r = audit('<p>For example, 1,500,000 events costs $99 + (500 × $0.08) = $139.</p>');
        expect(r.errors).toEqual([]);
        expect(r.warnings[0].message).toContain('worked example');
    });

    test('no claims means no price checks', () => {
        expect(auditClaims(page('<p>$49</p>'), '/', getClaims({}))).toEqual({ errors: [], warnings: [] });
    });
});

describe('claims: forbidden phrases', () => {
    test('asserting a forbidden claim is an error with the sentence', () => {
        const r = audit('<li>Unlimited projects</li><p>Invoices are created in real time.</p>');
        expect(r.errors.map((e) => e.rule)).toEqual(['claims-forbidden', 'claims-forbidden']);
        expect(r.errors[0].message).toContain('Invoices are created in real time.');
    });

    test('negated mentions and questions pass', () => {
        const r = audit(
            '<h3>Is there a free trial?</h3><p>There is no free trial; Starter is the free plan.</p>'
            + '<p>Acme is not yet SOC 2 certified.</p><p>Invoices run hourly (not in real time).</p>'
            + '<p>We do not integrate with Chargebee.</p>',
        );
        expect(r.errors).toEqual([]);
    });

    test('a negation in a neighboring element does not excuse a claim', () => {
        const r = audit('<li>No setup fees</li><li>Unlimited meters</li>');
        expect(r.errors).toHaveLength(1);
    });

    test('hyphen and space variants match ("real-time", "real time")', () => {
        expect(audit('<p>Real-time billing for APIs.</p>').errors).toHaveLength(1);
    });
});

describe('placeholders', () => {
    test('TBD, TODO and lorem ipsum on a page are errors', () => {
        expect(auditPlaceholders(page('<p>Growth</p><p>TBD</p>'), '/pricing')[0].message).toContain('TBD');
        expect(auditPlaceholders(page('<p>Lorem ipsum dolor sit amet</p>'), '/')).toHaveLength(1);
    });

    test('scripts and normal copy are ignored', () => {
        const html = page('<p>Coming soon: usage alerts.</p><script>// TODO remove</script>');
        expect(auditPlaceholders(html, '/')).toEqual([]);
    });
});

test('visibleBlocks keeps elements separate and drops scripts', () => {
    expect(visibleBlocks('<ul><li>No fees</li><li>Unlimited</li></ul><script>x</script>')).toEqual(['No fees', 'Unlimited']);
});
