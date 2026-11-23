import fs from 'fs-extra';
import path from 'path';

const IGNORED_DIRS = new Set([
    'node_modules',
    '.git',
    '.next',
    '.nuxt',
    '.svelte-kit',
    '.seo',
    'dist',
    'build',
    'out',
    'coverage',
    'api',
]);

/**
 * Inspects a project directory to discover framework, existing public routes,
 * and crawl files (robots.txt, sitemap.xml, llms.txt).
 *
 * @param {string} cwd - Directory to inspect
 * @returns {Promise<{
 *   framework: string|null,
 *   packageName: string|null,
 *   homepage: string|null,
 *   routes: string[],
 *   hasRobotsTxt: boolean,
 *   hasSitemap: boolean,
 *   hasLlmsTxt: boolean
 * }>}
 */
export async function scanRepo(cwd) {
    const result = {
        framework: null,
        packageName: null,
        homepage: null,
        routes: [],
        hasRobotsTxt: false,
        hasSitemap: false,
        hasLlmsTxt: false,
    };

    // 1. Read package.json if present
    const pkgPath = path.join(cwd, 'package.json');
    if (await fs.pathExists(pkgPath)) {
        try {
            const pkg = await fs.readJson(pkgPath);
            result.packageName = typeof pkg.name === 'string' ? pkg.name : null;
            result.homepage = typeof pkg.homepage === 'string' ? pkg.homepage : null;

            const deps = {
                ...(pkg.dependencies || {}),
                ...(pkg.devDependencies || {}),
            };
            if (deps.next) result.framework = 'nextjs';
            else if (deps.astro) result.framework = 'astro';
            else if (deps['@sveltejs/kit']) result.framework = 'sveltekit';
            else if (deps['@remix-run/react'] || deps['react-router']) result.framework = 'remix';
            else if (deps.nuxt) result.framework = 'nuxt';
            else if (deps.vite) result.framework = 'vite';
        } catch {
            // Ignore malformed package.json
        }
    }

    // 2. Check crawl artifacts in public/ or root
    const publicDirs = [path.join(cwd, 'public'), path.join(cwd, 'static'), cwd];
    for (const dir of publicDirs) {
        if (!result.hasRobotsTxt && (await fs.pathExists(path.join(dir, 'robots.txt')))) {
            result.hasRobotsTxt = true;
        }
        if (!result.hasSitemap && (await fs.pathExists(path.join(dir, 'sitemap.xml')))) {
            result.hasSitemap = true;
        }
        if (!result.hasLlmsTxt && (await fs.pathExists(path.join(dir, 'llms.txt')))) {
            result.hasLlmsTxt = true;
        }
    }

    // Also check Next.js App Router dynamic robots/sitemap conventions
    for (const appBase of [path.join(cwd, 'app'), path.join(cwd, 'src', 'app')]) {
        if (await fs.pathExists(appBase)) {
            for (const ext of ['ts', 'js', 'tsx', 'jsx']) {
                if (!result.hasRobotsTxt && (await fs.pathExists(path.join(appBase, `robots.${ext}`)))) {
                    result.hasRobotsTxt = true;
                }
                if (!result.hasSitemap && (await fs.pathExists(path.join(appBase, `sitemap.${ext}`)))) {
                    result.hasSitemap = true;
                }
            }
        }
    }

    // 3. Discover routes based on common conventions
    const routes = new Set();

    // Next.js App Router: app/**/page.{tsx,jsx,ts,js,mdx}
    for (const appDir of [path.join(cwd, 'app'), path.join(cwd, 'src', 'app')]) {
        if (await fs.pathExists(appDir)) {
            if (!result.framework) result.framework = 'nextjs';
            await walkAppRouter(appDir, '', routes);
        }
    }

    // Next.js / Astro / Nuxt Pages Router: pages/**/*.{tsx,jsx,ts,js,astro,md,mdx,vue}
    for (const pagesDir of [path.join(cwd, 'pages'), path.join(cwd, 'src', 'pages')]) {
        if (await fs.pathExists(pagesDir)) {
            await walkPagesRouter(pagesDir, '', routes);
        }
    }

    // SvelteKit: src/routes/**/+page.svelte
    const svelteRoutes = path.join(cwd, 'src', 'routes');
    if (await fs.pathExists(svelteRoutes)) {
        await walkSvelteRoutes(svelteRoutes, '', routes);
    }

    result.routes = Array.from(routes).sort((a, b) => {
        if (a === '/') return -1;
        if (b === '/') return 1;
        return a.localeCompare(b);
    });

    return result;
}

async function walkAppRouter(dir, prefix, routes, depth = 0) {
    if (depth > 5) return;
    let entries;
    try {
        entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
        return;
    }

    for (const entry of entries) {
        if (entry.isDirectory()) {
            if (IGNORED_DIRS.has(entry.name) || entry.name.startsWith('_') || entry.name.startsWith('@')) {
                continue;
            }
            // Route groups like (marketing) do not add a URL segment
            const isGroup = entry.name.startsWith('(') && entry.name.endsWith(')');
            const nextPrefix = isGroup ? prefix : `${prefix}/${entry.name}`;
            await walkAppRouter(path.join(dir, entry.name), nextPrefix, routes, depth + 1);
        } else if (/^page\.(tsx|jsx|ts|js|mdx|md)$/.test(entry.name)) {
            routes.add(prefix || '/');
        }
    }
}

async function walkPagesRouter(dir, prefix, routes, depth = 0) {
    if (depth > 5) return;
    let entries;
    try {
        entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
        return;
    }

    for (const entry of entries) {
        if (entry.isDirectory()) {
            if (IGNORED_DIRS.has(entry.name) || entry.name.startsWith('_')) continue;
            await walkPagesRouter(path.join(dir, entry.name), `${prefix}/${entry.name}`, routes, depth + 1);
        } else if (/\.(tsx|jsx|ts|js|astro|mdx|md|vue)$/.test(entry.name)) {
            const base = entry.name.replace(/\.(tsx|jsx|ts|js|astro|mdx|md|vue)$/, '');
            if (base.startsWith('_') || base === '404' || base === '500') continue;
            const route = base === 'index' ? (prefix || '/') : `${prefix}/${base}`;
            routes.add(route);
        }
    }
}

async function walkSvelteRoutes(dir, prefix, routes, depth = 0) {
    if (depth > 5) return;
    let entries;
    try {
        entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
        return;
    }

    for (const entry of entries) {
        if (entry.isDirectory()) {
            if (IGNORED_DIRS.has(entry.name)) continue;
            const isGroup = entry.name.startsWith('(') && entry.name.endsWith(')');
            const nextPrefix = isGroup ? prefix : `${prefix}/${entry.name}`;
            await walkSvelteRoutes(path.join(dir, entry.name), nextPrefix, routes, depth + 1);
        } else if (entry.name === '+page.svelte') {
            routes.add(prefix || '/');
        }
    }
}

/**
 * Converts a URL route like `/vs/[competitor]` into a clean page ID slug.
 */
export function routeToPageId(url) {
    if (!url || url === '/') return 'homepage';
    return url
        .replace(/^\//, '')
        .replace(/\/$/, '')
        .replace(/\[([^\]]+)\]/g, '$1')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase() || 'page';
}
