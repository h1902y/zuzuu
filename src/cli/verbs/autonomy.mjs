// src/cli/verbs/autonomy.mjs — the `autonomy` namespace + `zz tick`: the founder-
// facing wake-source surface (U4, docs/plans/2026-07-06-001-feat-wake-source-tick-
// plan.md). Composed into THE table by ../commands.mjs.
//
// what: `zz autonomy on|off` — the ONE auditable opt-in flip (`grow/autonomy.mjs`'s
//       `setAutonomyEnabled`, through the operator write door — the SAME pattern `zz
//       trigger enable/disable` uses over `setTriggerEnabled`). `zz autonomy status` —
//       a read-only report: is the switch on, and what did the last tick do (reads the
//       U3 tick-decision log via `grow/tick-state.mjs`'s `readTickLog`). `zz tick
//       [--once]` — run the U3 tick core (`grow/tick.mjs`'s `tick`) once: fire due
//       enabled triggers (only if opted in) and advance their runs.
// why:  R1's opt-in needs a founder-facing switch; R6's observability needs a status
//       read; R8's shared tick core needs a CLI door so the web daemon can shell it
//       (U5) and a human/dedicated daemon (`zz daemon`, host.mjs) can call it too.
//       `on`/`off`/`tick` are WRITES that fire real automation — they land in the
//       moat's exec-deny set (permission write, agentInvokable:false) exactly like
//       `trigger enable`/`trigger fire`; `status` stays a read the agent may call
//       directly (agentInvokable:true), same as `trigger list`.
// how:  thin CLI doors over grow/autonomy.mjs + grow/tick.mjs + grow/tick-state.mjs —
//       no new logic here, only argv shaping + emission (the commands.mjs convention).
//       No new execution authority: `on|off` is exactly a note edit, `tick` is exactly
//       the U3 core a human or a host calls — this file adds no new writer.

import { open } from '../../serve/api.mjs';
import { isAutonomyEnabled, setAutonomyEnabled } from '../../grow/autonomy.mjs';
import { tick } from '../../grow/tick.mjs';
import { readTickLog } from '../../grow/tick-state.mjs';
import { fail, emit } from '../args.mjs';

// the last tick-log entry (or null — no tick has ever run) — shared by `status`.
function lastTickEntry(home) {
  const entries = readTickLog(home);
  return entries.length ? entries[entries.length - 1] : null;
}

export const autonomyRows = [
  {
    path: ['autonomy', 'on'], plane: 'evolution', json: true, permission: 'write', agentInvokable: false,
    usage: 'autonomy on', summary: "turn on background automation — let scheduled work run on its own while your machine is awake",
    handler: ({ cwd, log, json }) => {
      const r = setAutonomyEnabled(open(cwd).home, true);
      if (!r.ok) return fail(log, r.error, json);
      emit(log, json, { ok: true, autonomy_enabled: true }, ['autonomy', [{ enabled: true }], ['enabled'], ['zz autonomy status', 'zz tick']]);
      return 0;
    },
  },
  {
    path: ['autonomy', 'off'], plane: 'evolution', json: true, permission: 'write', agentInvokable: false,
    usage: 'autonomy off', summary: 'turn off background automation — nothing runs on its own (the default)',
    handler: ({ cwd, log, json }) => {
      const r = setAutonomyEnabled(open(cwd).home, false);
      if (!r.ok) return fail(log, r.error, json);
      emit(log, json, { ok: true, autonomy_enabled: false }, ['autonomy', [{ enabled: false }], ['enabled']]);
      return 0;
    },
  },
  {
    path: ['autonomy', 'status'], plane: 'evolution', json: true, permission: 'read', agentInvokable: true,
    usage: 'autonomy status', summary: 'is background automation on, and what it last did',
    handler: ({ cwd, log, json }) => {
      const home = open(cwd).home;
      const enabled = isAutonomyEnabled(home);
      const last = lastTickEntry(home);
      const row = { enabled, lastTick: last?.ts ?? '', fired: last?.fired ?? '', skipped: last?.skipped ?? '', denied: last?.denied ?? '' };
      emit(log, json, { ok: true, enabled, lastTick: last }, ['autonomy', [row], ['enabled', 'lastTick', 'fired', 'skipped', 'denied']]);
      return 0;
    },
  },
  {
    // a write (it may start durable runs) — never agent-invokable, mirroring `trigger
    // fire`/`run start`: firing is exactly the gated path those already use.
    path: ['tick'], plane: 'evolution', json: true, permission: 'write', agentInvokable: false,
    usage: 'tick [--once]', summary: 'check for scheduled work once and run anything due',
    handler: ({ cwd, log, json }) => {
      // `--once` is the only mode a single CLI invocation ever runs (the CONTINUOUS
      // loop is `zz daemon`'s job, host.mjs) — accepted for the explicit, documented
      // shape the web daemon (U5) and a human both shell, not because it changes
      // behavior here.
      const r = tick(open(cwd).home, { now: new Date() });
      const row = { fired: r.fired.length, skipped: r.skipped.length, denied: r.denied.length };
      emit(log, json, { ok: true, ...r }, ['tick', [row], ['fired', 'skipped', 'denied']]);
      return 0;
    },
  },
];
