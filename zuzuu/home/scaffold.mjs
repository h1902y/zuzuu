// The module-home scaffold — the layout contract for `zuzuu init`.
//
// Git-init discipline: idempotent and never destructive. plan() inspects what
// exists; apply() creates ONLY what's missing — it never overwrites a file, so
// user edits to any seeded file always survive a re-init.
//
// Layout = the five modules (docs/DESIGN.md §3①, the 5+3 anatomy):
//   .zuzuu/agent.json + knowledge/ memory/ actions/ instructions/ guardrails/
// The home is HIDDEN (.zuzuu/, like .git — decided 2026-06-12, DESIGN §13):
// transparency comes from porcelain (zz status/explain/digest) + plain-text
// files inside; the only visible footprint is the managed block + .gitignore lines.
// Guardrails became first-class (enforced via the PreToolUse gate) on 2026-06-10;
// the old instructions/guardrails.md advisory seed left the layout (existing
// projects keep theirs — no-clobber — but new scaffolds get the real module).

import { join } from 'node:path';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { SEED_TYPES, SEED_ATTRIBUTES, SEED_RELATIONS } from '../knowledge/registry.mjs';
import { serializeEnvelope } from '../module/envelope.mjs';
import {
  SEED_AT,
  AGENT_README, KNOWLEDGE_README, MEMORY_README, ACTIONS_README,
  INSTRUCTIONS_README, GUARDRAILS_README, STEERING_SEED, ENVELOPE_SPEC,
  payloadSchemaSeed, manifestSeed,
} from './seeds.mjs';

// Re-export the manifest seed (its consumers historically imported it from here).
export { manifestSeed } from './seeds.mjs';

export const MANIFEST_VERSION = 4;

/** Seeded rules, one envelope item each (the Module Standard, W24). The rule
 *  seeds stay HERE (not in seeds.mjs) because their `pattern:` fields carry the
 *  literal secret-material regex the enforced no-secret-reads gate matches. */
const ruleSeed = ({ id, title, action, tool, pattern, reason, body }) =>
  serializeEnvelope({
    id, module: 'guardrails', kind: 'rule', title, status: 'active', created_at: SEED_AT,
    payload: { action, tool, pattern, reason }, body,
  });

const RULE_SEEDS = {
  'no-root-wipe': ruleSeed({
    id: 'no-root-wipe', title: 'No destructive delete at filesystem root', action: 'deny', tool: 'Bash',
    // The gate matches over JSON.stringify(tool_input), so the bare root `/` is
    // followed by `"` (the JSON quote), not whitespace/end. A `(\s|$)` anchor
    // therefore MISSES the exact `rm -rf /`. Use a negative lookahead — "/ not
    // followed by a path char" — which catches the bare root whether raw,
    // JSON-wrapped, or chained (`rm -rf /;`), while still allowing `rm -rf /tmp/x`.
    pattern: 'rm\\s+-[a-z]*r[a-z]*\\s+/(?![\\w/])', reason: 'destructive delete at filesystem root',
    body: 'Blocks `rm -rf /` (bare root) and flag-order/chained variants; allows deletes under a path like `/tmp/x`.',
  }),
  'no-secret-reads': ruleSeed({
    id: 'no-secret-reads', title: 'No reading secret material', action: 'deny', tool: '*',
    pattern: '\\.env(\\.|\\b)|id_rsa|\\.pem\\b', reason: 'secret material should not enter the context',
    body: 'Keys and env files must not enter the model context — across every tool, not just Bash.',
  }),
  'confirm-force-push': ruleSeed({
    id: 'confirm-force-push', title: 'Confirm before force-push', action: 'ask', tool: 'Bash',
    pattern: 'git\\b.*\\bpush\\b.*--force', reason: 'force-push rewrites shared history',
    // \b.*\bpush, not push adjacent to git: a real session bypassed the
    // adjacent form with `git -C /path push --force-with-lease` (exp-8).
    body: 'Asks (never blocks) on any force-push. The loose `git\\b.*\\bpush` form catches the real exp-8 bypass: `git -C /path push --force-with-lease`.',
  }),
};

/** The layout contract: dirs + seed files (relative to the project root). */
export const LAYOUT = {
  dirs: ['.zuzuu', '.zuzuu/knowledge', '.zuzuu/knowledge/registry', '.zuzuu/knowledge/items', '.zuzuu/knowledge/inbox', '.zuzuu/knowledge/proposals', '.zuzuu/memory', '.zuzuu/memory/entries', '.zuzuu/memory/inbox', '.zuzuu/memory/proposals', '.zuzuu/actions', '.zuzuu/actions/inbox', '.zuzuu/instructions', '.zuzuu/instructions/items', '.zuzuu/instructions/inbox', '.zuzuu/instructions/proposals', '.zuzuu/guardrails', '.zuzuu/guardrails/items', '.zuzuu/guardrails/inbox', '.zuzuu/guardrails/proposals'],
  files: {
    '.zuzuu/README.md': AGENT_README,
    '.zuzuu/schema.json': ENVELOPE_SPEC,
    '.zuzuu/knowledge/README.md': KNOWLEDGE_README,
    '.zuzuu/knowledge/schema.json': payloadSchemaSeed('knowledge'),
    '.zuzuu/knowledge/module.json': manifestSeed('knowledge'),
    '.zuzuu/memory/README.md': MEMORY_README,
    '.zuzuu/memory/schema.json': payloadSchemaSeed('memory'),
    '.zuzuu/memory/module.json': manifestSeed('memory'),
    '.zuzuu/actions/README.md': ACTIONS_README,
    '.zuzuu/actions/schema.json': payloadSchemaSeed('actions'),
    '.zuzuu/actions/module.json': manifestSeed('actions'),
    '.zuzuu/instructions/README.md': INSTRUCTIONS_README,
    '.zuzuu/instructions/schema.json': payloadSchemaSeed('instructions'),
    '.zuzuu/instructions/module.json': manifestSeed('instructions'),
    '.zuzuu/instructions/items/steering.md': STEERING_SEED,
    '.zuzuu/guardrails/README.md': GUARDRAILS_README,
    '.zuzuu/guardrails/schema.json': payloadSchemaSeed('guardrails'),
    '.zuzuu/guardrails/module.json': manifestSeed('guardrails'),
    '.zuzuu/guardrails/items/no-root-wipe.md': RULE_SEEDS['no-root-wipe'],
    '.zuzuu/guardrails/items/no-secret-reads.md': RULE_SEEDS['no-secret-reads'],
    '.zuzuu/guardrails/items/confirm-force-push.md': RULE_SEEDS['confirm-force-push'],
    '.zuzuu/knowledge/registry/types.json': JSON.stringify(SEED_TYPES, null, 2) + '\n',
    '.zuzuu/knowledge/registry/attributes.json': JSON.stringify(SEED_ATTRIBUTES, null, 2) + '\n',
    '.zuzuu/knowledge/registry/relations.json': JSON.stringify(SEED_RELATIONS, null, 2) + '\n',
  },
};

/** Gitignore lines the project needs (trace blobs + liveness state stay local). */
export const IGNORE_LINES = ['.zuzuu/.traces/', '.zuzuu/.live/', '.zuzuu/knowledge/.index.db', '.gemini/settings.json', '.codex/hooks.json', '.pi/extensions/zuzuu.ts'];

export function manifest(initializedAt) {
  return {
    version: MANIFEST_VERSION,
    initializedAt,
    layout: ['knowledge', 'memory', 'actions', 'instructions', 'guardrails'],
  };
}

/**
 * Inspect the project: which layout pieces are missing?
 * @returns {{dirs: string[], files: string[], manifestMissing: boolean}}
 */
export function planScaffold(cwd) {
  const dirs = LAYOUT.dirs.filter((d) => !existsSync(join(cwd, d)));
  const files = Object.keys(LAYOUT.files).filter((f) => !existsSync(join(cwd, f)));
  const manifestMissing = !existsSync(join(cwd, '.zuzuu', 'agent.json'));
  return { dirs, files, manifestMissing };
}

/**
 * Create ONLY the missing pieces (no-clobber). Returns what was created.
 * @param {string} cwd
 * @param {{now?: number}} opts  injectable clock for tests
 */
export function applyScaffold(cwd, { now = Date.now() } = {}) {
  const plan = planScaffold(cwd);
  for (const d of plan.dirs) mkdirSync(join(cwd, d), { recursive: true });
  for (const f of plan.files) writeFileSync(join(cwd, f), LAYOUT.files[f]);
  if (plan.manifestMissing) {
    mkdirSync(join(cwd, '.zuzuu'), { recursive: true });
    writeFileSync(join(cwd, '.zuzuu', 'agent.json'), JSON.stringify(manifest(new Date(now).toISOString()), null, 2) + '\n');
  }
  return plan;
}

/**
 * Ensure the project .gitignore carries our ignore lines (append-only; creates
 * the file if absent). Returns the lines actually added.
 */
export function ensureGitignore(cwd) {
  const path = join(cwd, '.gitignore');
  const existing = existsSync(path) ? readFileSync(path, 'utf8') : '';
  const have = new Set(existing.split('\n').map((l) => l.trim()));
  const missing = IGNORE_LINES.filter((l) => !have.has(l));
  if (!missing.length) return [];
  const block = (existing && !existing.endsWith('\n') ? '\n' : '') + '\n# zuzuu: local-only observability data\n' + missing.join('\n') + '\n';
  writeFileSync(path, existing + block);
  return missing;
}

/** Is there a zuzuu home here already? (the git-detect question) */
export function homeExists(cwd) {
  return existsSync(join(cwd, '.zuzuu'));
}
