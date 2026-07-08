// src/cli/verbs/inspection.mjs — the `inspection` plane: integrity · health ·
// porcelain. (The `commands` catalog verb lives in ../commands.mjs, beside the
// table it renders.) Composed into THE table by ../commands.mjs.

import { open } from '../../serve/api.mjs';
import { doctor, status, explain } from '../doctor.mjs';
import { toon } from '../../notes/toon.mjs';
import { emit } from '../args.mjs';

export const inspectionRows = [
  {
    path: ['check'], plane: 'inspection', json: true, permission: 'read', agentInvokable: true,
    usage: 'check [module]', summary: 'find broken links, orphans, and stale notes',
    handler: ({ args, cwd, log, json }) => {
      const zz = open(cwd);
      const mods = args._[0] ? [args._[0]] : zz.modules().map((m) => m.id);
      const rows = [];
      for (const m of mods) {
        const r = zz.check(m);
        if (!r.ok) continue;
        const v = r.value;
        // check is project-wide; scope `ungated` to this module's notes for an accurate column.
        const ungated = (v.ungated ?? []).filter((u) => u.addr.startsWith(`${m}:`)).length;
        rows.push({ module: m, broken: v.broken.length, orphans: v.orphans.length, stale: v.stale.length, ungated });
      }
      emit(log, json, rows, ['integrity', rows, ['module', 'broken', 'orphans', 'stale', 'ungated']]);
      return 0;
    },
  },
  {
    path: ['validate'], plane: 'inspection', json: true, permission: 'read', agentInvokable: true,
    usage: 'validate [module]', summary: 'check every note against its collection schema',
    handler: ({ args, cwd, log, json }) => {
      const bad = open(cwd).validate(args._[0] || '');
      if (json) { log(JSON.stringify({ ok: !bad.length, invalid: bad })); return bad.length ? 1 : 0; }
      if (!bad.length) { log('all notes valid'); return 0; }
      log(toon('invalid', bad.map((b) => ({ addr: b.addr, errors: b.errors.join('; ') })), ['addr', 'errors']));
      return 1;
    },
  },
  {
    path: ['doctor'], plane: 'inspection', json: false, permission: 'read', agentInvokable: true,
    usage: 'doctor', summary: 'health check',
    handler: ({ cwd, log }) => doctor(cwd, log),
  },
  {
    path: ['status'], plane: 'inspection', json: false, permission: 'read', agentInvokable: true,
    usage: 'status', summary: 'inventory',
    handler: ({ cwd, log }) => status(cwd, log),
  },
  {
    path: ['explain'], plane: 'inspection', json: false, permission: 'read', agentInvokable: true,
    usage: 'explain [topic]', summary: 'explain a concept or command',
    handler: ({ args, log }) => explain(args._[0], log),
  },
];
