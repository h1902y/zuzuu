// src/cli/init.mjs — scaffold a brain into any repo (git-citizen).
//
// what: `zz init` — create the `.zuzuu/` home: the five standard modules (each a
//       module.md envelope + items/ + proposals/), seed guardrail rules, a README,
//       and the gitignore lines for the ephemeral/derived paths.
// why:  the one onboarding step. Everything else (query/act/enhance/review) reads
//       a home; this makes one. It writes envelopes with the note's own
//       serializer — the home is dogfood from byte one.
// how:  git-citizen — resolves the host repo root and plants `.zuzuu/` there;
//       NEVER `git init`s. Idempotent + brownfield-safe: never clobbers an
//       existing module.md or rule (additive only). Zero-dep.

import { existsSync, mkdirSync, writeFileSync, readFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { serialize } from '../notes/note.mjs';
import { homeDir, repoRoot } from '../notes/store.mjs';

// The five us-owned modules: id → manifest envelope (type: module).
const MODULES = [
  { id: 'knowledge', title: 'Knowledge', note_type: 'knowledge', capabilities: ['query', 'check'],
    goal: 'Capture durable, reusable facts about this project and its domain.' },
  { id: 'memory', title: 'Memory', note_type: 'episode', capabilities: ['query', 'check'],
    goal: 'Remember what happened — episodes, decisions, and their outcomes.' },
  { id: 'actions', title: 'Actions', note_type: 'action', capabilities: ['query', 'check', 'act'],
    goal: 'Capture every repeated multi-step procedure as a runnable note.' },
  { id: 'instructions', title: 'Instructions', note_type: 'instruction', capabilities: ['query', 'check'],
    goal: "Keep the agent's standing guidance current and minimal." },
  { id: 'guardrails', title: 'Guardrails', note_type: 'rule', capabilities: ['check'],
    goal: 'Protect against repeated mistakes — as enforced tool gates.' },
];

// Seed guardrail rules — the hard-won patterns (harvested verbatim, incl. the
// no-root-wipe negative-lookahead anchor: the gate matches over JSON.stringify,
// so `/` is followed by `"`, not whitespace).
const RULES = [
  { id: 'no-root-wipe', type: 'rule', title: 'No destructive delete at filesystem root', action: 'deny', tool: 'Bash',
    // The gate matches over the RAW command, so real whitespace works. Requires a
    // whitespace-delimited, optionally-quoted bare `/` after rm + any flags —
    // catches `rm -rf /`, `rm --recursive --force /`, `rm -rf "/"`, tab/chained
    // variants; allows `rm dir/` and `rm -rf /tmp/x`.
    pattern: 'rm\\s[-\\w\\s]*\\s[\'"]?/[\'"]?(?=\\s|$|[;&|\'"])', reason: 'destructive delete at filesystem root',
    body: 'Blocks `rm -rf /` (bare root) plus long-flag (`--recursive --force`), quoted (`"/"`), tab-separated, and chained variants; allows deletes under a path like `/tmp/x`.' },
  { id: 'no-secret-reads', type: 'rule', title: 'No reading secret material', action: 'deny', tool: '*',
    pattern: '\\.env(\\.|\\b)|id_rsa|id_dsa|id_ecdsa|id_ed25519|\\.pem\\b|\\.p12\\b|\\.pfx\\b|\\bcredentials\\b', reason: 'secret material should not enter the context',
    body: 'Keys and env files must not enter the model context — across every tool, not just Bash.' },
  { id: 'confirm-force-push', type: 'rule', title: 'Confirm before force-push', action: 'ask', tool: 'Bash',
    pattern: 'git\\b.*\\bpush\\b.*--force', reason: 'force-push rewrites shared history',
    body: 'Asks (never blocks) on any force-push, including `git -C /path push --force-with-lease`.' },
];

const HOME_README = `# .zuzuu — this project's brain

A directory of **envelopes** (markdown + frontmatter), grown from how you work and
**human-gated**. Each subdirectory is a *module* (its \`module.md\` is the manifest);
each \`items/<id>.md\` is a *note* — one fact, optionally runnable.

- **query** what's known · **act** on a runnable note · **check** integrity
- zuzuu **observes** your sessions and **enhances** — proposing changes you **review**

Tracked files are the durable brain (plain text, versioned). \`.live/\` and
\`.generations/.store/\` are local/derived. Inspect everything with \`zz\`.
`;

const IGNORE_LINES = ['.zuzuu/.live/', '.zuzuu/**/.index.db'];

/**
 * Scaffold the home. Idempotent + brownfield-safe (never clobbers).
 * @returns {{ ok, home, created:string[], skipped:string[] }}
 */
export function initHome(cwd = process.cwd()) {
  const root = repoRoot(cwd);
  const home = homeDir(root);
  const created = [];
  const skipped = [];

  const ensureDir = (p) => { if (!existsSync(p)) mkdirSync(p, { recursive: true }); };
  const writeOnce = (p, content, label) => {
    if (existsSync(p)) { skipped.push(label); return; }
    ensureDir(join(p, '..'));
    writeFileSync(p, content);
    created.push(label);
  };

  ensureDir(home);
  writeOnce(join(home, 'README.md'), HOME_README, 'README.md');

  for (const m of MODULES) {
    ensureDir(join(home, m.id, 'items'));
    ensureDir(join(home, m.id, 'proposals'));
    const manifest = serialize({
      id: m.id, type: 'module', title: m.title, note_type: m.note_type,
      capabilities: m.capabilities, enhance: { goal: m.goal },
    });
    writeOnce(join(home, m.id, 'module.md'), manifest, `${m.id}/module.md`);
  }

  for (const r of RULES) {
    writeOnce(join(home, 'guardrails', 'items', `${r.id}.md`), serialize(r), `guardrails/${r.id}`);
  }

  ensureGitignore(root, home);
  return { ok: true, home, created, skipped };
}

/** Add the home's ignore lines to the repo's .gitignore (idempotent). */
function ensureGitignore(root, home) {
  const gi = join(root, '.gitignore');
  const existing = existsSync(gi) ? readFileSync(gi, 'utf8') : '';
  const missing = IGNORE_LINES.filter((l) => !existing.split('\n').some((line) => line.trim() === l));
  if (!missing.length) return;
  const block = (existing && !existing.endsWith('\n') ? '\n' : '') + '\n# zuzuu (ephemeral/derived)\n' + missing.join('\n') + '\n';
  appendFileSync(gi, block);
}
