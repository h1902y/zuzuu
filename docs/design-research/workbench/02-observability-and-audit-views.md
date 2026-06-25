# 02 — Observability & Audit Views (design + library research)

**Framing.** The zuzuu workbench needs to render three concrete on-disk data shapes that today have no visualization at all: (1) **per-module JSONL event logs** — `log.jsonl` (mutations: create/update/delete/evolve) and `runs.jsonl` (each runnable-note execution: inputs, `exitCode`, `success`, `stdout`/`stderr`, `ts`) — append-only structured event streams; (2) **git-native generations** — each module's version history is real git commits carrying a `zz-gen` trailer, giving a per-module (and cross-module) evolution **timeline** with rollback (restore-to-gen, recorded forward) and gen↔gen diffs; and (3) **session checkpoints** — per-turn git commits on a `zz/session-*` branch, squash-merged on end, which form a trace-like nested record of a work session. This document synthesizes six research passes (trace waterfalls, flame/icicle charts, service/dependency topology, audit trails & activity feeds, structured JSONL log-stream viewers, version/diff timelines) into one set of patterns, library tradeoffs, and recommendations tuned for our **lean local-only Vite + React + TypeScript** SPA, where bundle and license discipline matter but there is no network-latency constraint.

---

## Table of contents

1. [Executive summary](#executive-summary)
2. [How zuzuu's data maps to each view](#how-zuzuus-data-maps-to-each-view)
3. [Trace waterfalls (span timelines)](#trace-waterfalls-span-timelines)
4. [Flame & icicle charts](#flame--icicle-charts)
5. [Service / dependency topology](#service--dependency-topology)
6. [Audit trails & activity feeds](#audit-trails--activity-feeds)
7. [Structured (JSONL) log-stream viewers](#structured-jsonl-log-stream-viewers)
8. [Version history & diff timelines](#version-history--diff-timelines)
9. [Cross-cutting visual grammar](#cross-cutting-visual-grammar)
10. [Consolidated recommendations table](#consolidated-recommendations-table)
11. [Open questions for the build phase](#open-questions-for-the-build-phase)
12. [Sources](#sources)

---

## Executive summary

1. **The three-level information architecture is universal** across every serious observability tool: **list → trace → span** (Sentry, Datadog, Adaline, Braintrust). zuzuu should follow it — a list of sessions/runs, a trace/waterfall per item, a detail drawer per span.
2. **Build the waterfall yourself** with `@tanstack/react-virtual` + CSS/SVG positioned bars. Our session checkpoints are shallow (5–200 turns); we never hit the DOM-count limits that justify canvas/WebGL, and no off-the-shelf trace library matches our data model. ~200–400 lines of app code, near-zero bundle.
3. **The right-side detail drawer beat inline expansion** in every mature tool — it keeps the tree stable while you inspect. Use it for span detail, audit-row detail, and generation detail alike.
4. **Color encodes kind/status, not duration** — width already encodes duration. Restrict to ≤6 semantic colors with a legend; pair every health color with a badge icon for color-blind safety; never fill whole rows (kills density), use a 2–3px left-border accent.
5. **For topology, use `@xyflow/react` (React Flow) + `dagre`** — MIT, React-native HTML-DOM nodes (so health badges/metadata are plain React), deterministic hierarchical layout matching our "depends-on" semantics. Add `react-force-graph-2d` lazily, behind a "Map" tab, only for the note-level knowledge graph.
6. **The "three-tab" pattern — Graph | Timeline | List** (seen on Databricks job runs) is the mature way to expose the same events three ways. Adopt it for module/note detail.
7. **For diffs, use `react-diff-viewer-continued`** (raw `old`/`new` string API, no diff-parse pipeline — perfect for markdown+frontmatter notes), lazy-loaded behind `Suspense`. If the workbench already embeds Monaco for the editor, use its `DiffEditor` for free instead.
8. **Use `react-virtuoso` for the live `runs.jsonl` stream** (its `followOutput` prop *is* "jump to live tail"); use `@tanstack/react-virtual` for fixed-height tables (`log.jsonl`, generations). Render expandable JSON with `react-json-view-lite` (~2KB gz, MIT).
9. **Timestamps in log streams are always absolute ISO-8601 with ms, monospace, fixed-width** — relative time ("3m ago") is fine for activity feeds but wrong for debugging streams. Group long feeds by date header; collapse session bursts.
10. **Defer real-time push (SSE/WebSocket).** The daemon already writes JSONL to disk; a 2–3s `fs.watch`/poll is enough for a local workbench until cloud session waves (E–H) ship. Build no DAG/commit-graph renderer yet — generation lineage is linear per module; a vertical commit-log list suffices.

---

## How zuzuu's data maps to each view

| zuzuu artifact | On disk | Best view | Why |
|---|---|---|---|
| Session + per-turn checkpoints | git commits on `zz/session-*` branch, squash-merged | **Trace waterfall** (root=session, child=turn, leaf=tool-call/note-run) or nested accordion | Structurally a trace; shallow depth |
| `runs.jsonl` (note executions) | append-only JSONL | **Live log stream** (virtuoso `followOutput`) + Stripe-style timeline atoms | Streaming, variable-height, stdout/stderr payload |
| `log.jsonl` (mutations) | append-only JSONL | **Audit table / activity feed** (Linear/PlanetScale style) + in-row diff on expand | Write-once, bounded, field-level deltas |
| Per-module generations | git commits w/ `zz-gen` trailer | **Version-history list + diff panel + rollback modal** | Linear chain; restore-to-gen recorded forward |
| Module + note relations | frontmatter `relations` / `[[wikilinks]]` | **Topology graph** (React Flow / force graph) with health overlay | Typed DAG (modules) + organic graph (notes) |
| Generation lineage (per module) | git commit chain | Vertical commit-log list (defer DAG renderer) | Currently linear, not branching |

---

## Trace waterfalls (span timelines)

### What it maps to
The session-checkpoint architecture *is* a trace: a root span (the session), child spans (each turn), and leaf spans (tool calls / note runs from `runs.jsonl`), with `log.jsonl` mutations as event-level annotations. The generations timeline is a separate **version** axis (not duration) but shares the grammar: horizontal time axis, nested rows, detail drawer.

### Patterns observed
- **Sentry** — the strongest reference for a lean local waterfall. Two-column split: left ~55% span tree (indented name + duration), right ~45% persistent attribute drawer; shared top-right time axis; root span as a colored total-duration stripe; child-count badges (`47→`) for collapsed subtrees. The 2025 "New Trace View" GA added time-axis zoom, in-place trace search, web-vital axis markers, and a tabbed drawer (Span Info / Infra / Logs / Profiles / Links). Also: an **embedded miniature waterfall** inside issue cards (capped ~12 rows + "47 hidden spans"), and a **trace list with mini bars** (list-before-detail layer).
  - Full waterfall + drawer: https://mobbin.com/screens/f39fcbfd-d377-4bc0-beb1-92bee2598a28
  - Embedded preview in issue: https://mobbin.com/screens/16987d18-5642-44bf-a645-4b326df775a6
  - Trace list with mini bars: https://mobbin.com/screens/1b498cad-dea8-4905-bcf2-fca54f282248
  - Changelog: https://sentry.io/changelog/the-new-trace-view-is-generally-available/
- **Datadog APM** — four renderings from one toggle (Flame Graph default, Waterfall, Span List, Map); critical-path highlight darkens off-path spans; for traces >100MB it shows only "critical spans" (service entries, errors, long ops) — a graceful-degradation pattern worth copying for long sessions. https://docs.datadoghq.com/tracing/trace_explorer/trace_view/
- **StackAI** — run detail = waterfall over an AI pipeline (Files/Text/OpenAI/Output rows, status icon + duration bar on shared axis; selected row → right panel with I/O JSON tree, model, cost). Closest analog to `runs.jsonl`. https://mobbin.com/screens/5ef8b027-f8ea-4a46-9c11-ab04084430c2
- **Adaline** — Tree/Waterfall toggle, three-level drill (list → trace → span); span detail = raw JSON + metrics. https://mobbin.com/screens/85e692f8-e7c5-4cce-ae0e-681d50e1f3f8
- **Braintrust** — log table + trace-tree drawer; span metrics (start, duration, tokens, I/O, cost); a "Timeline" tab alongside "Trace"/"Thread". https://mobbin.com/screens/eeca0b54-0262-4eef-8a76-f548fe84a384
- **Vercel Activity Log** — append-only mutation feed as audit (date-grouped, prose entries, rollback as natural prose, no axis) — the model for `log.jsonl`. https://mobbin.com/screens/21f29130-3111-4653-804b-49f17874e02a
- **Jaeger UI** (Apache-2.0, React+TS) — canonical OSS waterfall; inline row expansion; scroll virtualization to ~80k spans. https://github.com/jaegertracing/jaeger-ui
- **Honeycomb** — dependency-count badges instead of indent lines; embeds a compressed waterfall in query results. https://docs.honeycomb.io/reference/honeycomb-ui/query/trace-waterfall

### Visual grammar that matters
- **Shared time axis is invariant** (px/ms); root = full width, children offset by start and sized by duration — this proportional encoding makes critical path/concurrency visible.
- **Two columns**: fixed name column (~40–50%, left-pad for nesting, prefer over connector lines past depth 4) + fluid bar column. Child-count badges for collapsed subtrees.
- **Color = kind/status, not duration**; status icon before the name; **right-side drawer, not inline**; drawer minimum = id/name/timestamps/duration + searchable attributes + collapsible raw payload.
- **Axis markers** for discrete events (session open/close, generation mint, guardrail deny) as labeled vertical ticks. **Zoom + scroll-to-selected.**
- **Failure modes:** no virtualization past ~200 rows; truncating label column without ellipsis+tooltip; zero-duration spans invisible (enforce min 2px bar); duration-colored bars (misleading); no empty/skeleton state.

### Libraries
- **A — DIY: `@tanstack/react-virtual` v3 (MIT, ~5–8KB gz) + CSS/SVG bars.** What Sentry/Jaeger effectively do. Near-zero bundle, full control. ✅ Recommended.
- **B — `gantt-task-react` (MIT, ~60KB gz):** PM Gantt, no span nesting/collapse/drawer; could seed a cross-module generation Gantt only. Not for the trace.
- **C — `thundra-trace-chart` (Apache-2.0):** archived 2023, no TS. **Hard no.**
- **D — Jaeger UI source (Apache-2.0):** read for architecture (name/bar split, collapse, render model); not importable.
- **E — `@grafana/ui` TraceView (Apache-2.0):** full pkg ~800KB; study/port the `TraceView` subfolder only.
- **F — canvas (Speedscope/Perfetto):** 100k+ spans at 60fps but not accessible/themeable; only if >5,000 rows (we won't).

### Recommendation
**Build it with TanStack Virtual + CSS bar positioning.** Architecture: (1) transform `runs.jsonl` + session commits → flat span array `{id,parentId,name,kind,startMs,durationMs,status,payload}`; (2) DFS tree → flat ordered list with `depth` + collapse `Set<id>`; (3) row = left-pad nesting + collapse toggle + status icon + ellipsized name | CSS-positioned bar (`left:(start/total)%`, `width:max(2px,(dur/total)%)`); (4) SVG ruler with 4–6 ticks + `[viewStart,viewEnd]` zoom state; (5) right-side drawer; (6) generation timeline as a separate vertical `flex-col` list (StackAI/Vercel pattern, not a waterfall); (7) skeleton/empty/append-on-WS states. **Palette (5 colors):** session=slate, turn=blue-500, action/tool-call=violet-500, error=red-500, guardrail-deny=orange-500.

---

## Flame & icicle charts

### What it maps to
Our data is an **ordered event log + git generation history**, not sampled stack profiling. The correct primitive is the **flame chart** (x = wall-clock/ordinal time, icicle layout, root at top), **not** the Gregg aggregated flame *graph* (x = population frequency). Use icicle (root-at-top) so the session/root stays visible without scrolling.

### Patterns observed
- **Speedscope** (`speedscope.app`, jlfwong, Apache-2.0, 6.7k★): reference browser flamegraph — *Time Order* / *Left Heavy* / *Sandwich* views; Preact+TS+WebGL; 131KB compressed; **not extractable as a library** (issue #16 declined). https://www.speedscope.app/
- **Brendan Gregg FlameGraph**: defines the grammar (x=sorted population, y=depth, width=samples, random warm color); **icicle** = y-flipped; **differential** = red=regression/blue=improvement with saturation = magnitude; same-function-same-color hashing. https://www.brendangregg.com/flamegraphs.html · https://www.brendangregg.com/blog/2014-11-09/differential-flame-graphs.html
- **Chrome DevTools Performance** — flame *chart* (x=time, icicle, root on top). **Sentry Profiling** — differential flamegraph, Before/After toggle, top-delta table. **Perfetto UI** — canvas, generalized flamegraph widget (2024 redesign).
- **Mobbin adjacents:** Sentry waterfall (icicle-as-table) https://mobbin.com/screens/f39fcbfd-d377-4bc0-beb1-92bee2598a28 · Sentry replay+trace co-registration https://mobbin.com/screens/b18d83e1-7711-4b57-8498-633de4848ce9 · **Braintrust eval timeline** (horizontal bar swimlane — exactly a session-checkpoint timeline shape, very low-density/scannable) https://mobbin.com/screens/b34daf5c-5c6a-4906-b5b2-8767293d2cd9 · Dovetail treemap (weight, no time) https://mobbin.com/screens/d444e671-7d72-4181-8ede-7e437dda6c39

### Visual grammar that matters
| Decision | Left Heavy (Gregg) | Flame Chart (Chrome) | Icicle |
|---|---|---|---|
| X-axis | alphabetical→weight | wall-clock time | per parent |
| Y direction | root at bottom | root at top | root at top |
| Width | sample count / total | duration ms | duration ms |
| Color | random warm | category | category |

Use **category color** (create/update/delete; success/fail; module identity), not random. **Differential** red/blue maps cleanly onto generation diffs (red = grew/more restrictive, blue = trimmed). Avoid: SVG at scale (documented 500MB-SVG failure → canvas above ~1000 nodes); conflating chart vs graph width semantics; root-not-visible (use icicle); occluding hover tooltips (use a status bar); zoom without breadcrumb.

### Libraries
- **`flame-chart-js`** (pyatyispyatil, MIT, canvas, React wrapper, TS) — closest off-the-shelf fit; plugin arch (TimeGrid/Marks/Waterfall). Risk: no commits since late 2023; needs a custom JSONL adapter. https://github.com/pyatyispyatil/flame-chart-js
- **`react-flame-graph`** (bvaughn, MIT) — last publish ~6 yrs ago. **Dead, avoid.**
- **`@platformatic/react-pprof`/flame** (Apache-2.0, WebGL, 100k+ frames) — pprof-specific data model, WebGL bundle weight. **Overkill / wrong model.**
- **`icicle-chart`** (vasturiano, MIT, SVG, click-to-zoom) — SVG scalability ceiling; fine for tiny generation histories only.
- **`d3-hierarchy` + `d3-zoom` + canvas** (ISC, ~27KB+~10KB, D3 team, very stable) — max control, matches no-built-in-schema reality, respects bundle discipline; "zoomable icicle" is a ~120-line Observable example (updated Sep 2024). https://observablehq.com/@d3/zoomable-icicle
- **Speedscope source** — study the flat-log→sorted-tree pre-pass + single GPU pass, port only if >5000 nodes.

### Recommendation
**Hand-roll a zoomable icicle with `d3-hierarchy` + `d3-zoom` + canvas**: flame-chart (x=time) variant for session checkpoints, icicle (x=duration, root-on-top) variant for module generations. Three views, one data model: (1) session timeline icicle (session→turns→events, color=event type, click-zoom); (2) module generation timeline = Braintrust-style horizontal swimlane (NOT a flamegraph), click→diff; (3) JSONL stream = flat list with inline mini-bars (flame layer adds value only when nesting is deep). **Differential coloring** (red add / blue delete / amber modify) for gen diffs. Consider `flame-chart-js` only to ship faster, accepting maintenance risk; still needs a JSONL adapter.

---

## Service / dependency topology

### What it maps to
Three topology shapes: (1) **module relation graph** (modules=nodes, typed `relations`=edges) with health overlay from `runs.jsonl`/`log.jsonl` — the Datadog service-map analog; (2) **note-level knowledge graph** (`[[wikilinks]]`/`relations`, sized by degree) — the Reflect/Obsidian analog; (3) **generation DAG** per module (currently a shallow linear chain, depth 5–20).

### Patterns observed
- **Datadog Service Map** — uniform node shape + icon (not shape) for type; **border color = health** (red/yellow/grey); animated edge particles for direction; click → isolate neighborhood (inbound left, outbound right) + side panel; env-scoping re-renders a *different* graph; collapsed-intermediary edges with counts. https://docs.datadoghq.com/tracing/services/services_map/ · widget: https://docs.datadoghq.com/dashboards/widgets/topology_map/
- **Kiali** — node *shape* by type (works with a small fixed taxonomy — maps to our 5 module kinds); edge color+thickness = health+volume; HTTP particles green-circle vs red-diamond (two signal dims/edge); single-click select / double-click ego-network; **migrated Cytoscape.js → PatternFly (React) in 2024** because a separate Canvas render context was a maintenance liability — directly relevant to our React SPA. https://kiali.io/docs/features/topology/
- **New Relic Advanced Maps** — icon-in-container per type; three-state health; **dotted border = uninstrumented** (maps to "note never run"); inbound-left/outbound-right; team-scoped maps with de-emphasized adjacents. https://docs.newrelic.com/docs/service-architecture-intelligence/maps/advanced-maps/
- **Honeycomb** — built a layout playground in an isolated CRA before adding deps; analyzed name lengths / cycles / density first; time-scoped topology snapshots; 2026 positioning toward AI agent↔tool edges. https://www.honeycomb.io/blog/interating-toward-service-map
- **Mobbin:** Twingate access graph (zero-chrome canvas, side panel, "Graph Focused on X" toast for ego mode) https://mobbin.com/screens/e936e96e-ccc9-45a6-8e1f-18e78d308cac · PlanetScale cluster topology (inline CPU/Res %, health dot, right drawer sparklines — closest to "last-run status badge in node") https://mobbin.com/screens/e3eee0f3-cae9-41f0-a79d-1f8615c12921 · Databricks job-run DAG (**Graph | Timeline | List** tabs, conditional True/False edge labels) https://mobbin.com/screens/35674f25-fede-4c71-b1ff-1e450ca90636 · Reflect Map (force-directed, size=degree, color=type — the note-graph analog) https://mobbin.com/screens/5ec1a04a-17e2-48da-8a8f-f46bf5ede19c · Fibery workspace map · Jira dependencies ("blocks (+14d)" temporal edge labels) https://mobbin.com/screens/c54265ad-ab6a-437c-9b1b-7d4850d297a9 · Causal model map (compound/grouped DAG with bounding boxes) https://mobbin.com/screens/326201b9-be93-4a3a-a3b4-c80ca911a52c

### Visual grammar that matters
Module type = **icon inside node** (not shape); health = **border color or dot badge** (green=no-badge default); **dotted border = never run**; relation type = short edge label; direction = single arrowhead; degree = node size/ring; selection = raise selected+1-hop, dim rest to 20%; drill = **right-side panel** (not modal); never an empty canvas. **Layout choice by shape:** module graph (5–20 nodes, directed) → **Dagre** (deterministic L→R, ~40KB, matches depends-on); note graph (10–500, bidirectional) → **D3-Force** (~15.6KB, freeze after stabilize); generation DAG (linear, 5–20) → **D3-Hierarchy** (~14.7KB). Avoid: force for the module graph (instability breaks spatial memory); ELK for small graphs (1.45MB); bidirectional arrowheads; color-only health (pair with icon); canvas-only (kills a11y).

### Libraries
| Library | Bundle (gz est.) | Render | React/TS | Layouts | License | For zuzuu |
|---|---|---|---|---|---|---|
| **@xyflow/react** (React Flow v12) | ~35–40KB | HTML DOM nodes + SVG edges | native, full TS | Dagre/D3/ELK (separate) | MIT (pro features commercial) | **Module DAG + gen spine** |
| react-force-graph-2d | ~80KB | Canvas 2D | functional, TS | d3-force | MIT | **Note knowledge graph** |
| cytoscape + react-cytoscapejs | ~109KB+ | Canvas | thin, non-idiomatic | many | MIT | analysis-heavy only |
| d3-force + custom SVG | ~15.6KB | SVG | bespoke | d3-force | ISC | max control |
| vis-network | ~250KB | Canvas | awkward | force/hierarchical | Apache/MIT | **skip** |
| elkjs (layout only) | ~1.45MB | none | any | 30+ | EPL-2.0 | skip unless >200 nodes |

React Flow core is MIT; verify pro-gating at https://xyflow.com before relying on sub-flows/minimap variants.

### Recommendation
**`@xyflow/react` + `dagre` as the primary engine** (~45–50KB gz, MIT, HTML-DOM nodes = render health badges/run counts as React inside each node). Add **`react-force-graph-2d` lazily behind a "Map" tab** for the note knowledge graph. Adopt the **Graph | Timeline | List** three-tab pattern per module/note (Timeline/List read `runs.jsonl`/`log.jsonl` directly). **Node anatomy** (160×80 rounded rect): type icon top-left; name + note count body; health badge top-right (green check / orange warn / red × / grey dotted = never run); relative-time bottom strip; hover dims non-neighbors; click → right panel (gen count, last 5 log + run events, rollback button, notes link). **Generation DAG** = D3-Hierarchy chain, active gen = solid blue ring, rollback = forward "restore" arrow node (not a branch). Empty state = single placeholder node + `zz observe` CTA.

---

## Audit trails & activity feeds

### What it maps to
`log.jsonl` mutations → **timeline/feed** (contextual per-module history); cross-module generation history → **tabular audit log** (investigation at scale). Both are needed.

### Patterns observed
- **Two-mode split** is universal: timeline/feed (Linear, Stripe, Basecamp) vs. tabular audit log (PlanetScale, Cloudflare, 1Password, Grok).
- **Linear Activity** — slim single-line list; two tiers (system events: small icon + grey 11–12px, ~12–16px line; user comments: avatar + full card); status dots match board colors; one scroll column. → model for `log.jsonl`. https://mobbin.com/screens/36fcffe3-6e93-499d-a8e0-02fd861221d8
- **Stripe Timeline** — atom per step (status icon + one sentence, no avatars, "View details" inline sub-events, absolute timestamps, thin vertical connector). → model for `runs.jsonl`. https://mobbin.com/screens/da063812-68ec-4fe5-b927-981be49b86d2
- **Vercel Activity Log** — date-grouped, small avatar, bolded/linked nouns, relative time right; on-demand left filter panel (doesn't shrink main column); chevron-collapses related deployment events. → session-burst grouping. https://mobbin.com/screens/76997138-2ebb-4d1b-ae54-22485d3a9138 (filtered: https://mobbin.com/screens/e6f12935-765d-40eb-b418-87195bbfe0ec)
- **PlanetScale Audit Log** — actor email | **monospace action chip** (`branch.enabled_safe_migrations`) | resource | IP/geo | precise ts; actor autocomplete filter. Monospace verb-noun chips suit `module.note_created`, `module.generation_minted`, `session.turn_checkpoint`. https://mobbin.com/screens/d7448333-6400-49dd-b11f-e48e4e229200
- **Discord Audit Log** — expand row → field-level `from → to` diff. https://mobbin.com/screens/335d4d28-4d0f-48b8-bdda-43386205bfb0
- **Fibery** — in-table "What Changed" chip (`Claims: Guest → Admin`). https://mobbin.com/screens/19c2da51-bfa6-4c1d-b423-90cf26b181ff
- **Customer.io** — deepest inline expansion: full JSON from/to + source/IP metadata. → model for `evolve` frontmatter diffs. https://mobbin.com/screens/b38ebe97-02ca-4634-95ea-5b959fe8c9b5
- **Airbnb / Zoho** — sticky date-header grouping. **Grok** — volumetric sparkline above table, click-bucket-to-filter. https://mobbin.com/screens/5e913d46-b5d0-464b-bdcb-ff31be5e9e7d
- **GitHub Gist revisions / Linear version history** — narrow version sidebar + main before/after diff + "Restore version". → gen N-1 → N. https://mobbin.com/screens/6c14e085-9ff5-4e61-9a21-b04f1b0a3433

### Visual grammar that matters
**Event atom = `[icon/avatar] [sentence] [chip] [timestamp]`** (system = monochrome icon, user = avatar; sentence template `{actor} {verb}-ed {object} on {resource}`; monospace type chip; right-aligned relative time, absolute on hover). **Color = semantic only** (green=success/create, red=delete/fail, amber=warn, blue=update, grey=system); never full-row background (reserve red row only for destructive). **Three density tiers:** compact ~28px (audit tables), standard ~40px (`log.jsonl`), rich ~72px+ (`runs.jsonl` with exit code + stdout snippet). **Diff nesting:** in-row chip (single field) → expandable accordion (3–10 fields) → full diff (body changed); cap collapsed diff ~200px. Avoid: no grouping (wall of events); avatars on system events; relative-only time; flat single-level weighting; uncapped inline diff.

### Libraries
- Feed list: **`@tanstack/react-virtual`** (~5KB, MIT) — hand-roll non-uniform rows (runs taller than mutations). `react-chrono` (MIT, ~45KB) only for a small static generation timeline. MUI/Flowbite timelines = too heavy / dep-coupled.
- Diff: **`react-diff-view`** (MIT, active) needs parsed unified diff (`parse-diff` ~2KB); **`react-diff-viewer-continued`** (MIT, active) takes raw old/new strings; `react-diff-viewer` (dead 2019, avoid); `diff-match-patch` (Apache-2.0) for word-level only. For single-field "old → new", no library — two spans + arrow.
- Filter: no library — date range (`react-day-picker` ~10KB) + checkbox facet panel + in-memory text filter; volume chart via Recharts (~45KB) or pure CSS bars.

### Recommendation
Three components: **(1) Module Mutation Feed** (`log.jsonl`) — Linear layout, compact 28–36px atoms, colored left-border by verb, monospace type chip, relative ts; date grouping; expand → `key: old → new`; capped 200px; TanStack Virtual, hand-rolled row. **(2) Runs Feed** (`runs.jsonl`) — Stripe atoms, 48–56px, status icon, "ran `sanitize.sh` · exit 0 · 1.2s", absolute ts; expand → 3-line stdout snippet; failure → last stderr line amber. **(3) Module Generations Timeline** — Linear version-sidebar + main diff via `react-diff-viewer-continued` (unified, not split — narrower in a workbench) + "Restore to gen N" with confirm; no virtualization (<100 gens); cross-module overview via Recharts bar chart. **Cross-cutting:** collapsed `<EventFilter>` bar (date range + type multi-select), filter state in URL params. **Defer** live SSE/WebSocket push.

---

## Structured (JSONL) log-stream viewers

### Canonical three-panel layout (Vercel, Better Stack, Cloudflare)
1. **Left sidebar facets** (~180px) — collapsible enumerated field values + counts, checkbox toggles, zero-counts dimmed not hidden. Better Stack https://mobbin.com/screens/6141fcee-250f-434f-9255-3f287e164c81 · Vercel https://mobbin.com/screens/c534131b-0086-4d8c-9d5b-6277e8c6d9a9
2. **Top bar** — time range + **Live pill** (green dot, not checkbox) + search; a **density histogram** between selector and table, clickable to zoom. Cloudflare makes it the full-width header band https://mobbin.com/screens/cbf28d46-8663-4731-a826-179bc4f0fb16
3. **Main panel** — virtualized monospace table: fixed-width ISO-ms timestamp | status pill (`200 GET` green / `304` grey / `404` red) | source | label | truncated message; hover copy-icon. Vercel live tail https://mobbin.com/screens/c534131b-0086-4d8c-9d5b-6277e8c6d9a9 (empty state keeps headers + zero-bar histogram + "no logs in this time range" + Refresh https://mobbin.com/screens/bf58941a-0e8e-4802-b7f0-614e26c14bac). Modal (dark, streaming-first, color-coded lines, no facets) https://mobbin.com/screens/1f2f0cd1-eadb-435f-9632-116b03a1fc22

### JSON expansion — two patterns
- **A — inline/split-pane detail** (Stripe, Amplitude, WorkOS): fixed-height summary row → bottom-drawer or persistent right pane with line-numbered syntax-highlighted JSON. WorkOS https://mobbin.com/screens/a5b50327-60e0-4075-9cfd-7f383d18265c · Stripe master-detail https://mobbin.com/screens/5423e185-8374-4b6c-a4a0-2d3ae9adc1d0
- **B — tree expand (accordion)** (Mixpanel `JSON mode` toggle, Better Stack inline tree). Mixpanel https://mobbin.com/screens/a547b543-06f1-4d41-918d-75122f17f2e6

For zuzuu, **Pattern A (split-pane)** is cleaner — list stays fixed-width, panel shows structured fields + raw JSON.

### Live tail (Better Stack)
New rows push up; **"Jump to Live Tail"** sticky button when scrolled up; draggable histogram scrubs to a timestamp (explicit mode exit/re-enter); per-line full `YYYY-MM-DD HH:MM:SS.mmm TZ` monospace. https://mobbin.com/screens/e708a755-ce3b-4499-bf4c-f4ed18e2dd7d
**Avoid:** relative timestamps in streams; "Load more" pagination for streaming; infinite scroll that loses position on re-render (anchor to stable item key, not DOM index).

### Visual grammar
Absolute ISO-8601 ms monospace timestamps (relative only in hover). **Severity color (Grafana standard):** critical=purple, error=red, warning=amber, info=green, debug=blue, trace=light-blue, unknown=grey — as a **2–3px left-border accent**, not full fill. Event-type verb chip (create/update/delete = green/blue/red). `success:true`=green check / `false`=red ×, exit code secondary. JSON key highlighting (dim keys / warm strings / accent numbers / grey null) as a scan aid. **Density ~20–24px row, 14px font** (~25 lines in 600px). Empty state keeps headers + histogram.

### Libraries
| Library | Min | Dynamic heights | Active | Notes |
|---|---|---|---|---|
| **react-virtuoso** | ~17KB | auto (ResizeObserver) | yes | `followOutput` = live-tail anchor; `startReached`/`endReached` infinite scroll |
| @tanstack/react-virtual | ~5KB | `measureElement` | yes | headless, TS-first, fixed-height tables |
| react-window | ~6KB | no | maint-only | ruled out |

JSON panel: **`react-json-view-lite`** (~2KB gz, MIT, zero-dep, 100% TS, ARIA; 195ms on 300KB) ✅; alternatives `@uiw/react-json-view` (~20KB, search/per-node copy), `@microlink/react-json-view`. Live text/ANSI stdout: **`@melloware/react-logviewer`** (maintained fork of `react-lazylog`; ANSI, WebSocket/chunked HTTP). Filter chips: plain controlled input + chip renderer. Timestamps: `date-fns` or even `toISOString()`.

### Recommendation
**`log.jsonl`** → two-pane: virtualized table (react-virtuoso) + sticky right detail (`react-json-view-lite` for `payload`); colored left-border by verb; absolute ISO-ms; type chip; module; truncated noteId; "Copy JSON"; CSS histogram by hour; **no live-tail** (mutations are write-once/bounded — it's an audit table). **`runs.jsonl`** → react-virtuoso in `followOutput`; row = ts/noteId/exit-code badge/duration/stdout-first-line; expand → `@melloware/react-logviewer` ANSI stdout+stderr; Live toggle pins to end, scroll-up auto-pauses, "Jump to latest" re-anchors. **Session checkpoints** → vertical timeline, not a log viewer. **Facets sidebar** → no library (~60 lines: enumerate `type`/`module`/`success`/`exitCode` from parsed JSONL → checkbox tree).

### Sources
Grafana logs UI https://grafana.com/docs/grafana/latest/explore/logs-integration/ · Grafana JSON logs https://grafana.com/docs/grafana/latest/explore/simplified-exploration/logs/viewing-json-logs/ · Datadog facets https://docs.datadoghq.com/logs/explorer/facets/ · Datadog live tail https://docs.datadoghq.com/logs/explorer/live_tail/ · react-virtuoso https://virtuoso.dev/react-virtuoso/ · virtualization comparison https://www.pkgpulse.com/guides/tanstack-virtual-vs-react-window-vs-react-virtuoso-2026 · react-json-view-lite https://github.com/AnyRoad/react-json-view-lite · @melloware/react-logviewer https://www.npmjs.com/package/@melloware/react-logviewer · lnav https://lnav.org/features

---

## Version history & diff timelines

### Patterns observed
- **Flat chronological list + inline preview + restore** (Notion, Writer, Substack, Linear, ClickUp, Gamma, Slite, Google AI Studio): right panel 240–320px, timestamp/avatar/summary, newest-top, date-grouped, selected-row tint, "Restore version" CTA, "Current version" badge; Gamma shows "N snapshots over last X min". Notion https://mobbin.com/screens/2f220e7d-4363-4485-af76-15d1597ae3b5 · Linear https://mobbin.com/screens/68d3a291-4609-4664-b9f1-09a9c6b5f4fe
- **Deployment lineage picker** (Vercel Instant Rollback): modal with two cards "Current" vs "To the following deployment" (URL/commit/branch/author/"live for Ys"), impact warning, two-step confirm. → model for gen rollback. https://mobbin.com/screens/e9f2ebc9-e602-4325-9775-a2d5ed276124
- **Git-native commit log** (GitLab Commits: avatar/author/message/relative-ts/short-SHA/branch-dot; Repository Graph swimlanes; Graphite +7,212/-0 diff stats). https://mobbin.com/screens/dac0d824-a5f9-434d-9886-51cf7f78bf4f
- **Diff side-by-side vs unified** (GitHub PR files-changed: file tree + Unified/Split toggle, `@@ hunk @@`, red/green; Replit; GitLab numbered side-by-side; Neon three-panel Base/Database/Compare; Google AI Studio lightweight inline-over-summary for short content). https://mobbin.com/screens/01d3364c-34f3-429c-ac6f-2e6c5c1775a0
- **Table audit log** (Employment Hero, Fibery, Cloudflare, Grok: filters + Timestamp/Entity/Action/Actor/What-Changed; Grok adds sparkline). https://mobbin.com/screens/ead077d3-5811-4840-8d8b-b8496d1ed8c0
- **Rollback confirmation** = two-step + impact statement (Notion/Vercel/Confluence/Manus/Productboard); Resend cleanest: "revert to the version from **24min ago**?" bolded relative ts. https://mobbin.com/screens/450e76cf-4e4c-420b-9802-9831819df1d4

### Visual grammar
Relative time recent / absolute >24h; **day grouping** load-bearing past ~10 entries; thin gray vertical connector; green(+)/red(−) universal in diffs (don't break even for markdown); "Current version" accent badge as the single anchor; rows 40–48px (≥36px for a11y); diff monospace 13–14px line-height 1.4–1.6. **Session checkpoints = collapsible groups** (session parent = squash end-state; turns collapsed by default, expandable for forensics). Avoid: undifferentiated auto-save lists (mitigate with gen labels / session squash-grouping); diffs with no context (≥3 lines); rollback without consequence framing; missing single-generation empty state.

### Libraries
- **react-diff-view** (MIT, active, TS) — parsed unified hunks (via `parse-diff`); split/unified; Refractor highlight in worker; highly extensible; ~1.48MB unpacked but tree-shakes <20KB gz; 26s on a 2.2MB diff unvirtualized (fine for note-size).
- **react-diff-viewer-continued** (MIT, active fork) — **raw old/new strings, no diff pipeline**; side-by-side + inline, Prism highlight, word-level; ~1.1MB unpacked. ✅ simplest for markdown/JSONL.
- **@git-diff-view/react** (MIT, multi-framework) — GitHub-style OOTB, SSR; smaller community.
- **diff2html** (MIT, 3.3k★) — string→HTML, needs `dangerouslySetInnerHTML`; awkward in React tree; good for SSR/non-React.
- **Monaco `DiffEditor`** (`@monaco-editor/react`, MIT) — gold standard, ~2MB gz (lazy-load); **free if the editor pane already uses Monaco**.
- Timeline list: **plain React + CSS** (left-border + ::before dot) + virtualization. Commit graph (future): `@gitgraph/react` (MIT, stale 2022) or d3 — **defer until lineage becomes non-linear** (it currently isn't).

### Recommendation
- **Per-module generation timeline**: right 280px panel (Writer/Notion style), date-grouped, row = gen# + ts + type label + "Current" badge; click → inline content preview; rollback = Vercel two-card confirm + "Generation N restored as N+1; current content preserved"; `@tanstack/virtual` only if >100 gens.
- **Gen↔gen diff**: **`react-diff-viewer-continued`** (raw strings = no parse pipeline; side-by-side + word-level), lazy `import()` under `<Suspense>`. Use Monaco `DiffEditor` instead **only if** Monaco already powers the note editor.
- **JSONL event log**: table-with-sparkline (Grok/Cloudflare style); virtualize with `@tanstack/virtual`.
- **Session checkpoint trace**: nested accordion (session parent + collapsed turn rows + vertical connector), **no library**; collapsed by default.

| Concern | Library | Bundle | Note |
|---|---|---|---|
| Diff | react-diff-viewer-continued | ~1.1MB unpacked, lazy | drop-in markdown/JSONL |
| Diff (if Monaco present) | @monaco-editor/react DiffEditor | 0 extra | best code diff |
| Timeline list | plain React + CSS | 0 | left-border connector |
| Virtualization | @tanstack/virtual | ~16KB | log.jsonl at scale |
| Volume chart | recharts BarChart | ~130KB if present | don't add solely for this |
| Date format | date-fns | ~12KB | likely already present |
| Commit graph (future) | @gitgraph/react / d3 | 80–300KB | defer until non-linear |

**Do not use** `react-diff-viewer` (6yr stale) or `vis-network` (wrong domain).

---

## Cross-cutting visual grammar

- **List → trace → span** three-level drill everywhere; **Graph | Timeline | List** three-tab per module/note.
- **Right-side detail drawer** (not modal, not inline expansion) for span / audit row / generation.
- **Color = kind/status, never duration**; ≤6 semantic colors + legend; pair every health color with a badge icon; 2–3px left-border accent, never full-row fill.
- **Timestamps:** absolute ISO-8601 ms (monospace, fixed-width) in *streams*; relative ("3m ago") in *activity feeds*, absolute on hover; **date-group** long lists; **session-burst collapse**.
- **Virtualize** every unbounded list (react-virtuoso for live/variable, tanstack/virtual for fixed); min 2px bar width; ellipsis+tooltip on truncated names.
- **Empty/skeleton states always** (keep headers/histogram; placeholder node + `zz observe` CTA).
- **Rollback** = two-card current-vs-target confirm + "preserved as new generation" framing.
- **Local-first:** poll/`fs.watch` 2–3s, defer SSE/WebSocket push until cloud waves E–H.

---

## Consolidated recommendations table

| Need | Pattern | Library / approach | Verdict for lean Vite+React+TS | Why |
|---|---|---|---|---|
| Session/turn trace | Two-column waterfall + right drawer | **DIY: @tanstack/react-virtual + CSS/SVG bars** (MIT) | ✅ Build | No lib matches our model; shallow traces; near-zero bundle; full control |
| Session/gen flame view | Icicle (root-top) + flame chart (x=time) | **DIY: d3-hierarchy + d3-zoom + canvas** (ISC) | ✅ Build (optional) | Matches no-schema data; bundle-tight; canvas handles our scale |
| Quick flame (ship faster) | Canvas flame chart | flame-chart-js (MIT) | ⚠️ Fallback | Closest OOTB but stale since 2023 + needs JSONL adapter |
| Module relation graph | Hierarchical DAG + health overlay | **@xyflow/react + dagre** (MIT) | ✅ Use | HTML-DOM nodes = React health badges; deterministic depends-on layout |
| Note knowledge graph | Force-directed, size=degree | **react-force-graph-2d** (MIT), lazy "Map" tab | ✅ Use (lazy) | Organic clustering; load only when opened |
| `log.jsonl` mutations | Audit table + right JSON detail | react-virtuoso/tanstack-virtual + **react-json-view-lite** (MIT) | ✅ Use | Write-once table; ~2KB JSON viewer |
| `runs.jsonl` executions | Live stream + ANSI stdout | **react-virtuoso `followOutput`** + **@melloware/react-logviewer** | ✅ Use | followOutput = jump-to-live; ANSI/stream support |
| Activity feed | Linear/Stripe atoms | **DIY rows + @tanstack/react-virtual** | ✅ Build | Non-uniform row heights; trivial markup |
| Generation timeline | Version sidebar + restore | **plain React + CSS** (+ tanstack-virtual if >100) | ✅ Build | Linear chain, small N |
| Gen↔gen diff | Side-by-side / unified | **react-diff-viewer-continued** (MIT), lazy | ✅ Use | Raw old/new strings = no parse pipeline for markdown notes |
| Gen diff (if Monaco present) | Editor diff | @monaco-editor/react `DiffEditor` (MIT) | ✅ Use if amortized | Best diff UX, cost already paid |
| Session checkpoints | Nested collapsible accordion | **plain React + CSS** | ✅ Build | No lib needed |
| Filters / facets | Sidebar checkboxes + chips | **plain React** (+ react-day-picker ~10KB) | ✅ Build | ~60 lines; known fields |
| Event-volume chart | Histogram, click-to-filter | **CSS bars** (or recharts if already present) | ✅ Build / reuse | Avoid adding recharts solely for this |
| — | — | react-flame-graph, react-diff-viewer, thundra-trace-chart | ❌ Avoid | Unmaintained / archived |
| — | — | vis-network, elkjs, @platformatic/react-pprof | ❌ Skip | Wrong domain / too heavy / wrong data model |
| — | — | cytoscape (+ react-cytoscapejs) | ⚠️ Only if analysis-heavy | Kiali migrated *away* from it for a React SPA |

---

## Open questions for the build phase

1. **Session→span data extraction.** How reliably can we reconstruct turn/tool-call spans from squash-merged session branches? Do per-turn commit bodies carry enough structure (turn #, tool name, duration) for a waterfall, or do we need `runs.jsonl` correlated by `ts`/`sessionId`? Confirm a shared correlation key exists.
2. **Durations.** `runs.jsonl` has `ts` + presumably duration; do `log.jsonl` mutations and session checkpoints carry start/end, or only a single timestamp? Without durations, the waterfall degrades to an ordinal timeline (still fine, but changes bar semantics).
3. **JSONL volume ceiling.** Realistic max `log.jsonl`/`runs.jsonl` size in an active dogfood repo (e.g. `cards-game`)? Confirms whether virtualization + client-side filtering suffices or we need a worker / indexed read.
4. **Monaco or not.** Will the note-editor pane embed Monaco? If yes, use its `DiffEditor` for generation diffs (free); if no, `react-diff-viewer-continued` lazy-loaded. This decision gates ~2MB of potential bundle.
5. **React Flow pro-gating.** Re-verify which features (sub-flows, minimap variants) are MIT vs commercial at build time — pricing has shifted; we must stay on the free MIT tier.
6. **Live updates.** Is a 2–3s `fs.watch`/poll acceptable UX for the local workbench, or does the daemon's existing WebSocket warrant wiring a push channel now (vs deferring to cloud waves E–H)?
7. **Generation lineage shape.** Is per-module lineage guaranteed linear (forward-recorded rollback), or could branching ever appear? Determines whether we can ship a simple commit-log list or must reserve a DAG renderer.
8. **Cross-module generation timeline.** Is there real demand to see all modules' generations advancing on one shared axis (Gantt/swimlane), or is per-module sufficient for v1?
9. **Theming.** Light + dark both required at launch? Affects the canvas-vs-DOM choice for the flame/icicle view (canvas isn't CSS-themeable; DOM/SVG is) and the severity palette.
10. **Accessibility bar.** How far do we take keyboard nav / ARIA on graph and waterfall views? Canvas rendering (force graph, icicle) trades a11y for scale — confirm acceptable for a local dev tool.

---

## Sources

Consolidated from the six research passes; key references inline above. Primary docs: Sentry trace view & changelog, Datadog APM/service-map/facets/live-tail, Kiali topology, New Relic Advanced Maps, Honeycomb service-map blog & waterfall docs, Jaeger UI (GitHub), Grafana logs UI, Brendan Gregg flame graphs (+ differential), Speedscope design post, Perfetto/Perfsee flame-chart-vs-graph. Libraries: TanStack Virtual/Table, react-virtuoso, react-json-view-lite, @melloware/react-logviewer, @xyflow/react (xyflow.com), react-force-graph, react-diff-view / react-diff-viewer-continued / @git-diff-view, diff2html, d3-hierarchy/d3-zoom (Observable zoomable-icicle), gantt-task-react. Mobbin screens: Sentry, StackAI, Adaline, Braintrust, Vercel (Activity/live-tail), PlanetScale, Discord, Fibery, Customer.io, Grok, Linear, Stripe, WorkOS, Mixpanel, Modal, Cloudflare, Better Stack, Twingate, Databricks, Reflect, Jira, Causal-model-map, Notion, Writer, GitLab, GitHub, Graphite, Replit, Neon, Manus, Productboard, Resend, Google AI Studio — URLs cited inline in the relevant sections.
