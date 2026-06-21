// src/loop/enhance.mjs — propose growth from what happened.
//
// what: the `enhance` verb — mine a module's event log (and, when wired, the
//       session conversation) for evidence-backed, typed proposals toward the
//       module's enhance.goal. Never writes; stages proposals for review.
// why:  the compounding engine. It mines what WORKED (outcomes), not just what
//       was said — the event log is the feedback edge.
// how:  deterministic signals over runs.jsonl (here: co-invocation → a relation;
//       expandable to fix / stale / gap). Conversation-driven create/update is a
//       documented seam (the in-session judge, wired by the observe pipeline).
//       Zero-dep, fail-soft.

import { read } from './log.mjs';
import { itemsDir } from '../notes/store.mjs';
import { existsSync, readdirSync } from 'node:fs';
import { createProposal } from './propose.mjs';

/** Known note ids in a module (so proposals reference real items). */
function knownItems(home, module) {
  const dir = itemsDir(home, module);
  return existsSync(dir) ? new Set(readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3))) : new Set();
}

/**
 * Mine the module's runs for co-invocation: items run in the SAME session across
 * ≥ threshold distinct sessions → propose a typed relation between them.
 * (The corroboration threshold from Generative Agents — don't propose on first sight.)
 * @returns {Array} the proposals staged
 */
export function mineCoInvocation(home, module, { threshold = 2 } = {}) {
  const runs = read(home, module, 'runs').filter((e) => e.session && e.item);
  const bySession = new Map();
  for (const e of runs) {
    if (!bySession.has(e.session)) bySession.set(e.session, new Set());
    bySession.get(e.session).add(e.item);
  }
  // count distinct sessions each unordered pair co-occurred in
  const pairCount = new Map();
  for (const items of bySession.values()) {
    const arr = [...items].sort();
    for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
      const k = `${arr[i]}|${arr[j]}`;
      pairCount.set(k, (pairCount.get(k) ?? 0) + 1);
    }
  }
  const known = knownItems(home, module);
  const staged = [];
  for (const [pair, n] of pairCount) {
    if (n < threshold) continue;
    const [a, b] = pair.split('|');
    if (!known.has(a) || !known.has(b)) continue;
    const p = createProposal(home, module, {
      op: 'relate', target: a, change: { from: a, type: 'related-to', to: b },
      rationale: `'${a}' and '${b}' were run together in ${n} sessions`,
      evidence: [{ kind: 'co-invocation', sessions: n }],
      confidence: Math.min(0.5 + n * 0.1, 0.9), score: n * 10,
    });
    if (p && !p.duplicate) staged.push(p);
  }
  return staged;
}

/**
 * The `enhance` capability handler. v1: deterministic log signals. The
 * conversation-driven create/update path (the in-session judge) plugs in here
 * once the observe pipeline supplies the session transcript.
 * @returns {{ proposed: number, proposals: Array }}
 */
export function enhance(ctx, opts = {}) {
  const proposals = [];
  try { proposals.push(...mineCoInvocation(ctx.home, ctx.module, opts)); } catch { /* fail-soft */ }
  // SEAM: conversation mining (knowledge facts, reverted-episode "avoid X",
  //       new actions) is added by the observe pipeline (rung 6) which supplies
  //       the session's two tracks. Kept out of the deterministic core here.
  return { proposed: proposals.length, proposals };
}
