import { jest } from '@jest/globals';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import fs from 'fs-extra';

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

  test('passes with warnings for a valid SEO.md', async () => {
    await writeFullTemplateSeoMd(cwd);

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await validateCommand();

    expect(process.exitCode).toBe(0);

    const all = logSpy.mock.calls.map((c) => String(c[0] ?? '')).join('\n');
    expect(all).toContain('Validation passed');

    logSpy.mockRestore();
  });

  test('fails when SEO.md is missing required sections', async () => {
    await writeSeoMdFixture(cwd);

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await validateCommand();

    expect(process.exitCode).toBe(1);
    const all = logSpy.mock.calls.map((c) => String(c[0] ?? '')).join('\n');
    expect(all).toContain('Validation failed');

    logSpy.mockRestore();
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
    await writeFullTemplateSeoMd(cwd);

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await statusCommand({ json: true });

    expect(process.exitCode).toBe(0);

    const output = logSpy.mock.calls.map((c) => String(c[0] ?? '')).join('\n');
    const parsed = JSON.parse(output);
    expect(parsed.status).toBe('no_data');

    logSpy.mockRestore();
  });

  test('outputs structured JSON when analysis exists', async () => {
    await writeFullTemplateSeoMd(cwd);

    const yaml = await import('yaml');
    const before = await fs.readFile(path.join(cwd, 'SEO.md'), 'utf8');
    const doc = yaml.default.parseDocument(before);

    const { writeAnalysisToSeoMd } = await import('../src/utils/writeback.js');
    await writeAnalysisToSeoMd(doc, makeApiResponse(), cwd);

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await statusCommand({ json: true });

    expect(process.exitCode).toBe(0);

    const output = logSpy.mock.calls.map((c) => String(c[0] ?? '')).join('\n');
    const parsed = JSON.parse(output);
    expect(parsed.overall.gap_score).toBe(42);
    expect(parsed.overall.citation_rate).toBe(0.5);
    expect(parsed.site.domain).toBe('example.com');

    logSpy.mockRestore();
  });
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
const { analyzeCommand } = await import('../src/commands/analyze.js');
const { statusCommand } = await import('../src/commands/status.js');
const { validateCommand } = await import('../src/commands/validate.js');
const { generateSeoMd } = await import('../src/generators/seomd.js');

async function makeTempDir() {
  return mkdtemp(path.join(os.tmpdir(), 'seomd-cli-test-'));
}

async function writeSeoMdFixture(cwd, overrides = {}) {
  const base = {
    site: { domain: 'example.com', type: 'saas' },
    identity: { brand: 'Example Brand' },
    keywords: { primary: 'example keyword' },
    pages: {
      required: [
        { id: 'homepage', url: '/', primary_keyword: 'example keyword', status: 'planned' },
      ],
      optional: [],
    },
    intent: {
      informational: { queries: ['what is example brand'] },
      _analysis: { source: 'fixture' },
    },
  };

  const merged = { ...base, ...overrides };
  const yaml = await import('yaml');
  await fs.writeFile(path.join(cwd, 'SEO.md'), yaml.default.stringify(merged), 'utf8');
}

async function writeFullTemplateSeoMd(cwd, overrides = {}) {
  const content = generateSeoMd({
    site_type: 'saas',
    domain: 'example.com',
    brand: 'Example Brand',
    primary_keyword: 'example keyword',
    competitors: [],
    ...overrides,
  });
  await fs.writeFile(path.join(cwd, 'SEO.md'), content, 'utf8');
}

function makeApiResponse(overrides = {}) {
  return {
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
        citation_rate: 0.2,
        top_cited_competitor: 'comp.example',
        gap_score: 10,
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
        markdown_content: '# homepage\n\ncontent\n',
      },
    ],
    ...overrides,
  };
}

describe('init', () => {
  let cwd;
  let prevCwd;

  beforeEach(async () => {
    cwd = await makeTempDir();
    prevCwd = process.cwd();
    process.chdir(cwd);
    await fs.writeFile(path.join(cwd, '.gitignore'), 'node_modules/\n', 'utf8');
  });

  afterEach(async () => {
    process.chdir(prevCwd);
    await rm(cwd, { recursive: true, force: true });
  });

  test('--yes scaffolds files and updates gitignore', async () => {
    await initCommand({ yes: true, type: 'saas' });

    expect(await fs.pathExists(path.join(cwd, 'SEO.md'))).toBe(true);
    expect(await fs.pathExists(path.join(cwd, 'SEO.REVERSE.md'))).toBe(true);
    expect(await fs.pathExists(path.join(cwd, '.seomd', 'README.md'))).toBe(true);

    const gitignore = await fs.readFile(path.join(cwd, '.gitignore'), 'utf8');
    expect(gitignore).toContain('.seomd/reports/');
  });
});

describe('sync', () => {
  let cwd;
  let prevCwd;

  beforeEach(async () => {
    cwd = await makeTempDir();
    prevCwd = process.cwd();
    process.chdir(cwd);
    process.env.SEOMD_API_KEY = 'test';
    await writeSeoMdFixture(cwd);
  });

  afterEach(async () => {
    process.chdir(prevCwd);
    delete process.env.SEOMD_API_KEY;
    await rm(cwd, { recursive: true, force: true });
  });

  test('writes analysis back into repo files', async () => {
    const apiResponse = makeApiResponse();
    mockAxiosGet.mockResolvedValueOnce({ data: apiResponse });

    await syncCommand({ dryRun: false });

    const seomd = await fs.readFile(path.join(cwd, 'SEO.md'), 'utf8');
    expect(seomd).toContain('overall_gap_score: 42');
    expect(seomd).toContain('overall_citation_rate: 0.5');
    expect(seomd).toContain('source: foxcite');

    const reverse = await fs.readFile(path.join(cwd, 'SEO.REVERSE.md'), 'utf8');
    expect(reverse).toContain('# SEO.REVERSE.md');
    expect(reverse).toContain('source: foxcite');

    const pageMd = await fs.readFile(path.join(cwd, '.seomd', 'pages', 'homepage.md'), 'utf8');
    expect(pageMd).toContain('# homepage');
  });

  test('dryRun does not modify files', async () => {
    const apiResponse = makeApiResponse();
    mockAxiosGet.mockResolvedValueOnce({ data: apiResponse });

    const beforeSeoMd = await fs.readFile(path.join(cwd, 'SEO.md'), 'utf8');
    await syncCommand({ dryRun: true });

    const afterSeoMd = await fs.readFile(path.join(cwd, 'SEO.md'), 'utf8');
    expect(afterSeoMd).toBe(beforeSeoMd);
    expect(await fs.pathExists(path.join(cwd, 'SEO.REVERSE.md'))).toBe(false);
  });
});

describe('analyze', () => {
  let cwd;
  let prevCwd;

  beforeEach(async () => {
    cwd = await makeTempDir();
    prevCwd = process.cwd();
    process.chdir(cwd);
    process.env.SEOMD_API_KEY = 'test';
    await writeSeoMdFixture(cwd, {
      intent: {
        informational: { queries: ['what is example brand'] },
        comparison: { queries: ['comp vs example brand'] },
        _analysis: { source: 'fixture' },
      },
    });
  });

  afterEach(async () => {
    process.chdir(prevCwd);
    delete process.env.SEOMD_API_KEY;
    await rm(cwd, { recursive: true, force: true });
  });

  test('sends filtered queries and writes results', async () => {
    const apiResponse = makeApiResponse();
    mockAxiosPost.mockResolvedValueOnce({ data: apiResponse });

    await analyzeCommand({});

    expect(mockAxiosPost).toHaveBeenCalledTimes(1);
    const [, payload] = mockAxiosPost.mock.calls[0];
    expect(payload.queries).toEqual({
      informational: ['what is example brand'],
      comparison: ['comp vs example brand'],
    });

    const seomd = await fs.readFile(path.join(cwd, 'SEO.md'), 'utf8');
    expect(seomd).toContain('overall_gap_score: 42');
  });

  test('--page falls back when no pages match', async () => {
    const apiResponse = makeApiResponse({
      page_analysis: [
        {
          id: 'pricing',
          url: '/pricing',
          citation_rate: 0.1,
          gap_score: 99,
          top_cited_competitor: 'comp.example',
          markdown_content: '# pricing\n\ncontent\n',
        },
      ],
    });
    mockAxiosPost.mockResolvedValueOnce({ data: apiResponse });

    await analyzeCommand({ page: '/pricing', engines: 'Claude' });

    const [, payload] = mockAxiosPost.mock.calls[0];
    expect(payload.pages).toHaveLength(1);
    expect(payload.pages[0].url).toBe('/pricing');

    const pageMd = await fs.readFile(path.join(cwd, '.seomd', 'pages', 'pricing.md'), 'utf8');
    expect(pageMd).toContain('# pricing');
  });
});
