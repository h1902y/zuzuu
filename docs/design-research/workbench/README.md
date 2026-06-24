# Workbench — subsystem & library deep-dives

**Pass ② of the [design research](../README.md).** Where pass ① set the *visual language*, this set
answers the harder build question: **which views and which libraries** to build the workbench
surfaces the product currently lacks — specialized envelope visualization, collection + typed-link
graph views, audit-trail / JSONL views, and version/diff timelines.

Each doc is the synthesis of a multi-agent research workflow: specialist agents grounded in **real
apps via Mobbin** plus official docs / npm / bundlephobia, scored for our lean **Vite + React + TS**
workbench (bundle size + license cleanliness are first-class constraints). Generated 2026-06-24.

| # | Doc | Covers | Headline picks |
| --- | --- | --- | --- |
| 01 | [`01-collection-and-graph-views.md`](01-collection-and-graph-views.md) | list/feed · basic→advanced tables · D3/Obsidian-style graph · the envelope detail card | TanStack Table v8 (+Virtual) · react-virtuoso · react-force-graph-2d → sigma.js · Linear-style properties/body split |
| 02 | [`02-observability-and-audit-views.md`](02-observability-and-audit-views.md) | trace waterfalls · flame/icicle · service topology · activity feeds · JSONL log streams · version/diff timelines | TanStack Virtual + CSS bars (waterfall) · d3-hierarchy+canvas (icicle) · @xyflow/react+dagre (topology) · react-diff-viewer-continued |
| 03 | [`03-js-library-landscape.md`](03-js-library-landscape.md) | the full JS/TS library landscape per viz class, license + bundle + perf scored | MIT/ISC/BSD/Apache only; `React.lazy()` + Vite `manualChunks` keeps it off the initial bundle |

## How to use this for the build phase

1. **Start with `03`** for the master library recommendation table + the bundle/lazy-load strategy and the license-trap avoid-list (Cosmograph CC-BY-NC, Handsontable, AG Grid/MUI X paid tiers, Monaco bundle weight, speedscope/perfetto non-embeddable).
2. **`01` + `02` per surface** — each carries the design patterns (with app names + Mobbin refs), the interaction grammar + failure modes, and a pointed recommendation tied to our data shapes (envelopes · the typed link graph · generations · `log.jsonl`/`runs.jsonl`).
3. **Each doc ends in Open questions** for the build phase — resolve those (e.g. is `@monaco-editor/react` already bundled? how do inline edits physically enter the human gate via `review`?) before committing to a library.

> These are *research artifacts*, not decisions. The build phase picks per surface and records the choice (and why) in [`../../LOG.md`](../../LOG.md).
