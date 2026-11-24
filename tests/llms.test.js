import { buildLlmsTxt, pageLabel } from '../src/commands/generate.js';

const data = {
    site: { domain: 'example.com', brand: 'Example' },
    keywords: { primary: 'example tool' },
    pages: [
        { id: 'pricing', url: '/pricing', status: 'live', priority: 2, title: 'Pricing', description: 'Plans from $0 to $99 a month.' },
        { id: 'homepage', url: '/', status: 'live', priority: 1, keyword: 'example tool' },
        { id: 'features-ai-audits', url: '/features/ai-audits', status: 'live', priority: 3, keyword: 'What is an AI audit?' },
        { id: 'integrations', url: '/integrations', status: 'planned', priority: 4 },
    ],
};

describe('llms.txt', () => {
    const out = buildLlmsTxt(data, '');

    test('uses page titles and descriptions, in priority order', () => {
        const links = out.split('\n').filter((l) => l.startsWith('- ['));
        expect(links).toEqual([
            '- [Home](https://example.com)',
            '- [Pricing](https://example.com/pricing): Plans from $0 to $99 a month.',
            '- [Features: AI audits](https://example.com/features/ai-audits)',
        ]);
    });

    test('leaves out planned pages, which would 404', () => {
        expect(out).not.toContain('/integrations');
    });

    test('labels fall back to a readable form of the URL', () => {
        expect(pageLabel({ id: 'developer-api', url: '/features/developer-api' })).toBe('Features: developer API');
        expect(pageLabel({ id: 'x', url: '/', title: '  Start here ' })).toBe('Start here');
    });
});
