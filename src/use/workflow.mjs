// src/use/workflow.mjs — run a multi-step workflow note (a DAG of run-steps).
//
// what: execute a `type: workflow` note — its `steps` (each a `run` + optional
//       `depends-on`) in topological order, each through the SAME execution gate as
//       `act`. Stop on the first failure and run completed steps' `compensate`
//       commands in reverse (saga-style — the one place note-ops need compensation,
//       because steps have external shell side effects).
// why:  `act` runs a single command; a repeated multi-step procedure is a workflow.
//       Reuses runGated so every step is gate + allowlist checked, like any run.
// how:  Kahn topo-sort → sequential gated execution → capture per step. Read-only on
//       notes (it runs commands, writes none). Zero-dep, fail-soft.
//
// Deferred (Temporal-grade): per-step idempotency `key` + persisted resume — a step
// re-runs each invocation today; add a key/cursor when long workflows need resume.

import { existsSync, readFileSync } from 'node:fs';
import { parse } from '../notes/note.mjs';
import { itemPath, repoRoot } from '../notes/store.mjs';
import { readManifest } from '../notes/module.mjs';
import { logRun } from '../notes/log.mjs';
import { runGated } from './act.mjs';

/** Topologically order steps by `depends-on`; null on a cycle / missing dep. */
function topoSort(steps) {
  const byId = new Map(steps.map((s) => [s.id, s]));
  const deps = new Map(steps.map((s) => [s.id, [].concat(s['depends-on'] ?? []).filter(Boolean)]));
  for (const ds of deps.values()) if (ds.some((d) => !byId.has(d))) return null; // dangling dep
  const indeg = new Map(steps.map((s) => [s.id, deps.get(s.id).length]));
  const queue = steps.filter((s) => indeg.get(s.id) === 0).map((s) => s.id);
  const order = [];
  while (queue.length) {
    const id = queue.shift();
    order.push(id);
    for (const s of steps) if (deps.get(s.id).includes(id)) { indeg.set(s.id, indeg.get(s.id) - 1); if (indeg.get(s.id) === 0) queue.push(s.id); }
  }
  return order.length === steps.length ? order.map((id) => byId.get(id)) : null; // cycle → null
}

/**
 * Run a workflow note. @returns {{ ok, steps?, failedStep?, compensations?, error? }}
 */
export function runWorkflow(home, module, id, inputs = {}) {
  const path = itemPath(home, module, id);
  if (!existsSync(path)) return { ok: false, error: `no note '${module}:${id}'` };
  const { note } = parse(readFileSync(path, 'utf8'), { id });
  if (note?.type !== 'workflow' || !Array.isArray(note.steps) || !note.steps.length) return { ok: false, error: `'${id}' is not a workflow (needs type: workflow + steps)` };
  if (note.steps.some((s) => !s || !s.id || !s.run)) return { ok: false, error: 'every step needs an id and a run' };
  const ordered = topoSort(note.steps);
  if (!ordered) return { ok: false, error: 'workflow steps have a cycle or a dangling depends-on' };

  const allow = readManifest(home, module).policy?.run?.allow ?? null;
  const root = repoRoot();
  const results = [];
  const done = [];
  for (const step of ordered) {
    const r = runGated(home, module, step.run, { allow, inputs, cwd: root });
    results.push({ id: step.id, ran: r.ran, success: !!r.success, exitCode: r.exitCode, denied: r.denied });
    if (!r.ran || !r.success) {
      // compensate completed steps in reverse (saga rollback for side effects)
      const compensations = [];
      for (const s of [...done].reverse()) if (s.compensate) {
        const c = runGated(home, module, s.compensate, { allow, inputs, cwd: root });
        compensations.push({ id: s.id, success: !!c.success });
      }
      logRun(home, module, id, { inputs, success: false });
      return { ok: false, failedStep: step.id, error: r.error ?? `step '${step.id}' failed (exit ${r.exitCode})`, steps: results, compensations };
    }
    done.push(step);
  }
  logRun(home, module, id, { inputs, success: true });
  return { ok: true, steps: results };
}
