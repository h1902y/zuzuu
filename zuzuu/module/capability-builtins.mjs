// zuzuu/module/capability-builtins.mjs — the host-internal §A capability
// descriptors registered into the platform catalogue. Each descriptor's
// build({agentDir, manifest, config, schema}) returns hook FRAGMENTS that the
// resolver (capabilities.mjs) merges into a module-shaped object. These WRAP the
// existing separable libraries — no logic change to them; this file is the
// composition face that lets a module be a declaration, not code.
//
// v1 ships the acceptance set (items.collection, mine, query.structured,
// query.semantic, exec.script). Growing this catalogue is the core-engineering
// target — new blocks register here.

import { registerCapability } from './capability-registry.mjs';
import { slugify } from '../knowledge/items.mjs';
import { validateAgainstSchema } from './schema.mjs';
import { writeModuleItem, listModuleItems } from './items.mjs';
import { aggregate } from '../knowledge/distill.mjs';
import { makeProposal, writeProposal, proposalId, isArchivedResolved } from './proposal.mjs';
import { runAction } from '../actions/dispatch.mjs';

// Resolve the kind for a composed item: explicit type/kind on the payload, else
// the module's first declared kind, else 'note'.
const itemKind = (p, manifest) => p.type || p.kind || manifest.kinds?.[0] || 'note';

// ── items.collection — identity + validate + apply + render + listing ───────
// The base every data module needs: turn an approved proposal payload into a
// Module Standard envelope under <module>/items/, validate against schema.json.
registerCapability('items.collection', {
  category: 'schema',
  grant: { scope: 'self-items', audited: true },
  build: ({ manifest, schema }) => ({
    adapter: {
      ingest(_agentDir, raw) {
        const payload = { ...(raw.candidate ?? raw.payload ?? {}) };
        payload.id = payload.id || slugify(payload.body || payload.title || manifest.id);
        return { payload, analysis: {}, dedupeKey: payload.id };
      },
      validate(_agentDir, payload) {
        return validateAgainstSchema(schema, payload);
      },
      apply(agentDir, proposal) {
        const p = proposal.payload ?? {};
        const id = p.id || slugify(p.body || p.title || manifest.id);
        const item = {
          id,
          module: manifest.id,
          kind: itemKind(p, manifest),
          title: p.title || String(p.body || id).split('\n')[0].slice(0, 80) || id,
          created_at: new Date().toISOString(),
          body: p.body || '',
          payload: { ...(p.attributes ? { attributes: p.attributes } : {}), ...(p.payload || {}) },
          provenance: p.provenance || proposal.provenance || [],
        };
        writeModuleItem(agentDir, item, { itemsDir: manifest.itemsDir });
        return { ok: true, action: 'created', itemIds: [id], warnings: [] };
      },
      render(proposal) {
        const p = proposal.payload ?? {};
        const head = String(p.body || p.title || p.id || '').split('\n')[0];
        return {
          line: `${proposal.id}  [${p.type || proposal.kind}]  ${head.slice(0, 60)}`,
          card: `${p.type || proposal.kind}: ${head.slice(0, 100)}`,
        };
      },
    },
    list: (agentDir) => listModuleItems(agentDir, manifest.id, { itemsDir: manifest.itemsDir }),
  }),
});

// ── mine — trace → proposals (wraps the distill aggregate path) ─────────────
// config: { kind?, thresholds? }. Every aggregated candidate becomes a pending
// proposal for THIS module (skipping archive-resolved ids, like the knowledge
// miner). The module supplies its kind; the engine supplies the rest.
registerCapability('mine', {
  category: 'transform',
  grant: { scope: 'self-proposals', audited: true },
  build: ({ manifest, config }) => ({
    miner: {
      module: manifest.id,
      aggregate: (sessions) => aggregate(sessions, config?.thresholds ?? {}),
      propose(agentDir, aggregated) {
        let count = 0;
        for (const c of aggregated) {
          const cand = c.candidate ?? c;
          const payload = {
            id: cand.id || slugify(cand.body || ''),
            type: config?.kind || cand.type,
            body: cand.body,
            attributes: cand.attributes || {},
            provenance: cand.provenance || [],
          };
          const pid = proposalId(payload.id, 'distill');
          if (isArchivedResolved(agentDir, manifest.id, pid)) continue;
          const prop = makeProposal({ module: manifest.id, kind: 'item', source: 'distill', payload, evidence: c.evidence ?? {} });
          writeProposal(agentDir, prop);
          count++;
        }
        return count;
      },
    },
  }),
});

// ── query.structured / query.semantic — recall over the module's items ──────
// v1 substrate: lexical filter over the module's own envelopes (the relational/
// semantic rungs — sqlite index / pgvector — are the "earned" ladder, DESIGN §2).
function buildRecall({ manifest }) {
  return {
    recall(agentDir, query = '') {
      const { items } = listModuleItems(agentDir, manifest.id, { itemsDir: manifest.itemsDir });
      const q = String(query).toLowerCase().trim();
      if (!q) return items;
      return items
        .map((it) => ({ it, hay: `${it.id} ${it.title ?? ''} ${it.body ?? ''}`.toLowerCase() }))
        .filter(({ hay }) => hay.includes(q))
        .map(({ it }) => it);
    },
  };
}
registerCapability('query.structured', { category: 'query', grant: { scope: 'self-items', audited: false }, build: buildRecall });
registerCapability('query.semantic', { category: 'query', grant: { scope: 'self-items', audited: false }, build: buildRecall });

// ── exec.script — run a procedure (wraps the Actions runner) ────────────────
// v1 grant is HOME-scoped + audited (the self-authored provenance tier, decision
// 5 — the owner already has host authority via the runner's cwd=home). The grant
// scope here is honest about that: `home`, not per-dir. Per-dir confinement +
// sandbox for IMPORTED modules is the Phase-3 line — NOT enforced from this
// descriptor. Do not expose exec.script to imported/third-party modules until then.
registerCapability('exec.script', {
  category: 'execution',
  grant: { scope: 'home', audited: true, sandbox: false },
  build: () => ({
    run(agentDir, slug, input = {}) {
      return runAction(agentDir, slug, input);
    },
  }),
});
