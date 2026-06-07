import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import YAML from 'yaml';

function parseArgs(argv) {
    const out = { tag: null, prev: null, outFile: null };
    for (let i = 2; i < argv.length; i += 1) {
        const arg = argv[i];
        const next = argv[i + 1];
        if (arg === '--tag' && next) {
            out.tag = next;
            i += 1;
        } else if (arg === '--prev' && next) {
            out.prev = next;
            i += 1;
        } else if (arg === '--out' && next) {
            out.outFile = next;
            i += 1;
        }
    }
    return out;
}

function git(repoRoot, args) {
    return execSync(`git ${args}`, { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'] }).toString('utf8');
}

function getRepoRoot() {
    return execSync('git rev-parse --show-toplevel', { stdio: ['ignore', 'pipe', 'pipe'] }).toString('utf8').trim();
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

function fmtHandle(handle) {
    if (!handle) return null;
    return handle.startsWith('@') ? handle : `@${handle}`;
}

function bumpCounter(map, key) {
    map.set(key, (map.get(key) || 0) + 1);
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

function getCommitBodies(repoRoot, range) {
    const sepCommit = '\u001e';
    const sepField = '\u001f';
    const out = git(repoRoot, `log ${range} --no-color --format=%H${sepField}%an${sepField}%ae${sepField}%s${sepField}%B${sepCommit}`);
    const rawCommits = out.split(sepCommit).map(s => s.trim()).filter(Boolean);
    return rawCommits.map(entry => {
        const parts = entry.split(sepField);
        const [sha, authorName, authorEmail, subject] = parts;
        const body = parts.slice(4).join(sepField);
        return { sha, authorName, authorEmail, subject, body };
    });
}

function determinePrevTag(repoRoot, tag) {
    try {
        return git(repoRoot, `describe --tags --abbrev=0 ${tag}^`).trim();
    } catch {
        return null;
    }
}

function buildReleaseMarkdown({ tag, prev, commits, contributors }) {
    const lines = [];

    lines.push(`# ${tag}`);
    lines.push('');

    if (prev) {
        lines.push(`Changes since ${prev}`);
        lines.push('');
    }

    if (commits.length > 0) {
        lines.push(`## Changes`);
        lines.push('');
        for (const c of commits) {
            const sha = String(c.sha || '').slice(0, 7);
            lines.push(`- ${c.subject} (${sha})`);
        }
        lines.push('');
    }

    lines.push(`## Contributors`);
    lines.push('');

    const sorted = Array.from(contributors.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

    if (sorted.length === 0) {
        lines.push(`- None`);
        lines.push('');
        return lines.join('\n');
    }

    for (const [handle, count] of sorted) {
        lines.push(`- ${fmtHandle(handle)} (${count})`);
    }
    lines.push('');

    return lines.join('\n');
}

function main() {
    const args = parseArgs(process.argv);
    if (!args.tag) {
        process.stderr.write('Usage: node scripts/release-notes.js --tag <tag> [--prev <tag>] [--out <file>]\n');
        process.exit(1);
    }

    const repoRoot = getRepoRoot();
    const prev = args.prev || determinePrevTag(repoRoot, args.tag);
    const range = prev ? `${prev}..${args.tag}` : args.tag;

    const contribMap = readContributorsMap(repoRoot);
    const commits = getCommitBodies(repoRoot, range);

    const contributors = new Map();

    for (const c of commits) {
        const authorHandle = resolveHandle(contribMap, { name: c.authorName, email: c.authorEmail });
        if (authorHandle) bumpCounter(contributors, authorHandle);

        for (const co of extractCoAuthors(c.body)) {
            const coHandle = resolveHandle(contribMap, co);
            if (coHandle) bumpCounter(contributors, coHandle);
        }
    }

    const md = buildReleaseMarkdown({
        tag: args.tag,
        prev,
        commits,
        contributors
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

