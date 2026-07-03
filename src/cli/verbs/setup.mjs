// src/cli/verbs/setup.mjs — the `setup` plane: scaffold the Project.
// One row per command; composed into THE table by ../commands.mjs (the one-table
// invariant lives there — router/help/catalog/gate all read that single array).

import { initHome } from '../init.mjs';
import { emit } from '../args.mjs';

export const setupRows = [
  {
    path: ['init'], plane: 'setup', json: true, permission: 'admin', agentInvokable: false,
    usage: 'init [--root]', summary: 'scaffold the Project — .zuzuu/ by default, or the repo root itself (--root)',
    handler: ({ args, cwd, log, json }) => {
      const r = initHome(cwd, { atRoot: !!args.root });
      emit(log, json, { ok: true, home: r.home, created: r.created, skipped: r.skipped, reconciled: r.reconciled },
        ['init', [{ home: r.home, created: r.created.length, skipped: r.skipped.length, reconciled: r.reconciled.length }], ['home', 'created', 'skipped', 'reconciled']]);
      if (r.created.length && !json) log(`created: ${r.created.join(', ')}`);
      // the exec-gate re-arming (SHOULD-FIX 1): a write verb added since this Project was
      // last seeded now denies again — worth a human seeing it, not just a silent field patch.
      if (r.reconciled.length && !json) log(`reconciled (a write verb was added to the table since last seed — the exec gate re-armed): ${r.reconciled.join(', ')}`);
      return 0;
    },
  },
];
