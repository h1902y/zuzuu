// src/cli/verbs/run.mjs — the `run` namespace: the Tier-2 DURABLE RUNNER's CLI door.
// "the run is a note" (§I.3/§I.4) — `run start` materializes the state machine,
// `run advance` ticks it one step (`--all` ticks to done/waiting/failed), `run
// signal`/`run complete` resolve a wait. Composed into THE table by ../commands.mjs
// — the one-table invariant lives there.

import { open } from '../../serve/api.mjs';
import { startRun, advanceRun, advanceAll, signalRun, completeStep } from '../../grow/run.mjs';
import { fail, emit, fieldPairs } from '../args.mjs';

function splitAddr(addr) {
  const s = String(addr ?? '');
  const i = s.indexOf(':');
  return i > 0 && i < s.length - 1 ? { module: s.slice(0, i), id: s.slice(i + 1) } : null;
}

export const runRows = [
  {
    path: ['run', 'start'], plane: 'data', json: true, permission: 'write', agentInvokable: false,
    usage: 'run start <workflow-module:id> [--input k=v …]',
    summary: 'start a run from a workflow (does not execute yet)',
    io: { params: ['addr'], flags: {} },
    handler: ({ args, cwd, log, json, rest }) => {
      const addr = splitAddr(args._[0]);
      if (!addr) return fail(log, 'usage: zz run start <workflow-module:id> [--input k=v …]', json);
      const inputs = fieldPairs(rest, undefined, '--input');
      const r = startRun(open(cwd).home, addr.module, addr.id, inputs);
      if (!r.ok) return fail(log, r.error, json);
      const row = { id: r.runId, workflow: args._[0], generation: r.run.workflow_generation, status: r.run.status, steps: r.run.steps.length };
      emit(log, json, { ok: true, runId: r.runId, run: r.run }, ['run', [row], ['id', 'workflow', 'generation', 'status', 'steps'], [`zz run advance ${r.runId}`]]);
      return 0;
    },
  },
  {
    path: ['run', 'advance'], plane: 'data', json: true, permission: 'write', agentInvokable: false,
    usage: 'run advance <run-id> [--all]', summary: 'advance a run one step (--all runs it to the end)',
    io: { params: ['id'], flags: { all: '--all' } },
    handler: ({ args, cwd, log, json }) => {
      // `zz run advance --all <run-id>` (the brief's own usage order) has the naive
      // flag-parser swallow the id as --all's VALUE (same footgun `query --all` works
      // around) — accept id-first OR --all-first.
      const all = !!args.all;
      const id = args._[0] || (args.all && args.all !== true ? String(args.all) : '');
      if (!id) return fail(log, 'usage: zz run advance <run-id> [--all]', json);
      const home = open(cwd).home;
      const r = all ? advanceAll(home, id) : advanceRun(home, id);
      if (r.status === undefined) return fail(log, r.error || 'advance failed', json); // a hard tick error, not a workflow outcome
      const step = r.step ?? r.retrying ?? r.failedStep ?? '';
      emit(log, json, r, ['advance', [{ run: id, status: r.status, step, ok: r.ok }], ['run', 'status', 'step', 'ok']]);
      if (r.error && !json) log(`! ${r.error}`);
      return r.ok ? 0 : 1;
    },
  },
  {
    path: ['run', 'signal'], plane: 'data', json: true, permission: 'write', agentInvokable: false,
    usage: 'run signal <run-id> <signal-name>', summary: 'unblock a waiting run by signal name',
    io: { params: ['id', 'signal'], flags: {} },
    handler: ({ args, cwd, log, json }) => {
      const [id, signal] = args._;
      if (!id || !signal) return fail(log, 'usage: zz run signal <run-id> <signal-name>', json);
      const r = signalRun(open(cwd).home, id, signal);
      if (!r.ok) return fail(log, r.error, json);
      emit(log, json, r, ['signal', [{ run: id, step: r.step }], ['run', 'step']]);
      return 0;
    },
  },
  {
    path: ['run', 'complete'], plane: 'data', json: true, permission: 'write', agentInvokable: false,
    usage: 'run complete <run-id> <step-id>', summary: 'unblock a waiting run by step id',
    io: { params: ['id', 'step'], flags: {} },
    handler: ({ args, cwd, log, json }) => {
      const [id, step] = args._;
      if (!id || !step) return fail(log, 'usage: zz run complete <run-id> <step-id>', json);
      const r = completeStep(open(cwd).home, id, step);
      if (!r.ok) return fail(log, r.error, json);
      emit(log, json, r, ['complete', [{ run: id, step: r.step }], ['run', 'step']]);
      return 0;
    },
  },
];
