export const SPEC_VERSION = '2.0.0';

export const SITE_TYPES = [
    { name: 'SaaS / Software', value: 'saas' },
    { name: 'Ecommerce', value: 'ecommerce' },
    { name: 'Local Business', value: 'local' },
    { name: 'Blog / Media', value: 'blog' },
    { name: 'Marketplace', value: 'marketplace' },
];

export const VALID_SITE_TYPES = SITE_TYPES.map((t) => t.value);

export const INTENT_CATEGORIES = [
    'informational',
    'comparison',
    'transactional',
    'reputational',
    'category',
];

export const VALID_PRIORITIES = ['low', 'medium', 'high', 'critical'];

export const VALID_PAGE_STATUSES = ['live', 'draft', 'planned'];

export const INTENT_PRIORITIES = {
    saas: {
        informational: 'medium',
        comparison: 'high',
        transactional: 'high',
        reputational: 'medium',
        category: 'critical',
    },
    ecommerce: {
        informational: 'low',
        comparison: 'high',
        transactional: 'critical',
        reputational: 'high',
        category: 'high',
    },
    local: {
        informational: 'medium',
        comparison: 'medium',
        transactional: 'critical',
        reputational: 'critical',
        category: 'high',
    },
    blog: {
        informational: 'critical',
        comparison: 'medium',
        transactional: 'low',
        reputational: 'medium',
        category: 'high',
    },
    marketplace: {
        informational: 'medium',
        comparison: 'high',
        transactional: 'critical',
        reputational: 'high',
        category: 'high',
    },
};

export const REQUIRED_PAGES = {
    saas: [
        { id: 'homepage', url: '/', priority: 1 },
        { id: 'features', url: '/features', priority: 2 },
        { id: 'pricing', url: '/pricing', priority: 3 },
        { id: 'comparison', url: '/vs/[competitor]', priority: 4 },
        { id: 'alternatives', url: '/alternatives/[competitor]', priority: 5 },
        { id: 'use-cases', url: '/for/[segment]', priority: 6 },
        { id: 'integrations', url: '/integrations', priority: 7 },
        { id: 'docs', url: '/docs', priority: 8 },
        { id: 'blog', url: '/blog', priority: 9 },
    ],
    ecommerce: [
        { id: 'homepage', url: '/', priority: 1 },
        { id: 'category', url: '/[category]', priority: 2 },
        { id: 'product', url: '/products/[slug]', priority: 3 },
        { id: 'collection', url: '/collections/[slug]', priority: 4 },
        { id: 'reviews', url: '/reviews', priority: 5 },
        { id: 'shipping-returns', url: '/shipping-and-returns', priority: 6 },
        { id: 'faq', url: '/faq', priority: 7 },
    ],
    local: [
        { id: 'homepage', url: '/', priority: 1 },
        { id: 'services', url: '/services', priority: 2 },
        { id: 'location', url: '/[city]', priority: 3 },
        { id: 'about', url: '/about', priority: 4 },
        { id: 'reviews', url: '/reviews', priority: 5 },
        { id: 'faq', url: '/faq', priority: 6 },
        { id: 'contact', url: '/contact', priority: 7 },
        { id: 'service-area', url: '/service-area', priority: 8 },
    ],
    blog: [
        { id: 'homepage', url: '/', priority: 1 },
        { id: 'category', url: '/[category]', priority: 2 },
        { id: 'article', url: '/[category]/[slug]', priority: 3 },
        { id: 'author', url: '/author/[slug]', priority: 4 },
        { id: 'about', url: '/about', priority: 5 },
        { id: 'newsletter', url: '/newsletter', priority: 6 },
    ],
    marketplace: [
        { id: 'homepage', url: '/', priority: 1 },
        { id: 'listing', url: '/listings/[slug]', priority: 2 },
        { id: 'category', url: '/[category]', priority: 3 },
        { id: 'seller-profile', url: '/sellers/[slug]', priority: 4 },
        { id: 'how-it-works', url: '/how-it-works', priority: 5 },
        { id: 'pricing', url: '/pricing', priority: 6 },
        { id: 'trust-safety', url: '/trust', priority: 7 },
    ],
};

export const SCHEMA_TYPES = {
    saas: ['SoftwareApplication', 'Organization', 'FAQPage', 'WebPage'],
    ecommerce: ['Product', 'Organization', 'FAQPage', 'BreadcrumbList'],
    local: ['LocalBusiness', 'FAQPage', 'Review', 'GeoCoordinates'],
    blog: ['Article', 'Person', 'FAQPage', 'BreadcrumbList'],
    marketplace: ['WebSite', 'Organization', 'FAQPage', 'Product'],
};

export const SITE_TYPE_PROFILES = {
    saas: {
        defaultKeyword: 'workflow automation software',
        negativeKeywords: ['free download', 'cracked', 'open source clone'],
        disallow: ['/admin', '/api/*', '/app/*', '/dashboard/*'],
        categoryQuery: (kw, year) => [`best ${kw}`, `top ${kw} tools ${year}`],
        comparisonSuffix: (kw) => `best ${kw} for startups`,
        transactionalQueries: (brandLower) => [
            `is ${brandLower} worth it`,
            `${brandLower} pricing`,
            `${brandLower} demo`,
        ],
        agentRules: [
            'Open every key page with a 40-60 word direct answer to the page\'s primary query.',
            'Include a structured FAQ section (minimum 4 questions) with `FAQPage` JSON-LD.',
            'Emit `Organization` and `SoftwareApplication` JSON-LD on core product pages.',
            'Comparison pages (`/vs/*`, `/alternatives/*`) must include a factual feature table — never fabricate competitor pricing.',
        ],
    },
    ecommerce: {
        defaultKeyword: 'specialty coffee beans',
        negativeKeywords: ['wholesale bulk', 'cheap knockoff', 'free sample'],
        disallow: ['/admin', '/api/*', '/cart', '/checkout', '/account/*'],
        categoryQuery: (kw, year) => [`best ${kw}`, `top ${kw} brands ${year}`],
        comparisonSuffix: (kw) => `best ${kw} to buy online`,
        transactionalQueries: (brandLower) => [
            `buy ${brandLower}`,
            `${brandLower} shipping and returns`,
            `${brandLower} discount`,
        ],
        agentRules: [
            'Include clear pricing, availability, materials/specs, and shipping details in plain text on every product page.',
            'Emit `Product` (with `Offer` and `AggregateRating` where real reviews exist) and `BreadcrumbList` JSON-LD.',
            'Never index `/cart`, `/checkout`, or account pages; keep them disallowed in `robots.txt`.',
            'Add concise buying-guide FAQs on category and product pages answering sizing, care, and compatibility questions.',
        ],
    },
    local: {
        defaultKeyword: 'emergency plumbing service',
        negativeKeywords: ['diy', 'jobs', 'careers', 'salary'],
        disallow: ['/admin', '/api/*', '/portal/*'],
        categoryQuery: (kw, year) => [`best ${kw} near me`, `top rated ${kw} ${year}`],
        comparisonSuffix: (kw) => `most reliable ${kw} in my area`,
        transactionalQueries: (brandLower) => [
            `${brandLower} phone number`,
            `${brandLower} hours and pricing`,
            `book ${brandLower}`,
        ],
        agentRules: [
            'Keep Name, Address, Phone (NAP), service areas, and business hours consistent across all pages.',
            'Emit `LocalBusiness` (with `GeoCoordinates` and opening hours) and `FAQPage` JSON-LD.',
            'Give each service and city/location page unique local proof points (never duplicate city-swap boilerplate).',
            'Surface verified customer reviews, licenses, and guarantees near the top of service pages.',
        ],
    },
    blog: {
        defaultKeyword: 'developer productivity',
        negativeKeywords: ['paid ad', 'sponsored spam'],
        disallow: ['/admin', '/api/*', '/drafts/*'],
        categoryQuery: (kw, year) => [`best ${kw} guides`, `top ${kw} resources ${year}`],
        comparisonSuffix: (kw) => `best ${kw} newsletters and blogs`,
        transactionalQueries: (brandLower) => [
            `${brandLower} newsletter`,
            `subscribe to ${brandLower}`,
        ],
        agentRules: [
            'Lead every article with a 2-3 sentence direct takeaway (answer-first format) before deep context.',
            'Include explicit author bio, publish/updated dates, and primary-source citations.',
            'Emit `Article`, `Person` (author), and `BreadcrumbList` JSON-LD on every post.',
            'Use clear H1 -> H2 -> H3 hierarchy and concise summaries/tables that AI engines can quote accurately.',
        ],
    },
    marketplace: {
        defaultKeyword: 'freelance design marketplace',
        negativeKeywords: ['scam', 'free cracked'],
        disallow: ['/admin', '/api/*', '/checkout', '/messages/*', '/account/*'],
        categoryQuery: (kw, year) => [`best ${kw}`, `top ${kw} platforms ${year}`],
        comparisonSuffix: (kw) => `best ${kw} for buyers and sellers`,
        transactionalQueries: (brandLower) => [
            `how does ${brandLower} work`,
            `${brandLower} fees`,
            `is ${brandLower} safe`,
        ],
        agentRules: [
            'Clearly explain both sides of the marketplace (buyer protection, seller fees, verification) on core pages.',
            'Emit `WebSite` (with `SearchAction`), `Organization`, and `Product`/`Offer` JSON-LD on listing pages.',
            'Keep dynamic search/filter parameter URLs canonicalized to clean category pages to avoid crawl bloat.',
            'Include trust, safety, and fee-structure FAQs with `FAQPage` JSON-LD.',
        ],
    },
};

export const PERFORMANCE_THRESHOLDS = {
    lcp: '2.5s',
    cls: '0.1',
    inp: '200ms',
    page_size: '500kb',
    ttfb: '800ms',
};

export const AI_BOTS = [
    { userAgent: 'GPTBot', allow: '/' },
    { userAgent: 'OAI-SearchBot', allow: '/' },
    { userAgent: 'ChatGPT-User', allow: '/' },
    { userAgent: 'ClaudeBot', allow: '/' },
    { userAgent: 'Claude-User', allow: '/' },
    { userAgent: 'Claude-SearchBot', allow: '/' },
    { userAgent: 'anthropic-ai', allow: '/' },
    { userAgent: 'PerplexityBot', allow: '/' },
    { userAgent: 'Perplexity-User', allow: '/' },
    { userAgent: 'cohere-ai', allow: '/' },
    { userAgent: 'MistralAI-User', allow: '/' },
    { userAgent: 'Googlebot', allow: '/' },
    { userAgent: 'Google-Extended', allow: '/' },
    { userAgent: 'Bingbot', allow: '/' },
    { userAgent: 'Meta-ExternalAgent', allow: '/' },
    { userAgent: 'Meta-ExternalFetcher', allow: '/' },
    { userAgent: 'Applebot', allow: '/' },
    { userAgent: 'Applebot-Extended', allow: '/' },
    { userAgent: 'Bytespider', allow: '/' },
    { userAgent: 'Amazonbot', allow: '/' },
    { userAgent: 'CCBot', allow: '/' },
    { userAgent: 'diffbot', allow: '/' },
    { userAgent: 'webzio-extended', allow: '/' },
];
