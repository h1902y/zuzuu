# Workbench — subsystem & library deep-dives

**Pass ② of the [design research](../README.md).** Where pass ① set the *visual language*, this set
answers the harder build question: **which views and which libraries** to build the workbench
surfaces the product currently lacks — specialized envelope visualization, collection + typed-link
graph views, audit-trail / JSONL views, and version/diff timelines.

Docs `01`–`04` are **research** (each the synthesis of a multi-agent workflow: specialists grounded
in **real apps via Mobbin** plus official docs / npm / bundlephobia, scored for our lean **Vite +
React + TS** workbench). Doc **`05` is the locked experience spec** — the decisions, not the
research. **Read `05` first**; the rest is its evidence base. Generated 2026-06-24/25.

| # | Doc | Covers | Headline |
| --- | --- | --- | --- |
| **05** | [**`05-experience-spec.md`**](05-experience-spec.md) | **the locked design** — two worlds (Work ⇄ Brain), the Project-as-database, schema graduation, the gate that teaches | **read first** — decision log + build mapping |
| 01 | [`01-collection-and-graph-views.md`](01-collection-and-graph-views.md) | list/feed · basic→advanced tables · D3/Obsidian-style graph · the envelope detail card | TanStack Table v8 (+Virtual) · react-virtuoso · react-force-graph-2d → sigma.js · Linear-style properties/body split |
| 02 | [`02-observability-and-audit-views.md`](02-observability-and-audit-views.md) | trace waterfalls · flame/icicle · service topology · activity feeds · JSONL log streams · version/diff timelines | TanStack Virtual + CSS bars (waterfall) · d3-hierarchy+canvas (icicle) · @xyflow/react+dagre (topology) · react-diff-viewer-continued |
| 03 | [`03-js-library-landscape.md`](03-js-library-landscape.md) | the full JS/TS library landscape per viz class, license + bundle + perf scored | MIT/ISC/BSD/Apache only; `React.lazy()` + Vite `manualChunks` keeps it off the initial bundle |
| 04 | [`04-query-layer.md`](04-query-layer.md) | filesystem/bash → DB-query equivalents (recutils · Dataview DQL · SQL-over-files · graph/GRIP) + the workbench query UX | keep `node:sqlite`; native filter-chips + saved views; GRIP isn't a real query language |
| 06 | [`06-crud-app-inspiration.md`](06-crud-app-inspiration.md) | Refine.dev + open-source CRUD-to-app / DB-as-app / headless-CMS / internal-tool projects, mapped to our build | Refine `DataProvider` over the `zz` CLI; writes resolve to a *pending proposal* (the gate); one `FieldType` registry drives grid+form |
| 07 | [`07-ui-component-foundation.md`](07-ui-component-foundation.md) | the React UI foundation — headless primitives (shadcn/Radix/React-Aria) vs batteries libs; how React-Admin/dashboards are structured | own a copy-owned shadcn/Radix kit (no batteries lib); ListContext pull-model + one `<WorkbenchShell>` per world |
| 08 | [`08-design-system.md`](08-design-system.md) | the elegant minimal design system — tokens → primitives → recipes → data-bound components — that composes the workbench with near-zero inline styling | 4 layers from one token source; `FieldType` registry is the joint; zero-inline enforced by `@theme` reset + no-`className` prop types + `tv()` slots |
| 09 | [`09-taste-redesign-direction.md`](09-taste-redesign-direction.md) | **the visual layer** — type scale, icon system, elevation, the projects surface; why the shipped shell reads premature | apply taste consistently: 5–6 sizes + weight as hierarchy; one icon set; base/raised/overlay elevation |
| 10 | [`10-experience-rethink.md`](10-experience-rethink.md) | **the IA layer** — surface consolidation (sidebar uniformity · dashboard·search·graph redundancy · onboarding handoff), grounded in Mobbin + a peer-agent sweep (Hermes/Cursor/Replit/Warp/Zed) | sidebar=nav · ⌘K=search · home="what needs me" · graph→contextual · setup recedes (2026-06-30) |
| 11 | [`11-conversation-kit-and-entities.md`](11-conversation-kit-and-entities.md) | **the conversation layer** — the component + entity model for the ACP surface (session · turn · typed parts · input), defined against Vercel Chat SDK + AI Elements and mapped onto our `acp-model` Block fold | message = typed parts (we have it); add Turn/role grouping · 4-state status enum · status-aware Stop; graduate BlockView → neon kit (2026-07-01) |

> `09` (taste) + `10` (IA) are a later **experience pass** on the *shipped* shell — orthogonal axes: `09` is how it looks, `10` is how it's structured. Read together before the next workbench rebuild.

## How to use this for the build phase

1. **Read `05` (the experience spec)** — it locks the shape (the two worlds, every surface), carries the **decision log** + the **build mapping** onto `web/src/client`, and lists the per-surface open questions.
2. **`03` + `04` for the engine choices** — the master library table + bundle/lazy-load strategy + license-trap avoid-list (`03`), and the query layer (`04`: keep `node:sqlite`, build the filter-chips/saved-views UX native).
3. **`01` + `02` per surface** — the design patterns (app names + Mobbin refs), interaction grammar + failure modes, tied to our data shapes (envelopes · the typed link graph · generations · `log.jsonl`/`runs.jsonl`).

> `01`–`04` are *research artifacts*; `05` is the *locked design*. The build phase implements per surface and records what it chose (and why) in [`../../LOG.md`](../../LOG.md).
