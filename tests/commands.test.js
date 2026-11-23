import { jest } from '@jest/globals';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import fs from 'fs-extra';
import YAML from 'yaml';

let mockAxiosClient;
let mockAxiosGet;
let mockAxiosPost;

await jest.unstable_mockModule('axios', () => {
    mockAxiosGet = jest.fn();
    mockAxiosPost = jest.fn();
    mockAxiosClient = {
        get: mockAxiosGet,
        post: mockAxiosPost,
        interceptors: { response: { use: jest.fn() } },
    };

    return {
        default: {
            create: jest.fn(() => mockAxiosClient),
        },
    };
});

await jest.unstable_mockModule('ora', () => {
    return {
        default: () => {
            const spinner = {
                text: '',
                succeed: jest.fn(),
                fail: jest.fn(),
                start() {
                    return spinner;
                },
            };
            return spinner;
        },
    };
});

const { initCommand } = await import('../src/commands/init.js');
const { syncCommand } = await import('../src/commands/sync.js');
const { analyzeCommand, matchRoute } = await import('../src/commands/analyze.js');
const { statusCommand } = await import('../src/commands/status.js');
const { validateCommand } = await import('../src/commands/validate.js');
const { generateCommand } = await import('../src/commands/generate.js');
const { checkCommand } = await import('../src/commands/check.js');
const { doctorCommand } = await import('../src/commands/doctor.js');
const { generateSeoMd } = await import('../src/generators/seomd.js');
const { parseSeoMd } = await import('../src/utils/parser.js');
const { writeAnalysisToSeoMd, writePageAnalysis, sanitizePageId } = await import('../src/utils/writeback.js');
const { resolveProvider } = await import('../src/providers/index.js');
const { MARKER_START } = await import('../src/utils/agent-wiring.js');
const { VALID_SITE_TYPES } = await import('../src/utils/constants.js');

async function makeTempDir() {
    return mkdtemp(path.join(os.tmpdir(), 'seomd-cli-test-'));
}

async function writeV2SeoMd(cwd, overrides = {}) {
    const content = generateSeoMd({
        site_type: 'saas',
        domain: 'example.com',
        brand: 'Example Brand',
        primary_keyword: 'example keyword',
        competitors: ['comp.example'],
        ...overrides,
    });
    await fs.writeFile(path.join(cwd, 'SEO.md'), content, 'utf8');
}

function makeApiResponse(overrides = {}) {
    return {
        provider: 'foxcite',
        domain: 'example.com',
        brand_name: 'Example Brand',
        credits_remaining: 5,
        aeo_analysis: {
            overall_citation_rate: 0.5,
            overall_gap_score: 42,
            engines_tracked: ['ChatGPT'],
            last_analyzed: '2026-01-01T00:00:00Z',
            next_analysis: '2026-01-08T00:00:00Z',
        },
        intent_analysis: {
            informational: {
                citation_rate: 0,
                top_cited_competitor: 'comp.example',
                gap_score: 0,
                trend: 'up',
            },
            comparison: {
                citation_rate: 0.1,
                top_cited_competitor: 'comp.example',
                gap_score: 15,
                trend: 'stable',
            },
        },
        page_analysis: [
            {
                id: 'homepage',
                url: '/',
                citation_rate: 0.3,
                gap_score: 20,
                top_cited_competitor: 'comp.example',
                gaps_for_brand: ['Add FAQ block'],
                markdown_content: '# homepage\n\ncontent\n',
            },
        ],
        ...overrides,
    };
}

function clearProviderEnv() {
    delete process.env.SEOMD_PROVIDER;
    delete process.env.SEOMD_API_URL;
    delete process.env.SEOMD_API_KEY;
    delete process.env.SEOMD_PAYMENT_TOKEN;
    delete process.env.SEOMD_DOMAIN;
}

describe('init (v2)', () => {
    let cwd;
    let prevCwd;
    let logSpy;

    beforeEach(async () => {
        cwd = await makeTempDir();
        prevCwd = process.cwd();
        process.chdir(cwd);
        process.exitCode = undefined;
        logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(async () => {
        logSpy.mockRestore();
        process.chdir(prevCwd);
        process.exitCode = undefined;
        await rm(cwd, { recursive: true, force: true });
    });

    test('-y scaffolds valid v2 SEO.md, .seo/ workspace, and wires AGENTS.md', async () => {
        await initCommand({ yes: true, type: 'saas' });

        expect(process.exitCode).toBe(0);
        expect(await fs.pathExists(path.join(cwd, 'SEO.md'))).toBe(true);
        expect(await fs.pathExists(path.join(cwd, '.seo', 'REVERSE.md'))).toBe(true);
        expect(await fs.pathExists(path.join(cwd, '.seo', 'README.md'))).toBe(true);

        // No empty placeholder page files created prematurely
        const pageFiles = await fs.readdir(path.join(cwd, '.seo', 'pages'));
        expect(pageFiles).toHaveLength(0);

        // AGENTS.md created and wired
        const agentsMd = await fs.readFile(path.join(cwd, 'AGENTS.md'), 'utf8');
        expect(agentsMd).toContain(MARKER_START);
        expect(agentsMd).toContain('SEO.md');

        // Generated SEO.md immediately passes validate
        await validateCommand({ json: true });
        expect(process.exitCode).toBe(0);
    });

    test('wires into existing CLAUDE.md idempotently without duplicating block', async () => {
        await fs.writeFile(path.join(cwd, 'CLAUDE.md'), '# CLAUDE.md\n\nExisting rules.\n', 'utf8');

        await initCommand({ yes: true, type: 'saas' });
        await initCommand({ yes: true, type: 'saas' });

        const claudeMd = await fs.readFile(path.join(cwd, 'CLAUDE.md'), 'utf8');
        expect(claudeMd).toContain('Existing rules.');
        expect(claudeMd.split(MARKER_START)).toHaveLength(2);
        expect(await fs.pathExists(path.join(cwd, 'AGENTS.md'))).toBe(false);
    });

    test('respects --no-wire-agents', async () => {
        await initCommand({ yes: true, type: 'saas', wireAgents: false });
        expect(await fs.pathExists(path.join(cwd, 'AGENTS.md'))).toBe(false);
    });

    test('detects Next.js App Router routes and marks them live', async () => {
        await fs.writeJson(path.join(cwd, 'package.json'), {
            name: 'acme-web',
            dependencies: { next: '15.0.0' },
        });
        await fs.ensureDir(path.join(cwd, 'app', 'pricing'));
        await fs.ensureDir(path.join(cwd, 'app', '(marketing)', 'about'));
        await fs.writeFile(path.join(cwd, 'app', 'page.tsx'), 'export default function Home() {}', 'utf8');
        await fs.writeFile(path.join(cwd, 'app', 'pricing', 'page.tsx'), 'export default function Pricing() {}', 'utf8');
        await fs.writeFile(path.join(cwd, 'app', '(marketing)', 'about', 'page.tsx'), 'export default function About() {}', 'utf8');

        await initCommand({ yes: true, type: 'saas' });

        const { data } = await parseSeoMd(cwd);
        const homepage = data.pages.find((p) => p.url === '/');
        const pricing = data.pages.find((p) => p.url === '/pricing');
        const about = data.pages.find((p) => p.url === '/about');

        expect(homepage.status).toBe('live');
        expect(pricing.status).toBe('live');
        expect(about.status).toBe('live');
    });

    test('handles special YAML characters and normalizes domain with protocol', async () => {
        await initCommand({
            yes: true,
            brand: 'Acme: "AI" #1',
            domain: 'https://acme.com/',
            primaryKeyword: 'billing: automation "pro"',
        });

        const { format, data } = await parseSeoMd(cwd);
        expect(format).toBe('v2');
        expect(data.site.brand).toBe('Acme: "AI" #1');
        expect(data.site.domain).toBe('acme.com');
        expect(data.site.canonical).toBe('https://acme.com');
        expect(data.keywords.primary).toBe('billing: automation "pro"');
    });

    test('rejects invalid --type', async () => {
        await initCommand({ yes: true, type: 'invalid-type' });
        expect(process.exitCode).toBe(1);
        expect(await fs.pathExists(path.join(cwd, 'SEO.md'))).toBe(false);
    });
});

describe('validate', () => {
    let cwd;
    let prevCwd;

    beforeEach(async () => {
        cwd = await makeTempDir();
        prevCwd = process.cwd();
        process.chdir(cwd);
        process.exitCode = undefined;
    });

    afterEach(async () => {
        process.chdir(prevCwd);
        process.exitCode = undefined;
        await rm(cwd, { recursive: true, force: true });
    });

    test.each(VALID_SITE_TYPES)('v2 template for site type %s passes validation', async (siteType) => {
        await writeV2SeoMd(cwd, { site_type: siteType });
        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        await validateCommand({ json: true });
        expect(process.exitCode).toBe(0);

        const parsed = JSON.parse(logSpy.mock.calls.map((c) => String(c[0] ?? '')).join('\n'));
        expect(parsed.valid).toBe(true);
        expect(parsed.format).toBe('v2');
        expect(parsed.errors).toHaveLength(0);

        logSpy.mockRestore();
    });

    test('supports legacy v1 raw YAML SEO.md and fails when missing required sections', async () => {
        await fs.writeFile(
            path.join(cwd, 'SEO.md'),
            YAML.stringify({ site: { domain: 'example.com', type: 'saas' } }),
            'utf8'
        );
        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        await validateCommand();
        expect(process.exitCode).toBe(1);

        logSpy.mockRestore();
    });

    test('--strict fails when warnings exist', async () => {
        await writeV2SeoMd(cwd); // keywords.secondary is empty -> warning
        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        await validateCommand({ strict: true, json: true });
        expect(process.exitCode).toBe(1);

        logSpy.mockRestore();
    });
});

describe('generate & check & doctor (local zero-API-key loop)', () => {
    let cwd;
    let prevCwd;

    beforeEach(async () => {
        cwd = await makeTempDir();
        prevCwd = process.cwd();
        process.chdir(cwd);
        process.exitCode = undefined;
        clearProviderEnv();
    });

    afterEach(async () => {
        clearProviderEnv();
        process.chdir(prevCwd);
        process.exitCode = undefined;
        await rm(cwd, { recursive: true, force: true });
    });

    test('generate creates robots.txt, llms.txt, and JSON-LD schema', async () => {
        await writeV2SeoMd(cwd);
        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        await generateCommand('robots', { out: 'public/robots.txt' });
        await generateCommand('llms', { out: 'public/llms.txt' });
        await generateCommand('schema', { out: 'public/schema.json' });

        const robots = await fs.readFile(path.join(cwd, 'public', 'robots.txt'), 'utf8');
        expect(robots).toContain('User-agent: GPTBot');
        expect(robots).toContain('Sitemap: https://example.com/sitemap.xml');

        const llms = await fs.readFile(path.join(cwd, 'public', 'llms.txt'), 'utf8');
        expect(llms).toContain('# Example Brand');
        expect(llms).toContain('https://example.com');

        const schema = JSON.parse(await fs.readFile(path.join(cwd, 'public', 'schema.json'), 'utf8'));
        expect(schema['@context']).toBe('https://schema.org');
        expect(Array.isArray(schema['@graph'])).toBe(true);

        logSpy.mockRestore();
    });

    test('check audits local HTML directory and flags blocked AI bots + missing H1', async () => {
        await writeV2SeoMd(cwd);
        await fs.ensureDir(path.join(cwd, 'dist'));
        await fs.writeFile(
            path.join(cwd, 'dist', 'robots.txt'),
            'User-agent: GPTBot\nDisallow: /\n',
            'utf8'
        );
        await fs.writeFile(
            path.join(cwd, 'dist', 'index.html'),
            '<html><head><title>Home</title></head><body><p>No H1 here</p></body></html>',
            'utf8'
        );

        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        await checkCommand('dist', { json: true });

        expect(process.exitCode).toBe(1);
        const report = JSON.parse(logSpy.mock.calls.map((c) => String(c[0] ?? '')).join('\n'));
        expect(report.passed).toBe(false);
        expect(report.errors.some((e) => e.rule === 'ai-bots')).toBe(true);
        expect(report.errors.some((e) => e.rule === 'h1')).toBe(true);

        logSpy.mockRestore();
    });

    test('doctor reports SEO.md, agent wiring, and local-only provider state', async () => {
        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        await initCommand({ yes: true, type: 'saas' });
        logSpy.mockClear();

        await doctorCommand({ json: true });
        expect(process.exitCode).toBe(0);

        const report = JSON.parse(logSpy.mock.calls.map((c) => String(c[0] ?? '')).join('\n'));
        expect(report.seomd.valid).toBe(true);
        expect(report.agents.wiredFiles).toContain('AGENTS.md');
        expect(report.provider.configured).toBe(false);

        logSpy.mockRestore();
    });
});

describe('providers (vendor-agnostic)', () => {
    afterEach(() => {
        clearProviderEnv();
    });

    test('returns null when unconfigured', () => {
        clearProviderEnv();
        expect(resolveProvider({})).toBeNull();
    });

    test('third-party provider without endpoint gives actionable capability error', async () => {
        process.env.SEOMD_PROVIDER = 'ahrefs';
        const provider = resolveProvider({});
        expect(provider.name).toBe('ahrefs');
        await expect(provider.analyze({})).rejects.toThrow(/Ahrefs.*PROVIDER_SPEC\.md/s);
    });

    test('custom provider with SEOMD_API_URL uses POST /cli/sync', async () => {
        process.env.SEOMD_PROVIDER = 'custom';
        process.env.SEOMD_API_URL = 'https://api.custom-seo.test';
        process.env.SEOMD_API_KEY = 'secret';

        mockAxiosPost.mockResolvedValueOnce({ data: makeApiResponse({ provider: 'custom' }) });

        const provider = resolveProvider({});
        const res = await provider.sync({ domain: 'example.com', pages: [{ id: 'homepage', url: '/' }] });
        expect(res.provider).toBe('custom');
        expect(mockAxiosPost).toHaveBeenCalledWith('/cli/sync', expect.objectContaining({ domain: 'example.com' }));
    });
});

describe('status', () => {
    let cwd;
    let prevCwd;

    beforeEach(async () => {
        cwd = await makeTempDir();
        prevCwd = process.cwd();
        process.chdir(cwd);
        process.exitCode = undefined;
    });

    afterEach(async () => {
        process.chdir(prevCwd);
        process.exitCode = undefined;
        await rm(cwd, { recursive: true, force: true });
    });

    test('returns no_data JSON when no analysis exists', async () => {
        await writeV2SeoMd(cwd);
        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        await statusCommand({ json: true });
        expect(process.exitCode).toBe(0);

        const parsed = JSON.parse(logSpy.mock.calls.map((c) => String(c[0] ?? '')).join('\n'));
        expect(parsed.status).toBe('no_data');
        logSpy.mockRestore();
    });

    test('preserves 0 values in structured JSON output', async () => {
        await writeV2SeoMd(cwd);
        await writeAnalysisToSeoMd(null, makeApiResponse(), cwd, { provider: 'foxcite' });

        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        await statusCommand({ json: true });

        expect(process.exitCode).toBe(0);
        const parsed = JSON.parse(logSpy.mock.calls.map((c) => String(c[0] ?? '')).join('\n'));
        expect(parsed.overall.gap_score).toBe(42);
        expect(parsed.overall.citation_rate).toBe(0.5);
        expect(parsed.intent.informational.citation_rate).toBe(0);
        expect(parsed.intent.informational.gap_score).toBe(0);

        logSpy.mockRestore();
    });
});

describe('analyze & sync & writeback', () => {
    let cwd;
    let prevCwd;
    let logSpy;

    beforeEach(async () => {
        cwd = await makeTempDir();
        prevCwd = process.cwd();
        process.chdir(cwd);
        process.exitCode = undefined;
        clearProviderEnv();
        process.env.SEOMD_PROVIDER = 'foxcite';
        process.env.SEOMD_API_KEY = 'test-key';
        await writeV2SeoMd(cwd);
        logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(async () => {
        logSpy.mockRestore();
        clearProviderEnv();
        process.chdir(prevCwd);
        process.exitCode = undefined;
        await rm(cwd, { recursive: true, force: true });
    });

    test('analyze --intent filters queries to requested category', async () => {
        mockAxiosPost.mockResolvedValueOnce({ data: makeApiResponse() });

        await analyzeCommand({ intent: 'comparison' });

        expect(mockAxiosPost).toHaveBeenCalledTimes(1);
        const [, payload] = mockAxiosPost.mock.calls[0];
        expect(Object.keys(payload.queries)).toEqual(['comparison']);
    });

    test('partial analyze --page merges into existing STATUS.yml instead of overwriting', async () => {
        // First run: homepage
        mockAxiosPost.mockResolvedValueOnce({ data: makeApiResponse() });
        await analyzeCommand({ page: '/' });

        // Second run: pricing only
        mockAxiosPost.mockResolvedValueOnce({
            data: makeApiResponse({
                page_analysis: [
                    {
                        id: 'pricing',
                        url: '/pricing',
                        citation_rate: 0.25,
                        gap_score: 55,
                        top_cited_competitor: 'comp.example',
                        markdown_content: '# pricing\n',
                    },
                ],
            }),
        });
        await analyzeCommand({ page: '/pricing', engines: 'Claude' });

        const status = YAML.parse(await fs.readFile(path.join(cwd, '.seo', 'STATUS.yml'), 'utf8'));
        const ids = status.pages.pages.map((p) => p.id);
        expect(ids).toContain('homepage');
        expect(ids).toContain('pricing');
    });

    test('matchRoute enforces required dynamic segments', () => {
        expect(matchRoute('/vs/[competitor]', '/vs/asana')).toBe(true);
        expect(matchRoute('/vs/[competitor]', '/vs')).toBe(false);
        expect(matchRoute('/pricing', '/pricing/')).toBe(true);
    });

    test('writePageAnalysis sanitizes page.id against path traversal', async () => {
        expect(sanitizePageId('../../etc/passwd')).toBe('etc-passwd');
        await writePageAnalysis(cwd, {
            page_analysis: [{ id: '../../escape', markdown_content: '# safe' }],
        });
        expect(await fs.pathExists(path.join(cwd, '.seo', 'pages', 'escape.md'))).toBe(true);
        expect(await fs.pathExists(path.join(cwd, 'escape.md'))).toBe(false);
    });

    test('sync writes analysis and dryRun does not modify files', async () => {
        mockAxiosGet.mockResolvedValueOnce({ data: makeApiResponse() });
        await syncCommand({ dryRun: true });
        expect(await fs.pathExists(path.join(cwd, '.seo', 'STATUS.yml'))).toBe(false);

        mockAxiosGet.mockResolvedValueOnce({ data: makeApiResponse() });
        await syncCommand({ dryRun: false });
        const statusYaml = await fs.readFile(path.join(cwd, '.seo', 'STATUS.yml'), 'utf8');
        expect(statusYaml).toContain('overall_gap_score: 42');
        expect(statusYaml).toContain('source: foxcite');
    });
});
