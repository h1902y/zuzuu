// src/cli/verbs/registry.mjs — the `registry` plane: the project registry
// (1:N tree of tracked repos) + module subscription (gated vendoring).
// Composed into THE table by ../commands.mjs.

import { open } from '../../serve/api.mjs';
import { registryCommand } from '../registry.mjs';
import { fail, emit } from '../args.mjs';

export const registryRows = [
  {
    path: ['registry'], plane: 'registry', json: true, permission: 'admin', agentInvokable: false,
    usage: 'registry [ensure [<path>…] | init | add <path> | sync | status]',
    summary: 'the projects you track',
    handler: ({ args, cwd, log }) => registryCommand(args, cwd, log),
  },
  {
    path: ['registry', 'subscribe'], plane: 'registry', json: true, permission: 'write', agentInvokable: false,
    usage: 'registry subscribe <module>', summary: 'subscribe to a shared collection (adds its notes as suggestions)',
    handler: ({ args, cwd, log, json }) => {
      const m = args._[0];
      if (!m) return fail(log, 'usage: zz registry subscribe <module>', json);
      try {
        const r = open(cwd).registry.subscribe(m);
        if (!r.ok) return fail(log, r.error, json);
        emit(log, json, r, ['subscribe', [{ module: r.module, staged: r.staged }], ['module', 'staged']]);
        return 0;
      } catch (e) { return fail(log, e.message, json); }
    },
  },
];
