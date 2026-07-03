// src/cli/verbs/host.mjs — the `host` plane: launch & lifecycle — the hooks
// installer, the bundled hosts (OpenCode · the workbench), and the machine
// lifecycle callback (`hook`, the hot path `enable` installs).
// Composed into THE table by ../commands.mjs.

import { enable, disable } from '../enable.mjs';
import { code } from '../code.mjs';
import { web } from '../web.mjs';
import { runHook } from '../../hosts/hook.mjs';
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
    path: ['hook'], plane: 'host', json: false, permission: 'gate', agentInvokable: true,
    usage: 'hook <Event>', summary: 'the host lifecycle callback (internal — reads stdin, always exits 0)',
    handler: ({ args, cwd }) => {
      // the host lifecycle callback — reads stdin, always exits 0 (own process)
      runHook(args._[0], { host: args.host || 'claude-code', session: args.session, cwd });
      return 0; // unreachable (runHook exits), but keeps the router total
    },
  },
];
