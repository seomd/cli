export const SITE_TYPES = [
    { name: 'SaaS / Software', value: 'saas' },
    { name: 'Ecommerce', value: 'ecommerce' },
    { name: 'Local Business', value: 'local' },
    { name: 'Blog / Media', value: 'blog' },
    { name: 'Marketplace', value: 'marketplace' },
];

export const INTENT_CATEGORIES = [
    'informational',
    'comparison',
    'transactional',
    'reputational',
    'category',
];

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
        { id: 'changelog', url: '/changelog', priority: 8 },
        { id: 'docs', url: '/docs', priority: 9 },
        { id: 'blog', url: '/blog', priority: 10 },
    ],
    ecommerce: [
        { id: 'homepage', url: '/', priority: 1 },
        { id: 'category', url: '/[category]', priority: 2 },
        { id: 'product', url: '/products/[slug]', priority: 3 },
        { id: 'collection', url: '/collections/[slug]', priority: 4 },
        { id: 'reviews', url: '/reviews', priority: 5 },
        { id: 'cart', url: '/cart', priority: 6 },
        { id: 'checkout', url: '/checkout', priority: 7 },
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
        { id: 'search-results', url: '/search', priority: 5 },
        { id: 'how-it-works', url: '/how-it-works', priority: 6 },
        { id: 'pricing', url: '/pricing', priority: 7 },
        { id: 'trust-safety', url: '/trust', priority: 8 },
    ],
};

export const SCHEMA_TYPES = {
    saas: ['SoftwareApplication', 'Organization', 'FAQPage', 'WebPage'],
    ecommerce: ['Product', 'Organization', 'FAQPage', 'BreadcrumbList'],
    local: ['LocalBusiness', 'FAQPage', 'Review', 'GeoCoordinates'],
    blog: ['Article', 'Person', 'FAQPage', 'BreadcrumbList'],
    marketplace: ['WebSite', 'Organization', 'FAQPage', 'Product'],
};

export const PERFORMANCE_THRESHOLDS = {
    lcp: '2.5s',
    cls: '0.1',
    fid: '100ms',
    page_size: '500kb',
    time_to_first_byte: '800ms',
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