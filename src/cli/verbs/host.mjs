// src/cli/verbs/host.mjs — the `host` plane: launch & lifecycle — the hooks
// installer, the bundled hosts (OpenCode · the workbench), and the machine
// lifecycle callback (`hook`, the hot path `enable` installs).
// Composed into THE table by ../commands.mjs.

import { enable, disable } from '../enable.mjs';
import { code } from '../code.mjs';
import { web } from '../web.mjs';
import { runDaemon, DEFAULT_INTERVAL_MS } from '../daemon.mjs';
import { runHook } from '../../hosts/hook.mjs';
import { open } from '../../serve/api.mjs';
import { emit } from '../args.mjs';

export const hostRows = [
  {
    path: ['host', 'enable'], plane: 'host', json: true, permission: 'admin', agentInvokable: false,
    usage: 'host enable', summary: 'install the lifecycle + guardrails hooks',
    handler: ({ cwd, log, json }) => {
      const r = enable(cwd);
      emit(log, json, { ok: true, path: r.path, installed: r.installed },
        ['enable', [{ path: r.path, installed: r.installed }], ['path', 'installed']]);
      return 0;
    },
  },
  {
    path: ['host', 'disable'], plane: 'host', json: true, permission: 'admin', agentInvokable: false,
    usage: 'host disable', summary: 'remove the lifecycle + guardrails hooks',
    handler: ({ cwd, log, json }) => {
      const r = disable(cwd);
      emit(log, json, { ok: true, path: r.path, removed: r.removed },
        ['disable', [{ path: r.path, removed: r.removed }], ['path', 'removed']]);
      return 0;
    },
  },
  {
    path: ['host', 'code'], plane: 'host', json: false, permission: 'run', agentInvokable: false,
    usage: 'host code [dir]', summary: 'launch OpenCode (the bundled host)',
    handler: ({ args, log }) => code({ ...args, _: args._ }, { log }),
  },
  {
    path: ['host', 'web'], plane: 'host', json: false, permission: 'run', agentInvokable: false,
    usage: 'host web', summary: 'launch the workbench',
    handler: ({ args }) => web({ ...args, _: args._ }) ?? 0,
  },
  {
    // the dedicated wake-source tick host (U4, docs/plans/2026-07-06-001-feat-wake-
    // source-tick-plan.md, KTD1's SECOND host — `src/cli/daemon.mjs` is the in-process
    // loop over the SAME `grow/tick.mjs` core the web daemon shells `zz tick --once`
    // against). Flat, like `hook` — a distinct top-level command, not a `host`-noun
    // sub-verb. `admin` + agentInvokable:false: it's a long-lived process that fires
    // automation on its own cadence, so it lands in the exec-deny set exactly like
    // `tick`/`autonomy on|off` — an agent must never be able to shell it into existence.
    path: ['daemon'], plane: 'host', json: false, permission: 'admin', agentInvokable: false,
    usage: 'daemon [--interval <ms>]', summary: 'run the dedicated wake-source tick host — loops the tick core on a cadence until SIGINT/SIGTERM',
    handler: ({ cwd, args, log }) => {
      const intervalMs = Number(args.interval) > 0 ? Number(args.interval) : DEFAULT_INTERVAL_MS;
      return runDaemon(open(cwd).home, { intervalMs, log });
    },
  },
  {
    path: ['hook'], plane: 'host', json: false, permission: 'gate', agentInvokable: true,
    usage: 'hook <Event>', summary: 'the host lifecycle callback (internal — reads stdin, always exits 0)',
    handler: ({ args, cwd }) => {
      // the host lifecycle callback — reads stdin, always exits 0 (own process)
      runHook(args._[0], { host: args.host || 'claude-code', session: args.session, cwd });
      return 0; // unreachable (runHook exits), but keeps the router total
    },
  },
];
