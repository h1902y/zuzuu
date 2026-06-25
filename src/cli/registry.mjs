// src/cli/registry.mjs — the `zz registry` sub-router (the project registry, distinct
// from the capability registry in serve/dispatch.mjs). A thin veneer onto api.registry;
// owns no logic. `--json` rides the global flag. Verbs: init · add · sync · status
// (OSS-active) · publish (the inert Enterprise-gated stub, U10).

import { open } from '../serve/api.mjs';
import { toon } from '../notes/toon.mjs';

export function registryCommand(args, cwd, log) {
  const json = !!args.json;
  const [sub, arg] = args._;
  const zz = open(cwd);
  const emit = (value, label, rows, cols) => log(json ? JSON.stringify(value) : toon(label, rows, cols));
  const fail = (msg) => { log(json ? JSON.stringify({ error: msg }) : `error: ${msg}`); return 1; };

  switch (sub) {
    case 'init': {
      const title = typeof args.title === 'string' ? args.title : undefined;
      const r = zz.registry.init({ title });
      emit(r, 'registry', [{ identity: r.identity }], ['identity']);
      return 0;
    }
    case 'add': {
      if (!arg) return fail('usage: zz registry add <path>');
      try {
        const r = zz.registry.add(arg);
        emit(r, 'registry', [{ handle: r.handle }], ['handle']);
        return 0;
      } catch (e) { return fail(e.message); }
    }
    case 'sync': {
      try {
        const r = zz.registry.sync();
        emit(r, 'registry', [r], ['synced', 'committed']);
        return 0;
      } catch (e) { return fail(e.message); }
    }
    case 'status': {
      const s = zz.registry.status();
      const rows = s.refs.map((r) => ({ handle: r.id, tracked: r.tracked ?? 'auto', remote: r.remote ?? '(local)' }));
      emit(
        { configured: s.configured, identity: s.identity, projects: s.projects, refs: rows },
        'registry',
        rows.length ? rows : [{ configured: s.configured, projects: s.projects }],
        rows.length ? ['handle', 'tracked', 'remote'] : ['configured', 'projects'],
      );
      return 0;
    }
    case 'publish':
      // pre-wired seam, inert in OSS (KTD-8 — the cannibalization guard). The verb +
      // resolveSubscribers shape exist so an Enterprise tier swaps scope+auth only.
      return fail('publish/fan-out is Enterprise-gated — not available in OSS');
    default:
      return fail('usage: zz registry [init | add <path> | sync | status]');
  }
}
