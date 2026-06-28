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
import { logMutation, read as readLog } from '../notes/log.mjs';
import { gateWriteVerbPattern } from './commands.mjs';

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
  // The MOAT, enforced: the brain (.zuzuu/) is human-gated, so the agent must not write
  // it directly — every change goes through review (`zz stage` → `zz review approve`).
  // `tool: write` + the canonical write-alias set fires on every host's file-write tool;
  // `match: path` tests the file PATH only (not content), so a normal edit that mentions
  // .zuzuu/ isn't blocked; session worktrees are excluded (that's where the agent works).
  { id: 'protect-brain-writes', type: 'rule', title: 'The brain is human-gated — propose, never write .zuzuu/ directly', action: 'deny', tool: 'write', match: 'path',
    pattern: '\\.zuzuu/(?!worktrees/)',
    reason: 'the brain (.zuzuu/) changes only through review — stage a proposal with `zz stage <module> --op create --target <id> --field title=… --field body=…`, then approve it; never edit .zuzuu/ files directly',
    body: "Denies the agent's DIRECT file writes (Write/Edit/… canonicalized across hosts) into the brain. Path-scoped so it tests the file path, not the content. Session worktrees (.zuzuu/worktrees/) are excluded — that's where the agent works. The only door to the brain is the gate: `zz stage` proposes, `zz review approve` lands it. Reads stay allowed; `zz` itself is unaffected (its commands don't reference the path); human edits aren't gated." },
  { id: 'protect-brain-shell', type: 'rule', title: 'No shell writes into .zuzuu/ — propose instead', action: 'deny', tool: 'Bash',
    // Two shapes: (a) a redirect/`tee`/`sed -i` whose TARGET is under .zuzuu/, and (b) a
    // `cp`/`mv` whose DESTINATION is under .zuzuu/ — the dest is the last path, so we require
    // a SOURCE token (`\s\S*`) before the .zuzuu/ path, which keeps a read-OUT copy
    // (`cp .zuzuu/x /tmp/y`) allowed. Session worktrees stay excepted in both.
    pattern: '(?:(?:>>?|\\btee\\b|\\bsed\\s+-i\\b)[^\\n]*\\.zuzuu/(?!worktrees/))|(?:\\b(?:cp|mv)\\s+[^\\n]*\\s\\S*\\.zuzuu/(?!worktrees/))',
    reason: 'the brain changes only through review — use `zz stage` to propose, never write .zuzuu/ from the shell',
    body: 'Companion to protect-brain-writes for the shell path: denies a redirect (`> …/.zuzuu/…`, absolute or relative), `tee`, `sed -i`, or a `cp`/`mv` INTO the brain (the destination under .zuzuu/), excluding session worktrees. A plain read (`cat .zuzuu/…`, `cat .zuzuu/x > out`) and a read-out copy (`cp .zuzuu/x /tmp/y`) are unaffected; the `zz` write verbs are denied by the companion protect-brain-exec rule.' },
];

// The execution-gate companion (protect-brain-exec): deny the agent shelling a `zz`/`zuzuu`
// WRITE verb — the Bash-bypass hole, since `zz <writeverb>` spawns a fresh OPERATOR process
// the in-process moat can't tell from a human's. Built as a FUNCTION (not a const in RULES)
// because its pattern is generated from the command table (`gateWriteVerbPattern`), and
// calling that at init.mjs module-eval would hit COMMANDS' TDZ under the init↔commands import
// cycle — so it's resolved LAZILY, only when initHome() actually runs.
const execGuardRule = () => ({
  id: 'protect-brain-exec', type: 'rule', title: 'No shelling `zz` WRITE verbs — propose, never mutate via the CLI', action: 'deny', tool: 'Bash',
  pattern: gateWriteVerbPattern(),
  reason: 'a `zz`/`zuzuu` write verb mutates the brain outside review — stage a proposal with `zz stage <module> --op create --target <id> --field title=… --field body=…`, then a human approves it; the read/inspect verbs (query · review · status · gen list · note view · module items) and the sanctioned channels (`zz stage`, `zz observe`) stay allowed',
  body: "Closes the Bash-bypass hole in the moat: the agent reaches the system via Bash, and `zz <writeverb>` spawns a fresh CLI process stamped `operator`, so the in-process actor check (Rung 8) can't stop it. This rule denies any Bash command invoking a zz/zuzuu/`node …/bin/zuzuu.mjs` verb that DURABLY mutates notes/manifests (note set/append/rename/fold/retype, review approve/apply, gen rollback/mint, module new/enable/disable + the schema alter-table ops, …). The pattern is generated from the command table (permission write|admin, non-agent-invokable, + aliases), so it tracks the table automatically. The agent's sanctioned channel — `zz stage` → human `zz review approve` — and every read verb stay allowed.",
});

// Best-practice INSTRUCTIONS — directive guidance (type: instruction, no `action`, so the
// gate skips them). They ride alongside the enforced rules in the same `instructions`
// module: a new Project arrives knowing how to use zuzuu well.
const INSTRUCTIONS = [
  { id: 'review-the-gate', type: 'instruction', title: 'Review proposals — the gate is the moat',
    body: 'Nothing is written to the brain without your approval. Review pending proposals promptly: approve to teach the loop, reject with a reason to correct it. The human gate is what keeps the brain trustworthy.' },
  { id: 'sessions-are-branches', type: 'instruction', title: 'A session is a git branch',
    body: 'Each session runs on its own `zz/session-*` branch — isolated, turn-checkpointed, squash-merged on end. Start a session before a task so the work (and what the loop mines from it) is cleanly scoped.' },
  { id: 'modules-grow-from-work', type: 'instruction', title: 'The brain grows from how you work',
    body: '`observe` mines your real sessions into proposals — you never hand-author the brain. Modules (knowledge · memory · actions · instructions) materialize on demand as the loop routes evidence to them.' },
  { id: 'keep-guidance-minimal', type: 'instruction', title: 'Keep standing guidance minimal',
    body: 'Prune instructions that no longer apply. The agent reads this module every session — fewer, sharper instructions beat a long stale list.' },
  { id: 'the-safety-floor', type: 'instruction', title: 'The rules here are your enforced safety floor',
    body: 'The `type: rule` notes in this module are enforced on every tool call (force-push asks; `rm -rf /`, secret-reads, and direct .zuzuu/ writes deny). Add a rule whenever you spot a risky pattern — the gate confirms or blocks it from then on.' },
  { id: 'propose-never-write', type: 'instruction', title: 'Propose brain changes with `zz stage` — never edit .zuzuu/ by hand',
    body: 'The brain (.zuzuu/) is human-gated: it changes only through review. To add or change a note (knowledge, an instruction, an action, a rule), STAGE a proposal — `zz stage <module> --op create --target <id> --field title="…" --field body="…"` — and it lands only after `zz review approve`. Do NOT create or edit files under .zuzuu/ directly; that bypasses the gate (and the guardrails now deny it). Files in your session worktree are fine — this is only about the brain itself.' },
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
each module's \`generations.json\` lineage + \`log.jsonl\` mutations, and the review
queue — so the Project round-trips across machines. The only gitignored entries are
\`worktrees/\` (live session checkouts) and each module's \`runs.jsonl\` (local run
telemetry); the rebuildable index cache + gate log + session run-state live OUTSIDE
the repo in your OS cache/state dirs. Inspect everything with \`zz\`.`;

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

// What must NOT travel in git. With the rebuildable cache + the gate log + session
// run-state moved OUT of the repo (XDG cache/state dirs, see notes/store.mjs), two
// in-repo machine-local entries remain: `worktrees/` (live session checkouts with
// uncommitted work) and each module's `runs.jsonl` (per-module run telemetry — the
// ephemeral feedback edge observe mines). The DURABLE Project — notes, the mutation
// `log.jsonl`, and each `generations.json` lineage — stays tracked.
const IGNORE_LINES = [
  '.zuzuu/worktrees/',     // per-session git worktrees — machine-local, ephemeral
  '.zuzuu/*/runs.jsonl',   // per-module run telemetry — local + ephemeral (mutations stay tracked)
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

  // Instructions only — the prepacked default: the enforced safety floor (the `rule`
  // notes, gated on every tool call) PLUS best-practice guidance, in one module. The
  // other content modules are NOT scaffolded — they grow on demand (the loop mints
  // their manifests on first proposal). Protection is the exception: it must hold
  // before the first turn.
  ensureDir(join(home, 'instructions', 'items'));
  ensureDir(join(home, 'instructions', 'staged'));
  writeOnce(join(home, 'instructions', 'module.md'), manifestFor('instructions'), 'instructions/module.md');
  // RULES + the table-generated exec guard (resolved here, lazily — see execGuardRule) + the
  // best-practice instructions. Each is seeded once (idempotent) with provenance.
  for (const r of [...RULES, execGuardRule(), ...INSTRUCTIONS]) {
    writeOnce(join(home, 'instructions', 'items', `${r.id}.md`), serialize(r), `instructions/${r.id}`);
    ensureSeedLogged(home, 'instructions', r.id); // Layer 4: provenance for the seed
  }

  ensureGitignore(root, home);
  return { ok: true, home, created, skipped };
}

/** Layer 4 provenance: ensure a seeded note has a `create` mutation in its module log
 *  (actor: init), so `zz check` can tell SEEDED notes from ones written directly outside
 *  review. Idempotent — re-running `zz init` reconciles existing seeds (so a pre-
 *  provenance Project gets clean provenance, leaving only true bypasses flagged).
 *  Best-effort: a log failure never blocks init. */
function ensureSeedLogged(home, module, id) {
  try {
    const already = readLog(home, module, 'mutations').some((e) => e && e.note === id);
    if (!already) logMutation(home, module, 'create', id, { actor: 'init', source: 'seed' });
  } catch { /* provenance is best-effort */ }
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
