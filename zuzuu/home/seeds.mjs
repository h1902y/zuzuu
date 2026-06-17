// zuzuu/home/seeds.mjs — the pinned seed CONTENT for `zuzuu init`.
//
// Pure definitions: the per-module README explainers, the steering envelope
// seed, the descriptive envelope spec, and the schema/manifest serializers. The
// scaffold logic (LAYOUT + plan/apply) lives in scaffold.mjs and imports these.
//
// NOTE: the guardrail RULE_SEEDS deliberately stay in scaffold.mjs (not here) —
// their `pattern:` fields contain the literal secret-material regex the enforced
// no-secret-reads gate matches, so they cannot move through a new file write.
//
// Seeds are PINNED definitions — idempotent re-inits must produce byte-identical
// files, so the seed timestamp is deterministic (never Date.now()).

import { serializeEnvelope, PAYLOAD_SCHEMAS, MODULE_KINDS } from '../module/envelope.mjs';
import { BUILTIN_MODULES } from '../module/registry.mjs';

// Deterministic seed timestamp (the Module Standard date) — seeds are pinned
// definitions, so idempotent re-inits must produce byte-identical files. Shared
// with scaffold.mjs's rule seeds so every seed carries the same created_at.
export const SEED_AT = '2026-06-12T00:00:00Z';

export const AGENT_README = `# .zuzuu/ — your agent's home (hidden, like .git — yours to read & version)

This directory is your agent's evolving brain. Five **modules** grow from how you
actually work — and **nothing changes without your approval**. It's dot-prefixed to
stay out of your way; everything inside is plain text, versioned in git, and
surfaced by \`zuzuu status\` / \`zuzuu explain\` / \`zuzuu digest\`.

## The five modules
- **knowledge/** — what's TRUE (facts about this project)
- **memory/** — what HAPPENED (curated episodes from past sessions)
- **actions/** — how to DO things (runbooks the agent can call)
- **instructions/** — who to BE (steering / project conventions)
- **guardrails/** — what NOT to do (enforced rules, checked on every tool call)

## How things graduate (you're in the loop)
    a session runs  →  zuzuu mines candidates  →  inbox/  →  proposals/
                                                              │  you decide
                                                    zuzuu review  (y / n / edit)
                                                              ▼
                                          approved → the module + a new *generation*
A **generation** is a per-module pinned lineage; approving proposals mints one per
affected module. A **checkpoint** composes them for whole-brain coherence —
\`zuzuu checkpoint rollback <id>\` restores every module to that pinned moment.

## Get in the loop
- \`zuzuu inbox\`            — what's waiting for your approval
- \`zuzuu review\`          — approve / reject, one at a time
- \`zuzuu checkpoint list\` — your whole-brain checkpoints
- \`zuzuu module <m> generations\` — one module's lineage (● = active)
- \`zuzuu explain\`         — this model, any time

## What to ignore
\`.traces/\`, \`.live/\`, and \`knowledge/.index.db\` are machine internals (git-ignored).
Everything else here is yours to read, edit, and version in git.
`;

export const KNOWLEDGE_README = `# knowledge/ — the Knowledge module (what's TRUE)

Items in \`items/\` — one fact/entity per file: prose body + typed attributes +
typed relations (registry-governed: \`registry/\`) + provenance. The derived
search index (\`.index.db\`, git-ignored) gives lexical/graph/semantic recall:
\`zuzuu recall\`. Candidates arrive in \`inbox/\` (from agents or \`zuzuu distill\`),
become \`proposals/\`, and a human approves via \`zuzuu review\` — never silently.
\`zuzuu remember\` writes directly (the human IS the gate). \`zuzuu knowledge audit\`
checks health.
`;

export const MEMORY_README = `# memory/ — episodic module (what HAPPENED)

Curated recollections of past sessions, distilled from the observability traces (\`.zuzuu/.traces/\`).
- **Who writes:** zuzuu (distillation — *not built yet*), human (curation). Raw traces stay in traces/ — this is the *curated* layer.
- **Where:** one Markdown file per entry under \`entries/\`, named \`<id>.md\`.

## Record schema (the Module Standard envelope)
\`\`\`markdown
---
id: mem-2026-06-11-flaky-ci-retry      # mem-<YYYY-MM-DD>-<slug>, stable
module: memory
kind: episode
title: Flaky CI fixed by pinning node 22
status: active
created_at: 2026-06-11                 # ISO date the episode occurred
payload:
  sessions:                            # ids that exist in .zuzuu/sessions.json
    - ses_abc123
  hosts:
    - claude-code
  tags:                                # optional
    - ci
    - flaky-test
---
## Attempted
What was tried.
## Resulted
What happened (outcome / error / fix).
## Remember next time
The durable lesson.
\`\`\`
`;

export const ACTIONS_README = `# actions/ — procedural module (how to DO things)

Named, reusable procedures/skills for this project (scripts, runbooks, tool recipes).
- **Who writes:** the human; later, zuzuu proposes crystallized actions mined from traces (human-approved).
- **Contract:** one action per file; state what it does, inputs, and how to invoke it.
- **Propose a reusable action**: \`zuzuu act propose <slug>\` scaffolds into \`actions/inbox/\` for review. A human approves via \`zuzuu review\` (or \`zuzuu act approve <slug>\`). Never write active actions directly from an agent.
`;

export const INSTRUCTIONS_README = `# instructions/ — the Instructions module (directive: who the agent is)

Cognition steering: identity, conventions, priorities — the project-level seed of
the pinned system prompt. The host agent reads and follows this.
- \`items/steering.md\` — the pinned steering item (what this is, conventions, priorities).
- Approved amendments land as further items in \`items/\` (kind: amendment).
- Hard *enforced* rules live in \`../guardrails/\` (a separate module), not here.
`;

export const STEERING_SEED = serializeEnvelope({
  id: 'steering',
  module: 'instructions',
  kind: 'steering',
  title: 'Project steering',
  status: 'active',
  created_at: SEED_AT,
  payload: { scope: 'project' },
  body: '<!-- Fill in: what this project is, conventions, priorities. The host agent reads this. -->',
});

export const GUARDRAILS_README = `# guardrails/ — the Guardrails module (enforced, not advisory)

One rule per envelope item in \`items/\` (markdown + frontmatter; payload =
\`{ action: deny|ask|allow, tool: "Bash"|"*", pattern: <regex over the tool
input>, reason }\`; the body is optional rationale prose). Every tool call is
evaluated by the zuzuu PreToolUse gate (installed by \`zuzuu enable\`). Severity
wins: deny > ask > allow; no match → the host's normal permission flow. The
engine FAILS OPEN — a malformed item is skipped, never a block — and matched
decisions are logged for the trace. Edit, commit, done — rules are definitions,
versioned in git like everything else.
`;

/** Envelope spec seed (.zuzuu/schema.json) — descriptive, for humans + tools. */
export const ENVELOPE_SPEC = JSON.stringify(
  {
    standard: 'zuzuu-module-envelope',
    version: 1,
    description: 'One file per item: markdown body + strict frontmatter. One rigid envelope across all five modules; payload is module-typed and validated by <module>/schema.json.',
    envelope: {
      id: 'required — slug [a-z0-9-]',
      module: 'required — knowledge|memory|actions|instructions|guardrails',
      kind: 'required — per-module kinds (see kinds)',
      title: 'required — single line',
      status: 'active|archived (default active)',
      created_at: 'required — ISO date/datetime',
      updated_at: 'optional — ISO date/datetime',
      provenance: 'optional list of {session, ref}',
      payload: 'module-typed machine fields (see <module>/schema.json)',
    },
    kinds: { ...MODULE_KINDS, knowledge: 'registry-governed (knowledge/registry/types.json)' },
  },
  null,
  2,
) + '\n';

/** Payload schema seed (<module>/schema.json) — the built-in default, serialized. */
export const payloadSchemaSeed = (f) => JSON.stringify(PAYLOAD_SCHEMAS[f], null, 2) + '\n';

/** Module manifest seed (module.json) — the built-in module's canonical
 *  manifest, serialized. Pinned definitions: byte-identical on re-init. */
export const manifestSeed = (f) => JSON.stringify(BUILTIN_MODULES[f].manifest, null, 2) + '\n';
