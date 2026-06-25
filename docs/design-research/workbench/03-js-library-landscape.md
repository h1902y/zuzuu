# Workbench JS Library Landscape

*A buildable, license-clean visualization library landscape for the zuzuu workbench, scored for THIS stack.*

The zuzuu workbench is a **local Vite + React 18 + TypeScript SPA**, deliberately lean (recently cut from 18.1k to 1.7k LOC). The CLI core carries **zero runtime dependencies**; the workbench's runtime deps ride as `optionalDependencies`, so **bundle size** and **license cleanliness** (no GPL / CC-BY-NC / commercial-only traps) are first-class constraints, not afterthoughts. This document surveys the JS library landscape per visualization class against the actual data shapes the workbench must render: a collection of typed markdown **envelopes** (`type` + YAML frontmatter) forming a **typed link graph**; per-module **JSONL event logs** (`log.jsonl`, `runs.jsonl`); git-native **generation timelines + diffs**; and trace-like **nested session checkpoints**. Every recommendation is filtered through one question — *does it slot into a lean SPA without bundle weight or license debt?*

---

## Table of contents

1. [Executive summary](#executive-summary)
2. [Master recommendation table](#master-recommendation-table)
3. [Graph / network](#1-graph--network)
4. [Table / data-grid](#2-table--data-grid)
5. [Trace / flame / timeline](#3-trace--flame--timeline)
6. [Markdown / envelope rendering + editing](#4-markdown--envelope-rendering--editing)
7. [Log virtualization & JSON viewers](#5-log-virtualization--json-viewers)
8. [Chart primitives](#6-chart-primitives)
9. [Stack-fit & bundle strategy](#stack-fit--bundle-strategy)
10. [Open questions for the build phase](#open-questions-for-the-build-phase)

---

## Executive summary

The workbench can render every one of its data shapes with **MIT/ISC/BSD/Apache-2.0 libraries only** — there is no class where a license trap is forced on us. The throughline of the landscape is a **two-tier instinct**: pick a *headless / primitive* library for the surfaces unique to zuzuu (the typed link graph, generation timelines, nested checkpoints — all custom topologies no batteries library models), and a *batteries-included* library only where the shape is generic (standard tables, standard charts).

Concretely: **sigma.js + graphology** for the Obsidian-style note graph (the only library purpose-built for force-layout knowledge graphs at WebGL scale); **TanStack Table v8** for the envelope collection and **react-data-grid** for flat JSONL log grids; **flame-chart-js** for run/session traces with **@visx/hierarchy** for icicle generation views; **react-markdown v10 + gray-matter** (read) and **CodeMirror 6 + react-hook-form** (write) for envelopes; **@tanstack/react-virtual + react-json-view-lite** for log virtualization (the whole log-viewer capability for ~8 kB gz); and a **visx-primitives + Recharts-batteries** split for charts, everything lazy-loaded behind `React.lazy()` + Vite `manualChunks`.

The hard "do-not-touch" list is short and decisive: **@cosmograph/cosmos** (CC-BY-NC-4.0), **Handsontable** (non-commercial), **AG Grid Enterprise / MUI X Pro/Premium / commercial Gantt charts** (per-seat commercial), **Highcharts / amCharts** (commercial), **Monaco** (5 MB) and **MDXEditor** (851 kB gz) on bundle grounds, and **speedscope / perfetto** (not embeddable as React components). With disciplined lazy-loading, the entire visualization stack adds **zero bytes to the CLI core and nothing to the workbench's initial SPA bundle** — every chart/graph/editor chunk loads only when its pane mounts.

---

## Master recommendation table

| Viz class | Recommended | License | ~Bundle (gz) | Why (one line) |
|---|---|---|---|---|
| **Graph / network** | **sigma.js v3 + graphology + @react-sigma/core** | MIT | ~150 kB | Only lib purpose-built for force-layout knowledge graphs; WebGL to 50k+ nodes; best TS story (graphology generics) |
| ↳ *small-scale fallback* | react-force-graph-2d | MIT | ~80 kB | Zero-integration prop API; ships own d3-force; migrate to sigma when scale/interaction demands |
| **Table / data-grid** | **TanStack Table v8** (envelopes) | MIT | ~29 kB (table+virtual) | Headless = owns no markup; first-class TS generics; covers sort/filter/group/pin/inline-edit |
| ↳ *flat JSONL grids* | react-data-grid (adazzle) | MIT | ~90 kB | Built-in bi-directional virtualization + copy-paste; near drop-in for wide log rows |
| **Trace / flame** | **flame-chart-js** (run traces) | MIT | ~80 kB | JSONL run shape maps ~directly to its node shape; built-in waterfall plugin; Canvas |
| ↳ *icicle / generations* | @visx/hierarchy (partition) | MIT | ~40–60 kB | Partition layout = icicle; full SVG control; adequate at generation-count scale |
| **Markdown read** | **react-markdown v10 + gray-matter + remark-gfm** | MIT | ~60–80 kB | Pure renderer, full plugin surface; gray-matter strips frontmatter for the property panel |
| **Markdown write** | **CodeMirror 6** (yaml + markdown) | MIT | ~135–200 kB | Only editor that fits lean budget; mixed YAML/MD highlighting; tree-shakeable |
| ↳ *frontmatter editor* | react-hook-form v7 + Zod | MIT | ~17 kB | Uncontrolled = no per-keystroke re-render; `useFieldArray` for `relations`; Zod per-type schema |
| **Code highlighting** | react-syntax-highlighter (Prism, selective) | MIT | ~20–50 kB | Drop-in inside react-markdown `components`; client-safe (vs shiki WASM) |
| **Log virtualization** | **@tanstack/react-virtual v3** | MIT | ~5 kB | Headless, variable-height, `anchorTo:'end'` for live tails; lowest bundle in class |
| ↳ *per-line JSON tree* | react-json-view-lite | MIT | ~3 kB | Read-only by design (logs are immutable); zero deps; a11y in v2 |
| ↳ *ANSI stdout* | ansi_up | MIT | ~3 kB | Leanest color transform for local `act.mjs` captures |
| **Chart primitives** | **visx** (custom) + **Recharts v3** (batteries) | MIT | ~35–50 kB + ~50 kB | visx for custom topologies, Recharts for standard analytics panes; both lazy |
| ↳ *Canvas-heavy reserve* | Apache ECharts (à la carte) | Apache-2.0 | ~80–130 kB | Only if high-cardinality log replay is ever needed; lazy-gated, never in initial bundle |

---

## 1. Graph / network

The note graph is the workbench's signature surface: each `type: knowledge`/`memory`/etc. note is a node, each `relations` frontmatter entry an edge — an Obsidian-style force-layout typed link graph. The SQLite link table in `notes/index.mjs` already holds the topology; exporting it is a single pass.

| Library | License | ~Bundle (min+gz) | Perf ceiling | React/TS fit | Verdict |
|---|---|---|---|---|---|
| **sigma.js v3** + graphology | MIT | ~120 kB (sigma) + ~30 kB (graphology core) | 10k–50k nodes, WebGL; layout off-thread via worker | React via `@react-sigma/core`; graphology typed generics — best TS in class | **Top pick** |
| **d3-force** (custom React) | ISC | ~25 kB (d3-force alone) | ~2k–5k nodes smooth; SVG hits wall fast, Canvas stretches to ~10k | Ref-based, fully manual — max control, max code | Good floor if sigma is over-engineered |
| **@xyflow/react** (React Flow) | MIT | ~180 kB min+gz (estimated v12) | ~500–2k nodes; DOM/SVG; perf docs warn heavily beyond that | First-class React 18/19; excellent TS; built for node-editor UIs | **Wrong shape** — node editor, not force graph |
| **cytoscape.js** + react wrapper | MIT | ~200 kB unpacked → ~60–70 kB gz | ~300–500 nodes at 30 FPS (Canvas; maintainer confirmed 286 nodes→20 FPS); clustering helps | `react-cytoscapejs` exists; `@types/cytoscape` returns `any`, manual casting | Too heavy for pure force layout; shines for algorithm-rich analysis |
| **cosmos.gl** (`@cosmos.gl/graph`) | MIT (since OpenJS join, v3.0 Jun 2026) | ~150–200 kB gz (WebGL 2 via luma.gl) | 100k–1M nodes; GPU-only (fragment/vertex shaders) | No official React wrapper; imperative DOM-element API; async init | Extreme scale; integration tax is high |
| **@cosmograph/cosmos** | **CC-BY-NC-4.0** | ~200 kB gz | Same GPU engine as cosmos.gl | Higher-level API; commercial use blocked | **Hard skip** — NC license |
| **react-force-graph-2d** | MIT | ~240 kB raw (~80 kB gz est.) | ~3k–8k nodes Canvas/WebGL; ships d3-force-3d inside | `ForceGraph2D` component; props-driven; easy onboarding; TS types present | Good quick-start but bundles the whole suite |
| **vis-network** | Apache-2.0 OR MIT | Large (full vis-data + vis-core bundled) | "A few thousand nodes" per docs; Canvas; physics stabilisation required | No official React bindings; manual `useEffect` | Skip for fresh React projects |
| **reagraph** | Apache-2.0 | Unknown, pulls Three.js/WebGL | Mid-scale; WebGL via Three.js | React-native; ~1.1k stars | Decent but thin ecosystem |
| **ngraph.graph** | BSD-3 | ~10 kB (graph only) + renderer separately | Scales to 50k+ with PixiJS/WebGL renderer; modular | No React component; layout engine usable independently | Useful as physics layer under a custom renderer |
| **reaflow** | Apache-2.0 | ~100 kB gz (ELK layout embedded) | Hundreds of nodes; DAG/hierarchy focus | React-native; good TS | **Wrong shape** — DAG/workflow editor |

**Pick: sigma.js v3 + graphology + `@react-sigma/core`.** It is the only library purpose-built for the exact use case. WebGL throughout (nodes/edges are GPU quads, not DOM); graphology is a typed multi-graph with a full stdlib (centrality, community detection, ForceAtlas2) and the strongest type story in the class; **ForceAtlas2 runs in a web worker** so layout never blocks the main thread above ~500 nodes. v3 is stable (3.0.3, MIT); v4 is alpha — do not ship on alpha. The neighbor-highlight Obsidian interaction is a `setSetting('nodeReducer', …)` call. **Gotcha:** real assembly work — zoom-to-fit, tooltips, label collision are all explicit code (budget ~2 days); and do not drive Sigma from React re-renders, mutate the graphology instance and let Sigma observe it.

**Lightweight floor:** d3-force in a `useRef` Canvas loop (~25 kB) if graph views are secondary and bundle is the dominant constraint — but you implement every interaction by hand, and SVG breaks down past ~3k nodes. **Quick-start:** react-force-graph-2d (~80 kB gz) for zero integration code, migrate to sigma later. **Avoid:** @xyflow (node-editor, DOM-per-node jank past 500), cytoscape (286 nodes → 20 FPS unless you need its graph algorithms), **@cosmograph/cosmos (CC-BY-NC hard disqualifier)**, vis-network (no React-native binding, stale wrappers).

**Sources:** [sigma.js](https://github.com/jacomyal/sigma.js) · [sigma v4 beta](https://v4.sigmajs.org/) · [graphology ForceAtlas2 worker](https://graphology.github.io/standard-library/layout-forceatlas2.html) · [@react-sigma/core](https://sim51.github.io/react-sigma/docs/api/) · [xyflow](https://github.com/xyflow/xyflow) · [React Flow perf](https://reactflow.dev/learn/advanced-use/performance) · [cytoscape.js](https://github.com/cytoscape/cytoscape.js) · [cytoscape 286-node thread](https://github.com/cytoscape/cytoscape.js/discussions/3088) · [cosmos.gl](https://github.com/cosmosgl/graph) · [OpenJS cosmos.gl](https://openjsf.org/blog/introducing-cosmos-gl) · [@cosmograph/cosmos NC](https://www.npmjs.com/package/@cosmograph/cosmos) · [vis-network](https://github.com/visjs/vis-network) · [react-force-graph](https://github.com/vasturiano/react-force-graph) · [pkgpulse graph guide](https://www.pkgpulse.com/guides/cytoscape-vs-vis-network-vs-sigma-graph-visualization-2026) · [reagraph](https://github.com/reaviz/reagraph) · [sigma+React walkthrough](https://lyonwj.com/blog/sigma-react-graph-visualization) · [Memgraph tradeoffs](https://memgraph.com/blog/you-want-a-fast-easy-to-use-and-popular-graph-visualization-tool)

---

## 2. Table / data-grid

Two distinct surfaces: the **envelope collection** (typed, filter-by-`type`, sort, group-by-module, pin `id`/`type`, inline-edit frontmatter scalars) and the **flat JSONL log grid** (append-only, wide, time-ordered).

| Library | License | ~Bundle (gz) | Perf ceiling | React/TS fit | Verdict |
|---|---|---|---|---|---|
| **TanStack Table v8** | MIT | ~15 kB (core) + ~14 kB virtual | Unlimited rows w/ TanStack Virtual; CPU bound by your render fn | Headless — you own all markup; 1st-class TS; v9 in beta | **Primary pick** |
| **react-data-grid (adazzle)** | MIT | ~90 kB | 100k+ rows with built-in row+column virtualization | Batteries-lite; strict TS; React 19 supported; v7 still beta | **Strong second** |
| **AG Grid Community** | MIT (Community) / Commercial (Enterprise) | 300–520 kB | Enterprise-grade, millions of rows | Opinionated DOM; excellent TS; BUT pivot/grouping/clipboard REQUIRE Enterprise ($999+/dev/yr) | Avoid: license trap + bundle weight |
| **AG Grid Enterprise** | Commercial ($999+/dev/yr) | 300–520 kB | Best for Excel-like workloads | Full feature set, server-side row model, pivot | Wrong license for OSS |
| **MUI X DataGrid** | MIT (Community) / Commercial (Pro/Premium) | ~130–160 kB (community) | Good for 10k–50k rows; grouping/pivot = Premium | Material coupling; peer dep `@mui/material` (~93 kB extra) | Avoid: MUI coupling + tier trap |
| **Glide Data Grid** | MIT | ~150–200 kB + lodash/marked peers | Canvas — millions of rows at 60fps | Canvas cells; last release v6.0.3 Feb 2024 (stalled) | Avoid: maintenance risk; overkill |
| **Handsontable** | Non-commercial / Commercial | ~300 kB+ | Spreadsheet-grade with Excel API | Non-commercial license production-blocked | **Hard no: license** |
| **RevoGrid** | MIT core / Pro €200+/dev | ~50–80 kB (Web Component core) | Virtual scroll, 1M+ rows claimed | Web Component shim for React — less idiomatic; small community | Skip: WC indirection |

**Pick (envelopes): TanStack Table v8.** ~29 kB total with `@tanstack/react-virtual`. Headless contract fits zuzuu's design exactly — the SPA owns all markup, no framework to fight. Fully typed generics (`ColumnDef<Envelope, unknown>`); covers sort, filter, grouping (fold by `type`), multi-sort, selection, column visibility/order/resize, pinning, and inline edit via cell renderers. Native **pivot** is "coming soon" but not load-bearing here (the `type` field is the grouping axis). Stay on stable v8; v9 is in active beta (TS type-computation perf).

**Pick (JSONL logs): react-data-grid (adazzle).** ~90 kB with built-in row *and* column virtualization (no separate package), free copy-paste, frozen columns, keyboard nav. Narrow API (`columns`, `rows`, `onRowsChange`) makes a working grid in ~30 lines — better ergonomics than TanStack for flat wide rows. The 90 kB is acceptable as an `optionalDependency` loaded only when the log panel mounts. v7 has been beta >1 year; core is stable but watch the API.

**Avoid:** AG Grid (grouping/pivot/clipboard all Enterprise-only; 300–520 kB even modular), Handsontable (non-commercial = legally non-deployable), Glide (16+ months no release; Canvas blocks a11y + frontmatter-chip cells), MUI X (pulls `@mui/material`, Premium tiers), RevoGrid (Stencil WC breaks React reconciler ownership).

**Sources:** [TanStack Table](https://tanstack.com/table/latest) · [TanStack releases](https://github.com/TanStack/table/releases) · [@tanstack/react-table bundlephobia](https://bundlephobia.com/package/@tanstack/react-table) · [TanStack vs AG Grid](https://www.simple-table.com/blog/tanstack-table-vs-ag-grid-comparison) · [TanStack vs AG Grid vs RDG](https://www.pkgpulse.com/guides/tanstack-table-vs-ag-grid-vs-react-data-grid-2026) · [AG Grid community-vs-enterprise](https://www.ag-grid.com/react-data-grid/community-vs-enterprise/) · [AG Grid pricing](https://www.ag-grid.com/license-pricing/) · [AG Grid bundle](https://blog.ag-grid.com/minimising-bundle-size/) · [adazzle/react-data-grid](https://github.com/adazzle/react-data-grid) · [RDG deepwiki](https://deepwiki.com/adazzle/react-data-grid) · [RDG bundlephobia](https://bundlephobia.com/package/react-data-grid) · [Glide Data Grid](https://github.com/glideapps/glide-data-grid) · [Glide bundlephobia](https://bundlephobia.com/package/@glideapps/glide-data-grid) · [Handsontable license](https://handsontable.com/docs/react-data-grid/software-license/) · [Handsontable pricing](https://handsontable.com/pricing) · [MUI X licensing](https://mui.com/x/introduction/licensing/) · [MUI X bundlephobia](https://bundlephobia.com/package/@mui/x-data-grid) · [RevoGrid 2026](https://rv-grid.com/blog/best-js-datagrid-in-2026) · [RevoGrid npm](https://www.npmjs.com/package/@revolist/react-datagrid)

---

## 3. Trace / flame / timeline

Three shapes: (a) JSONL run logs (`{start, duration, name, type}`) → flame/waterfall per run; (b) module generation timeline (git-native, date-axis); (c) per-session checkpoints as a Gantt-style strip. These are custom domain data adapted to each library's contract — not pprof or CPU call stacks.

| Library | License | ~Bundle (min+gz) | Perf ceiling | React 18/19 + TS fit | Verdict |
|---|---|---|---|---|---|
| **flame-chart-js** | MIT | ~80 kB est. | Canvas; 10k–100k nodes claimed | Ships `FlameChartComponent` from `flame-chart-js/react`; full TS; waterfall plugin built-in | **Finalist** — best match for JSONL run data |
| **@visx/hierarchy** (partition) | MIT | ~15–40 kB (package; D3 peers ~50 kB) | SVG; degrades above ~2k–5k nodes | Headless primitives; excellent TS; v4.0.0 requires React 18/19 | **Finalist** — max control, lower ceiling |
| **@nivo/icicle** | MIT | ~227 kB (package) + @nivo/core | SVG default, Canvas variant; ~500–2k nodes | Batteries React; good TS; RSC-incompatible (client-only) | **Finalist** for icicle if node count small |
| **vis-timeline** | MIT / Apache-2.0 | ~500 kB min est. | DOM; degrades sharply past 150–300 visible items | No native React component; wrappers stale; DOM-heavy | **Avoid** for run-log; only coarse date-axis |
| **react-flame-graph** (bvaughn) | MIT | ~50 kB est. | SVG; React DevTools profiler shape (fixed) | Last release 6 yrs ago; no maintenance | **Avoid** — abandoned, locked data shape |
| **speedscope** | MIT | Standalone app (~4 MB) | Canvas; large CPU profiles | Preact, not React; no embed API (issue #16 open since 2018) | **Avoid** — not embeddable |
| **perfetto UI** | Apache-2.0 | Standalone app; Mithril | WebGL; GB-scale traces | No React API; iframe only | **Avoid** — wrong form factor |
| **react-pprof** | Apache-2.0 | Unknown (WebGL) | WebGL; 100k+ frames | 38 stars; pprof binary format only | **Avoid** — pprof-locked |
| **d3-flame-graph** | Apache-2.0 | ~30 kB (plugin; D3 peers) | SVG/Canvas; flexible | Pure D3; no React component | **Possible** if custom rendering needed |
| **Apache ECharts** (custom series) | Apache-2.0 | 100–300 kB gz treeshaken; 520 kB+ full | Canvas + WebGL; 50k+ points | `echarts-for-react`; good TS; heavy for one chart | **Avoid** — overkill |
| **react-gantt** (various) | MIT (SVAR) / Commercial (Bryntum/DHTMLX) | Unknown–large | DOM-based | Commercial options $699–$940/dev are traps | **Avoid commercial**; MIT SVAR viable for date strip only |

**Pick (run traces): flame-chart-js.** Its node shape (`{name, start, duration, type?, children?}`) maps to `log.jsonl` (`{ts, duration, verb, note_id}`) with a ~10-line transform. Built-in **waterfall plugin** (`items + intervals`) serves the span-waterfall of sequential actions; marks support checkpoint annotations; Canvas keeps DOM flat regardless of span count. First-party typed React export (`flame-chart-js/react`). **Gotcha:** last npm release Dec 2023 (v3.3.0) — low-activity maintenance, but the Canvas API it wraps is stable; plan to fork if bugs surface.

**Pick (icicle / generations): @visx/hierarchy (partition layout).** The partition layout *is* an icicle/flame chart; D3-hierarchy data contract; fully composable SVG (rect+text, not a black box). SVG ceiling (~2k–5k nodes) is irrelevant at generation-count scale (single-digit to dozens). Cost is assembly time (you write rendering + zoom + tooltip + color scale) — correct tradeoff for a lean workbench already near D3. v4.0.0 explicitly requires React 18/19, no breaking changes.

**Date-axis generation strip:** plain `@visx/xychart` with a time axis or a hand-rolled SVG strip suffices (always <50 generations). **@nivo/icicle** is justified only if nivo is already in the bundle for other charts (amortizes `@nivo/core` ~285 kB). **Avoid:** vis-timeline (DOM, ~3s to add 1k items, stale wrappers), speedscope/perfetto (not React-embeddable), react-flame-graph (abandoned + fixed shape), react-pprof (pprof-only), commercial Gantts.

**Sources:** [react-flame-graph](https://github.com/bvaughn/react-flame-graph) · [flame-chart-js](https://github.com/pyatyispyatil/flame-chart-js) · [flame-chart-js npm](https://www.npmjs.com/package/flame-chart-js) · [visx](https://github.com/airbnb/visx) · [@visx/hierarchy npm](https://www.npmjs.com/package/@visx/hierarchy) · [nivo](https://github.com/plouc/nivo) · [@nivo/icicle](https://libraries.io/npm/@nivo/icicle/0.97.0) · [nivo FAQ](https://nivo.rocks/faq) · [vis-timeline](https://github.com/visjs/vis-timeline) · [vis perf issue](https://github.com/almende/vis/issues/3522) · [speedscope](https://github.com/jlfwong/speedscope) · [speedscope embed #16](https://github.com/jlfwong/speedscope/issues/16) · [Perfetto UI](https://perfetto.dev/docs/visualization/perfetto-ui) · [react-pprof](https://github.com/platformatic/react-pprof) · [Platformatic flamegraphs](https://blog.platformatic.dev/introducing-next-gen-flamegraphs-for-nodejs) · [d3-flame-graph](https://github.com/spiermar/d3-flame-graph) · [SVAR Gantt survey](https://svar.dev/blog/top-react-gantt-charts/) · [ECharts bundle](https://dev.to/manufac/using-apache-echarts-with-react-and-typescript-optimizing-bundle-size-29l8) · [LogRocket charts 2026](https://blog.logrocket.com/best-react-chart-libraries-2026/)

---

## 4. Markdown / envelope rendering + editing

The envelope = `.md` with YAML frontmatter (`type`, `id`, relations, custom keys) + free-form body. Two paths: **read** (render the body) and **write** (edit body + frontmatter property bag).

| Library | License | ~bundle (gz) | Perf ceiling | React 18 / TS fit | Verdict |
|---|---|---|---|---|---|
| **react-markdown v10** | MIT | ~32–60 kB (core; +plugins) | Unlimited DOM nodes — renderer, not a list | Excellent — pure component, full types, Vite + RSC | **Recommended renderer** |
| **remark-frontmatter** | MIT | ~2–4 kB (plugin) | N/A — parse-time | Unified ecosystem; pairs with react-markdown | Companion |
| **gray-matter** | MIT | ~10 kB | N/A — parse-time | Zero React coupling; Gatsby/VitePress/Astro | **Recommended frontmatter parser** |
| **js-yaml v4** | MIT | ~14–20 kB gz | N/A | v4 dropped esprima; pure TS types | Good; gray-matter re-exports it |
| **yaml (eemeli)** | ISC | ~27 kB gz (full) / ~9 kB (parseCST) | N/A | Full YAML 1.2, round-trip-preserving | ISC permissive; use if spec-fidelity matters |
| **@markdoc/markdoc** | MIT | ~30–40 kB gz (core) | Excellent — static tree | Good React renderer; logic/content separation | Overkill; for user-editable doc sites |
| **MDX (@mdx-js/react)** | MIT | ~50–80 kB (runtime) | Good <50 components/page | Fine w/ Vite; needs Babel/esbuild transform | Overkill — envelopes are data, not JSX |
| **MDXEditor** | MIT | **851 kB gz** | Moderate (Lexical) | Works but needs careful tree-shaking | **Hard no** — >50× the workbench total |
| **Milkdown v7.21** | MIT | ~150–300 kB gz (core+presets) | Good single-instance | First-class React wrapper; ProseMirror | Consider for write path ONLY if WYSIWYG required |
| **CodeMirror 6** | MIT | ~93 kB gz basic; ~135–200 kB w/ md+yaml | Exceptional — 100k-line files | Headless; `@uiw/react-codemirror` wrapper | **Recommended editor** |
| **Monaco Editor** | MIT | ~2.4–5 MB gz | Excellent (100k+ lines) | Needs workers + `ssr:false`; CSS via JS | Too heavy; 5–10× CodeMirror for no benefit |
| **shiki** | MIT | 0 kB client (SSR/build) | N/A client; SSR fast | Not CSR — WASM + async (~695 kB gz) | Build-time only; wrong shape for live SPA |
| **react-syntax-highlighter** (Prism) | MIT | ~20–50 kB gz (selective) | ~5ms/block; fine <50 blocks | Drop-in; works with react-markdown | **Recommended code highlighter** |
| **highlight.js** | BSD-3 | ~30 kB gz core + langs | ~14ms/block | Auto-detect noisy; manual lang required | Fine alternative, no React wrapper edge |
| **react-hook-form v7** | MIT | ~8 kB gz | ~6× smaller than Formik; no per-keystroke re-render | Excellent TS inference; Zod resolvers; uncontrolled-first | **Recommended property editor** |

**Read path: gray-matter + react-markdown v10 + remark-gfm + react-syntax-highlighter (Prism, selective).** gray-matter strips the `---` block before react-markdown sees it (frontmatter renders separately as a property panel). react-markdown is a pure renderer — React's reconciler only patches what changes; the `components`/`remarkPlugins`/`rehypePlugins` surface covers relation links (`[[id]]` / `module:id` via a bespoke remark plugin → `<NoteLink>`), code fences, safe HTML. Read-path cost ~60–80 kB gz. (v9+ is pure ESM — Vite handles it natively.) **Markdoc** would work but adds a compile step + custom vocabulary for no payoff on machine-written CommonMark; **MDX** is for human-authored JSX, wrong fit.

**Write path: two CodeMirror 6 instances** — one `@codemirror/lang-yaml` for frontmatter, one `@codemirror/lang-markdown` for the body, with a visual divider. (`yamlFrontmatter()` gives mixed-mode highlighting in one view but **breaks markdown folding** — the two-instance split is the workaround.) Modular/tree-shakeable; `@uiw/react-codemirror` (~10 kB, 9.5k stars) is the React standard and works under concurrent mode. Sourcegraph's Monaco→CodeMirror migration cut 43% of their JS bundle. Write-path cost ~135–200 kB gz. **Milkdown** is the fallback *only* if the UX hardens to WYSIWYG; **Monaco** is ruled out (5 MB, SSR-hostile, CSS-via-JS).

**Frontmatter property editor: react-hook-form v7 + Zod (~17 kB total).** Frontmatter is a dynamic typed object — `useFieldArray` handles the `relations` array natively, uncontrolled model = zero per-keystroke re-render, a `z.object()` per envelope `type` derives field types. On save, serialize back via `js-yaml dump()` + reconstruct the `---` fence.

**Avoid:** MDXEditor (851 kB), react-simplemde/markdown-editor-lite (unmaintained), Monaco, shiki on the client (WASM ~695 kB — build-time/SSR only). **gray-matter caveat:** v4.0.3 is ~5 yrs old and pins js-yaml v3 — if YAML 1.2 / a maintained chain matters, use the `yaml` (eemeli, ISC) package with a thin frontmatter splitter instead.

Full envelope read+write stack ≈ **~220–280 kB gz** — fine for `optionalDependencies`, zero CLI-core impact.

**Sources:** [react-markdown](https://github.com/remarkjs/react-markdown) · [remark-frontmatter](https://github.com/remarkjs/remark-frontmatter) · [gray-matter](https://www.npmjs.com/package/gray-matter) · [Milkdown](https://github.com/Milkdown/milkdown) · [Milkdown Crepe #1533](https://github.com/Milkdown/milkdown/issues/1533) · [MDXEditor](https://www.npmjs.com/package/@mdxeditor/editor) · [Strapi markdown editors](https://strapi.io/blog/top-5-markdown-editors-for-react) · [Monaco vs CodeMirror 2026](https://www.pkgpulse.com/guides/monaco-editor-vs-codemirror-6-vs-sandpack-in-browser-2026) · [Sourcegraph migration](https://sourcegraph.com/blog/migrating-monaco-codemirror) · [Shiki vs Prism vs hljs](https://www.pkgpulse.com/guides/shiki-vs-prismjs-vs-highlightjs-syntax-highlighting-2026) · [react-hook-form](https://react-hook-form.com/) · [CM yamlFrontmatter folding bug](https://discuss.codemirror.net/t/yamlfrontmatter-breaks-markdown-folding/9363) · [Markdoc FAQ](https://markdoc.dev/docs/faq) · [Milkdown comparison](https://blog.logrocket.com/comparing-milkdown-other-wysiwyg-editors/)

---

## 5. Log virtualization & JSON viewers

Two composable concerns: **virtualized list rendering** for large JSONL logs (tens of thousands of lines), and **per-line JSON expansion** for structured envelope payloads inside each row.

| Library | License | ~Bundle (min+gz) | Perf ceiling | React 18 / TS fit | Verdict |
|---|---|---|---|---|---|
| **@tanstack/react-virtual** v3 | MIT | ~5 KB gzip | 500k+ rows (headless) | React 18/19 concurrent-safe; TS-first; hooks-only | **Primary pick** — virtualization |
| **react-virtuoso** v4 | MIT | ~17 KB gzip (tree-shaking partly broken) | 100k rows @ 60 fps; auto-measures variable height | MIT; `.d.ts`; batteries-included | **Good batteries alternative** |
| **react-window** v1 | MIT | ~6 KB gzip | Fixed-height rows only | `@types/react-window`; maintenance mode since 2019 | Avoid for new work |
| **react-json-view** (mac-s-g) | MIT | ~13 KB gzip | Moderate depth; no virtualization | Abandoned; 156 open issues | **Do not use** |
| **@microlink/react-json-view** | MIT | ~13 KB gzip | Moderate depth; no virtualization | Active fork; React 18 compatible | Acceptable but heavy for read-only |
| **react-json-tree** | MIT | ~8 KB gzip | Read-only; Redux DevTools heritage | redux-devtools monorepo; v0.20.0 low churn | Solid read-only, minimal |
| **react-json-view-lite** | MIT | ~3 KB gzip | Read-only; React 18+ only | TS built-in; zero deps; a11y-first (v2) | **Best fit for read-only inline JSON** |
| **ansi-to-react** | BSD-3 | ~4 KB gzip | Inline transform | v6.2.6 Jan 2026; nteract org | Useful for ANSI stdout, remote-safe |
| **ansi_up** | MIT | ~3 KB gzip | Pure transform fn; zero deps | Isomorphic; not React-specific; v6.0.6 | Leaner for local color escapes |

**Pick: @tanstack/react-virtual v3 + react-json-view-lite.** TanStack Virtual is headless (`useVirtualizer` → `getVirtualItems()` / `getTotalSize()`); you render markup yourself, which is exactly what's needed to embed the per-line tree inline and handle variable row heights (collapsed vs expanded). It supports `measureElement` for dynamic heights and `anchorTo: 'end'` for streaming `runs.jsonl` tails. react-json-view-lite (read-only by design — correct, logs are immutable telemetry; zero deps; a11y in v2) mounts inside each expanded virtual row; the virtualizer already unmounts off-screen rows. **Total log-viewer capability ≈ ~8 KB gz.** Add **ansi_up** (~3 KB) for ANSI-colored `act.mjs` stdout in collapsed-row summaries (local-only, so `dangerouslySetInnerHTML` is acceptable; switch to **ansi-to-react** if remote log sources appear).

**Fallback:** react-virtuoso (batteries, sticky headers, `VirtuosoMessageList` for streaming) — pragmatic if headless group-headers prove hard, but ~12 KB heavier and has a tree-shaking defect (GH #558). **Avoid:** react-window (fixed-height only), mac-s-g/react-json-view (abandoned), xterm.js for line colorization (800 KB+, it's a full terminal — reserved for the `node-pty` pane), react-virtualized (120 KB, unmaintained).

**Sources:** [@tanstack/react-virtual npm](https://www.npmjs.com/package/@tanstack/react-virtual) · [TanStack Virtual](https://github.com/TanStack/virtual) · [TanStack Virtual docs](https://tanstack.com/virtual/latest) · [pkgpulse virtual 2026](https://www.pkgpulse.com/guides/tanstack-virtual-vs-react-window-vs-react-virtuoso-2026) · [react-virtuoso](https://github.com/petyosi/react-virtuoso) · [virtuoso #558](https://github.com/petyosi/react-virtuoso/issues/558) · [react-json-view-lite](https://github.com/AnyRoad/react-json-view-lite) · [rjvl bundlephobia](https://bundlephobia.com/package/react-json-view-lite) · [mac-s-g abandonment](https://github.com/mac-s-g/react-json-view) · [@microlink/react-json-view](https://github.com/microlinkhq/react-json-view) · [react-json-tree](https://github.com/reduxjs/redux-devtools/tree/main/packages/react-json-tree) · [ansi-to-react](https://github.com/nteract/ansi-to-react) · [ansi_up](https://github.com/drudru/ansi_up) · [JSON viewer roundup](https://reactscript.com/best-json-viewer/)

---

## 6. Chart primitives

Standard analytics (run-duration timelines, module-health bars, log histograms) plus the custom topologies that overlap the graph/trace classes.

| Library | License | ~Bundle (gzip) | Perf ceiling | React 18/19 + TS fit | Verdict |
|---|---|---|---|---|---|
| **visx** (Airbnb) | MIT | 5–30 kB per sub-pkg; ~200 kB monobundle | SVG; 5k–10k pts before drops; compose Canvas yourself | React 18/19 (v4); TS-first, best type propagation | **Finalist — primitives tier** |
| **Recharts v3** | MIT | ~50 kB gzip (~150 kB min) | SVG; jank at 1k+; hard ceiling ~5k pts | Strong; declarative JSX; advanced callbacks need casts | **Finalist — batteries tier** |
| **@nivo** | MIT | 30–80 kB per chart pkg | SVG default; Canvas variants; 10k+ w/ Canvas | Native React; per-package types; React 19 in v0.98.0 | **Strong candidate; niche specializations** |
| **Observable Plot** | ISC | ~280 kB min, ~75 kB gz (no tree-shake) | SVG; exploratory, not high-frequency | No official React bindings; useRef wrapper | Skip for this workbench |
| **Apache ECharts** | Apache-2.0 | ~80–130 kB à la carte; ~340 kB full | Canvas + WebGL; 100k+ pts | Config-object API; echarts-for-react; good TS | **Reserve for Canvas-heavy panes** |
| **Unovis** | Apache-2.0 | Modular tree-shakeable | SVG + Canvas; network/Sankey first-class | `@unovis/react`; F5-backed; 2.8k stars | Interesting for graph viz; immature |
| **Lightweight Charts** (TradingView) | Apache-2.0 | ~12 kB gzip | Canvas; real-time tick updates | No official React wrapper; community ones (MIT); TS-native | **Best-in-class for time-series only** |

**Pick: visx (custom topology) + Recharts v3 (standard panes).** visx v4 gives D3 scale/shape/axis/tooltip primitives without pulling D3 itself and without ceding the React render tree — it preserves datum types (`Node`/`Edge`) end-to-end, exactly what the typed link graph and generation timelines need. Keep visx at the *low-level primitive* tier (Airbnb confirmed "reduced capacity" maintenance; higher-level `@visx/xychart` has historically lagged). Recharts is the most React-idiomatic batteries layer for line/bar/area/pie under ~5k rows, underpins shadcn/ui charts (near-free token integration), and covers run-duration timelines, module-health bars, and log histograms. **ECharts** is the Canvas reserve — `React.lazy()`-gated, only if high-cardinality log replay ever materializes.

**Avoid:** Observable Plot (no React bindings, no tree-shaking, slowed dev), Unovis (promising but 2.8k stars / 3-person core — watch, don't bet), Lightweight Charts as primary (12 kB but time-series only — pull lazily if an OHLC-style generation chart appears), **Highcharts / amCharts / AG Charts Enterprise (commercial traps — never even for a prototype)**.

**Sources:** [LogRocket charts 2026](https://blog.logrocket.com/best-react-chart-libraries-2026/) · [Recharts/ECharts/Nivo/Lightweight](https://chenguangliang.com/en/posts/blog152_react-chart-libraries-comparison/) · [Recharts/Chart.js/Nivo/Visx](https://www.pkgpulse.com/guides/recharts-vs-chartjs-vs-nivo-vs-visx-react-charting-2026) · [Recharts v3/Tremor/Nivo](https://www.pkgpulse.com/guides/recharts-v3-vs-tremor-vs-nivo-react-charting-2026) · [visx](https://github.com/airbnb/visx) · [visx future #1908](https://github.com/airbnb/visx/discussions/1908) · [nivo](https://github.com/plouc/nivo) · [nivo releases](https://github.com/plouc/nivo/releases) · [lightweight-charts](https://github.com/tradingview/lightweight-charts) · [observable/plot](https://github.com/observablehq/plot) · [unovis](https://github.com/f5/unovis) · [ECharts bundle](https://dev.to/manufac/using-apache-echarts-with-react-and-typescript-optimizing-bundle-size-29l8) · [Vite lazy + manualChunks](https://www.mykolaaleksandrov.dev/posts/2025/10/react-lazy-suspense-vite-manualchunks/) · [Taming chunks](https://www.mykolaaleksandrov.dev/posts/2025/11/taming-large-chunks-vite-react/) · [Nivo vs Recharts](https://www.speakeasy.com/blog/nivo-vs-recharts)

---

## Stack-fit & bundle strategy

**Principle — two tiers per class.** For zuzuu's *custom topologies* (link graph, generation timelines, nested checkpoints) use *headless/primitive* libraries (sigma/graphology, TanStack Table/Virtual, visx, CodeMirror, react-markdown) — they cost author time but produce exactly the component shapes the workbench needs without fighting a library's opinion. For *generic* shapes (flat grids, standard charts, run waterfalls) use *batteries* libraries (react-data-grid, Recharts, flame-chart-js).

**What to lazy-load (everything heavy, gated by pane).** Nothing chart/graph/editor-shaped belongs in the initial SPA bundle. Use `React.lazy()` per pane + Vite `manualChunks` so each vendor chunk is separately cache-busted (a Recharts patch never invalidates the visx chunk). Route-level splits routinely cut the main bundle ~95%.

```ts
// vite.config.ts
build: { rollupOptions: { output: { manualChunks(id) {
  if (id.includes('sigma') || id.includes('graphology')) return 'vendor-graph';
  if (id.includes('@visx'))                               return 'vendor-visx';
  if (id.includes('recharts'))                            return 'vendor-recharts';
  if (id.includes('echarts'))                             return 'vendor-echarts';
  if (id.includes('codemirror'))                          return 'vendor-editor';
  if (id.includes('flame-chart-js'))                      return 'vendor-flame';
  if (id.includes('react-data-grid'))                     return 'vendor-grid';
}}}}
```
```tsx
const GraphPane     = React.lazy(() => import('./panes/GraphPane'));      // sigma + graphology
const CollectionPn  = React.lazy(() => import('./panes/CollectionPane')); // TanStack Table
const LogPane       = React.lazy(() => import('./panes/LogPane'));        // react-virtual + rjvl (+ react-data-grid)
const TracePane     = React.lazy(() => import('./panes/TracePane'));      // flame-chart-js / visx
const EditorPane    = React.lazy(() => import('./panes/EditorPane'));     // CodeMirror + RHF
const AnalyticsPane = React.lazy(() => import('./panes/AnalyticsPane'));  // Recharts
// each wrapped in <Suspense fallback={<PaneSkeleton />}>
```

**License traps to avoid (hard list).** @cosmograph/cosmos (CC-BY-NC-4.0) · Handsontable (non-commercial) · AG Grid Enterprise + MUI X Pro/Premium (per-seat commercial; their grouping/pivot/clipboard features are *only* in the paid tier) · commercial Gantts (Bryntum/DHTMLX/DevExtreme/Syncfusion, $699–$940/dev) · Highcharts / amCharts (commercial). Everything recommended above is MIT, ISC, BSD-3, or Apache-2.0 — all GPL-clean and SaaS-safe.

**Maintenance-risk flags (use, but watch / be ready to fork).** flame-chart-js (last release Dec 2023) · react-data-grid v7 + TanStack Table v9 (long-running betas) · visx (Airbnb "reduced capacity") · gray-matter v4 (5 yrs old, pins js-yaml v3 — swap to `yaml` if YAML 1.2 needed) · Glide Data Grid (stalled — already excluded).

**Total footprint (gz, all lazy, none in the initial bundle).** Graph ~150 kB · envelope grid ~29 kB · log grid ~90 kB · trace ~80 kB + icicle ~50 kB · markdown read ~60–80 kB · markdown write ~150–200 kB · log viewer ~8 kB · charts ~85–100 kB. **CLI core impact: zero** (all `optionalDependencies`). **Initial SPA bundle impact: ~zero** — each chunk loads only when its pane mounts. The "1.7k-LOC lean" mandate is about authored code and the *initial* payload, both preserved.

---

## Open questions for the build phase

1. **Graph scale ceiling.** What is the realistic max note count per project? If it stays in the low thousands, the d3-force floor (~25 kB) or react-force-graph-2d (~80 kB) may be enough and sigma's ~2-day assembly is premature. Decide the scale threshold that triggers the sigma migration.
2. **One grid or two?** Can TanStack Table serve *both* the envelope collection and JSONL logs (saving the ~90 kB react-data-grid), or does the log grid's flat-wide ergonomics justify the second dependency? Prototype the log grid in TanStack first.
3. **Editor UX target — raw markdown vs WYSIWYG.** CodeMirror (raw, lean) is the default; if user testing demands WYSIWYG, Milkdown (~150–300 kB) is the fallback. Resolve before committing the write path.
4. **CodeMirror folding workaround.** Confirm the two-instance split (separate YAML + Markdown editors) is acceptable UX vs single mixed-mode with folding disabled.
5. **Shared `@nivo/core` amortization.** If module-health charts end up on nivo, the icicle component becomes "free" — otherwise keep generations on @visx/hierarchy. Decide the charting library *before* the trace/icicle pane is built to avoid pulling both visx and nivo.
6. **Trace data contract.** Pin the exact `runs.jsonl` span schema (`ts`/`start`, `duration`, `verb`, nesting) so the flame-chart-js transform and any checkpoint-nesting model are written once.
7. **ANSI source trust.** Will logs ever include remote/SaaS sources? If yes, default to `ansi-to-react` (BSD-3, no `dangerouslySetInnerHTML`) from the start rather than `ansi_up`.
8. **flame-chart-js maintenance.** Given the Dec-2023 last release, decide up front whether to vendor/fork it or keep a `@visx/hierarchy`-based custom waterfall as the escape hatch.
9. **v8→v9 / beta timing.** Track TanStack Table v9 and react-data-grid v7 GA; both are betas today — define the upgrade trigger and stay on stable until then.
