import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { parseSeoMd } from '../utils/parser.js';
import { validateSeoMd } from '../validators/seomd.js';
import { inspectAgentWiring } from '../utils/agent-wiring.js';
import { scanRepo } from '../utils/repo-scanner.js';
import { resolveProvider } from '../providers/index.js';

export async function doctorCommand(options = {}) {
    const cwd = process.cwd();
    const report = {
        seomd: { exists: false, format: null, valid: false, errors: 0, warnings: 0 },
        agents: { filesFound: [], wiredFiles: [] },
        repo: { framework: null, routesDiscovered: 0, hasRobotsTxt: false, hasSitemap: false, hasLlmsTxt: false },
        workspace: { hasStatus: false, hasReverse: false },
        provider: { configured: false, name: null, endpoint: null, hasAuth: false },
    };

    let parsedData = null;
    try {
        const { format, data, body } = await parseSeoMd(cwd);
        parsedData = data;
        const { errors, warnings } = validateSeoMd(data, { format, body });
        report.seomd = {
            exists: true,
            format,
            valid: errors.length === 0,
            errors: errors.length,
            warnings: warnings.length,
        };
    } catch (err) {
        report.seomd.error = err.message;
    }

    report.agents = await inspectAgentWiring(cwd);

    const repoInfo = await scanRepo(cwd);
    report.repo = {
        framework: repoInfo.framework,
        routesDiscovered: repoInfo.routes.length,
        hasRobotsTxt: repoInfo.hasRobotsTxt,
        hasSitemap: repoInfo.hasSitemap,
        hasLlmsTxt: repoInfo.hasLlmsTxt,
    };

    report.workspace.hasStatus = await fs.pathExists(path.join(cwd, '.seo', 'STATUS.yml'));
    report.workspace.hasReverse = await fs.pathExists(path.join(cwd, '.seo', 'REVERSE.md'));

    const provider = resolveProvider(parsedData);
    if (provider) {
        report.provider = {
            configured: true,
            name: provider.name,
            endpoint: provider.endpoint,
            hasAuth: provider.hasAuth,
            capabilities: provider.capabilities,
        };
    }

    if (options.json) {
        console.log(JSON.stringify(report, null, 2));
        process.exitCode = report.seomd.valid ? 0 : 1;
        return;
    }

    console.log('');
    console.log(chalk.bold('SEO.md Doctor'));
    console.log(chalk.dim('─'.repeat(50)));

    // SEO.md
    if (report.seomd.exists && report.seomd.valid) {
        console.log(`${chalk.green('✓')} SEO.md found (${report.seomd.format}) — valid (${report.seomd.warnings} warning(s))`);
    } else if (report.seomd.exists) {
        console.log(`${chalk.red('✗')} SEO.md found (${report.seomd.format}) — ${report.seomd.errors} error(s)`);
    } else {
        console.log(`${chalk.red('✗')} SEO.md not found — run ${chalk.cyan('npx seomd-cli init')}`);
    }

    // Agent wiring
    if (report.agents.wiredFiles.length > 0) {
        console.log(`${chalk.green('✓')} Agent wiring active in: ${report.agents.wiredFiles.join(', ')}`);
    } else {
        console.log(`${chalk.yellow('⚠')} AGENTS.md / CLAUDE.md not wired to SEO.md yet`);
    }

    // Crawl files
    console.log(
        `${report.repo.hasRobotsTxt ? chalk.green('✓') : chalk.yellow('⚠')} robots.txt ${report.repo.hasRobotsTxt ? 'detected' : 'missing'}`
    );
    console.log(
        `${report.repo.hasLlmsTxt ? chalk.green('✓') : chalk.yellow('⚠')} llms.txt ${report.repo.hasLlmsTxt ? 'detected' : 'missing'}`
    );
    console.log(
        `${report.repo.hasSitemap ? chalk.green('✓') : chalk.yellow('⚠')} sitemap.xml ${report.repo.hasSitemap ? 'detected' : 'missing'}`
    );

    // Provider
    if (report.provider.configured) {
        const authTag = report.provider.hasAuth ? chalk.green('credentials set') : chalk.yellow('missing SEOMD_API_KEY');
        const endpointTag = report.provider.endpoint ? chalk.dim(report.provider.endpoint) : chalk.yellow('no endpoint');
        console.log(`${chalk.green('✓')} Provider: ${chalk.bold(report.provider.name)} (${authTag}, ${endpointTag})`);
    } else {
        console.log(`${chalk.dim('•')} Provider: local-only mode (optional — set SEOMD_PROVIDER / SEOMD_API_KEY for live citation scans)`);
    }

    console.log('');
    process.exitCode = report.seomd.valid ? 0 : 1;
}
