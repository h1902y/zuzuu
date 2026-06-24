// src/cli/init.mjs — plant a Project into any repo (git-citizen).
//
// what: `zz init` — create the `.zuzuu/` home (the repo's **Project**): the
//       Project manifest (`project.md`), an EMPTY brain plus the protective
//       guardrails safety floor (its module.md + seed rules), and the gitignore
//       lines for the ephemeral/derived paths. No prebuilt content modules —
//       knowledge/memory/actions/instructions materialize on demand as the loop
//       grows the Project (their manifests are minted on first proposal; see
//       src/grow/stage.mjs + src/notes/module-templates.mjs).
// why:  the one onboarding step. Everything else (query/act/observe/review) reads
//       a Project; this makes one. A fresh repo starts empty (the honest onboarding
//       state) — only guardrails ship, because protection must hold from byte one.
//       It writes envelopes with the note's own serializer — dogfood from byte one.
// how:  git-citizen — resolves the host repo root and plants `.zuzuu/` there;
//       NEVER `git init`s. Idempotent + brownfield-safe: never clobbers an
//       existing module.md or rule (additive only). Zero-dep.

import { existsSync, mkdirSync, writeFileSync, readFileSync, appendFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { serialize } from '../notes/note.mjs';
import { manifestFor } from '../notes/module-templates.mjs';
import { homeDir, repoRoot } from '../notes/store.mjs';

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

// The Project body — the explainer that rides in `project.md`'s manifest body.
const PROJECT_BODY = `A **Project** is this \`.zuzuu/\` directory of **envelopes** (markdown + frontmatter),
grown from how you work and **human-gated**. This file (\`project.md\`) is the Project's
own manifest; each subdirectory is a *module* (its \`module.md\` is the manifest); each
\`items/<id>.md\` is a *note* — one fact, optionally runnable. The hierarchy is
**note › module › Project**.

- **query** what's known · **act** on a runnable note · **check** integrity
- zuzuu **observes** your sessions and **proposes** changes you **review**

Everything in \`.zuzuu/\` is the durable Project (plain text, versioned) — notes,
each module's \`generations.json\` lineage, and the review queue — so the Project
round-trips across machines. Only \`worktrees/\` (live session checkouts) is
gitignored; the rebuildable index cache + transient run-state live OUTSIDE the repo
in your OS cache/state dirs. Inspect everything with \`zz\`.`;

// The session-steering template (Plane 3) — the human-authored, pinned contract the
// session brief reads. Placeholder prose the operator edits; `goals` is rendered in
// the brief today, the rest are read by the opener/closer/drift surfaces. Kept lean.
const STEERING_TEMPLATE = {
  goals: 'What this project is for — the standing intent (edit me).',
  opener: 'Begin a session: state the task, the files in scope, and a Done-when signal.',
  closer: 'End a session: summarize what shipped, the decisions made, and the next task.',
  drift: 'Off-scope signals: touching files outside the task, or >3 turns on one error.',
};

/** The Project manifest (`project.md`, type: project) — the top-of-hierarchy envelope
 *  that declares the Project. Title defaults to the repo's directory name; ships a
 *  `steering` template the operator fills in. */
const projectManifest = (root) =>
  serialize({ type: 'project', title: basename(root) || 'project', format: 'zuzuu/v2', steering: STEERING_TEMPLATE, body: PROJECT_BODY });

// What must NOT travel in git. With the rebuildable cache + transient run-state moved
// OUT of the repo (XDG cache/state dirs, see notes/store.mjs), the only in-repo
// machine-local entry left is `worktrees/` — live session checkouts with uncommitted
// work. EVERYTHING else under `.zuzuu/` is durable, tracked Project.
const IGNORE_LINES = [
  '.zuzuu/worktrees/',    // per-session git worktrees — machine-local, ephemeral
];

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
  writeOnce(join(home, 'project.md'), projectManifest(root), 'project.md');

  // Guardrails only — the protective safety floor. The four content modules are
  // NOT scaffolded: they grow on demand (the loop mints their manifests on first
  // proposal). Protection is the exception — it must hold before the first turn.
  ensureDir(join(home, 'guardrails', 'items'));
  ensureDir(join(home, 'guardrails', 'staged'));
  writeOnce(join(home, 'guardrails', 'module.md'), manifestFor('guardrails'), 'guardrails/module.md');
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
