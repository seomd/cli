import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import YAML from 'yaml';

function parseArgs(argv) {
    const out = { from: null, to: null, outFile: null };
    for (let i = 2; i < argv.length; i += 1) {
        const arg = argv[i];
        const next = argv[i + 1];
        if (arg === '--from' && next) {
            out.from = next;
            i += 1;
        } else if (arg === '--to' && next) {
            out.to = next;
            i += 1;
        } else if (arg === '--out' && next) {
            out.outFile = next;
            i += 1;
        }
    }
    return out;
}

function readContributorsMap(repoRoot) {
    const filePath = path.join(repoRoot, '.github', 'contributors.yml');
    if (!fs.existsSync(filePath)) {
        return { version: 1, contributors: [] };
    }
    const parsed = YAML.parse(fs.readFileSync(filePath, 'utf8')) || {};
    return {
        version: parsed.version || 1,
        contributors: Array.isArray(parsed.contributors) ? parsed.contributors : []
    };
}

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

function normalizeName(name) {
    return String(name || '').trim().toLowerCase();
}

function resolveHandle(map, { name, email }) {
    const nEmail = normalizeEmail(email);
    const nName = normalizeName(name);

    for (const c of map.contributors) {
        if (!c || typeof c !== 'object') continue;
        if (!c.github) continue;
        const emails = Array.isArray(c.emails) ? c.emails.map(normalizeEmail) : [];
        if (nEmail && emails.includes(nEmail)) return c.github;
        const names = Array.isArray(c.names) ? c.names.map(normalizeName) : [];
        if (nName && names.includes(nName)) return c.github;
    }
    return null;
}

function git(repoRoot, args) {
    return execSync(`git ${args}`, { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'] }).toString('utf8');
}

function getRepoRoot() {
    return execSync('git rev-parse --show-toplevel', { stdio: ['ignore', 'pipe', 'pipe'] }).toString('utf8').trim();
}

function getCommitBodies(repoRoot, range) {
    const sepCommit = '\u001e';
    const sepField = '\u001f';
    const out = git(repoRoot, `log ${range} --no-color --format=%H${sepField}%an${sepField}%ae${sepField}%B${sepCommit}`);
    const rawCommits = out.split(sepCommit).map(s => s.trim()).filter(Boolean);
    return rawCommits.map(entry => {
        const parts = entry.split(sepField);
        const [sha, authorName, authorEmail] = parts;
        const body = parts.slice(3).join(sepField);
        return { sha, authorName, authorEmail, body };
    });
}

function extractCoAuthors(commitBody) {
    const out = [];
    const lines = String(commitBody || '').split('\n');
    for (const line of lines) {
        const m = line.match(/^Co-authored-by:\s*(.+?)\s*<(.+?)>\s*$/i);
        if (m) out.push({ name: m[1], email: m[2] });
    }
    return out;
}

function bumpCounter(map, key, display) {
    const existing = map.get(key);
    if (existing) {
        existing.count += 1;
        return;
    }
    map.set(key, { count: 1, display });
}

function fmtHandle(handle) {
    if (!handle) return null;
    return handle.startsWith('@') ? handle : `@${handle}`;
}

function buildContribMarkdown({ from, to, resolvedCounts, unresolvedCounts }) {
    const lines = [];
    const rangeLabel = from && to ? `${from}..${to}` : 'range';

    lines.push(`## Contributors`);
    lines.push('');
    lines.push(`Commit range: ${rangeLabel}`);
    lines.push('');

    const resolved = Array.from(resolvedCounts.entries())
        .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]));

    if (resolved.length > 0) {
        for (const [handle, info] of resolved) {
            lines.push(`- ${fmtHandle(handle)} (${info.count})`);
        }
        lines.push('');
    } else {
        lines.push(`- None`);
        lines.push('');
    }

    const unresolved = Array.from(unresolvedCounts.entries())
        .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]));

    if (unresolved.length > 0) {
        lines.push(`## Unmapped Contributors`);
        lines.push('');
        for (const [key, info] of unresolved) {
            lines.push(`- ${info.display} (${info.count})`);
        }
        lines.push('');
        lines.push(`To tag these contributors, add their name/email to .github/contributors.yml.`);
        lines.push('');
    }

    return lines.join('\n');
}

function main() {
    const args = parseArgs(process.argv);
    if (!args.from || !args.to) {
        process.stderr.write('Usage: node scripts/release-contributors.js --from <tag> --to <tag> [--out <file>]\n');
        process.exit(1);
    }

    const repoRoot = getRepoRoot();
    const contribMap = readContributorsMap(repoRoot);
    const range = `${args.from}..${args.to}`;
    const commits = getCommitBodies(repoRoot, range);

    const resolvedCounts = new Map();
    const unresolvedCounts = new Map();

    for (const c of commits) {
        const authorHandle = resolveHandle(contribMap, { name: c.authorName, email: c.authorEmail });
        if (authorHandle) {
            bumpCounter(resolvedCounts, authorHandle, fmtHandle(authorHandle));
        } else {
            bumpCounter(unresolvedCounts, `${normalizeName(c.authorName)}|${normalizeEmail(c.authorEmail)}`, `${c.authorName} <${c.authorEmail}>`);
        }

        for (const co of extractCoAuthors(c.body)) {
            const coHandle = resolveHandle(contribMap, co);
            if (coHandle) {
                bumpCounter(resolvedCounts, coHandle, fmtHandle(coHandle));
            } else {
                bumpCounter(unresolvedCounts, `${normalizeName(co.name)}|${normalizeEmail(co.email)}`, `${co.name} <${co.email}>`);
            }
        }
    }

    const md = buildContribMarkdown({
        from: args.from,
        to: args.to,
        resolvedCounts,
        unresolvedCounts
    });

    if (args.outFile) {
        const outPath = path.isAbsolute(args.outFile) ? args.outFile : path.join(repoRoot, args.outFile);
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, md, 'utf8');
        process.stdout.write(`${outPath}\n`);
        return;
    }

    process.stdout.write(md + '\n');
}

main();

