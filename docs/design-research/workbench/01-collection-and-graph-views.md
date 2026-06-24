# Workbench Research 01 — Collection & Graph Views

> **Scope.** Design patterns and library tradeoffs for the entity-collection surfaces the zuzuu workbench is missing: the **envelope list/feed**, the **typed table**, **advanced tabular UX** (filter/group/saved-views/multi-view), **force-directed & Obsidian-style graph views**, and the **single-envelope detail/card view**. The workbench is a deliberately lean local **Vite + React + TypeScript** SPA (it was cut 18.1k → 1.7k LOC; runtime deps ride as `optionalDependencies`, so bundle size + license cleanliness are first-class constraints). Every pattern below is judged against zuzuu's data shape: typed markdown **envelopes** (`type: knowledge | action | rule | instruction | episode`, optionally runnable via a `run:` field), grouped into **modules**, wired into a **typed link graph** (`relations:` + computed backlinks), with git-native **generations** and append-only **JSONL** logs — and against the hard rule that **every write is human-gated** (the gate is the moat).

---

## Table of contents

1. [Executive summary](#executive-summary)
2. [List & feed views](#1-list--feed-views)
3. [Tables — the baseline](#2-tables--the-baseline)
4. [Advanced tabular UX — filter, group, saved views, multi-view](#3-advanced-tabular-ux)
5. [Force-directed graph views](#4-force-directed-graph-views)
6. [Obsidian-style knowledge graphs](#5-obsidian-style-knowledge-graphs)
7. [The envelope detail / card view](#6-the-envelope-detail--card-view)
8. [Consolidated recommendations table](#consolidated-recommendations-table)
9. [Open questions / decisions for the build phase](#open-questions--decisions-for-the-build-phase)
10. [Appendix — sources](#appendix--sources)

---

## Executive summary

The 6-10 highest-leverage takeaways across all six research streams:

1. **Two libraries cover almost everything: `@tanstack/react-table` (v8) for structured/typed views and `react-virtuoso` for list/feed/log views.** Both are MIT, headless or near-headless, TypeScript-first, and small (~15 kB + ~17 kB gzip). Together they handle the envelope list, the typed table, grouping/filtering, the JSONL log feed, and the audit trail. This is the spine of the recommendation.

2. **Avoid the batteries-included heavyweight grids.** AG Grid Community (~298–330 kB, grouping/pivot gated behind a $999/dev Enterprise license), MUI X (grouping is Pro-only + drags in MUI's theme system), and Handsontable (commercial license) are all disqualified on bundle weight, license cleanliness, or both — direct conflicts with the workbench's `optionalDependencies` + OSS-MIT posture.

3. **For graphs, start with `react-force-graph-2d` (Canvas, MIT, ~60–90 kB) and keep `sigma.js + graphology` as the documented scale-up path.** Canvas 2D is fine to ~500–2,000 nodes — well beyond any first-year vault. Sigma's WebWorker ForceAtlas2 (off the main thread, won't block Monaco) becomes worth it past ~2,000 nodes. Skip 3D/Three.js (~600–800 kB), Cytoscape (algorithm weight with no payoff yet), and vis-network (effectively unmaintained).

4. **Linear is the reference model for the envelope list; Reflect (in Mobbin) is the reference for the graph.** Linear: ~28–32 px rows, type-as-a-left-edge-color-dot (not a full badge), sticky collapsible group headers with counts, hover-to-reveal checkbox, bottom-anchored bulk action tray. Reflect: force-directed map, node color by `type`, node size by backlink degree (use `sqrt`), filter panel as an overlay (not a permanent sidebar), hover-focus dimming of non-neighbors.

5. **The detail/card view should be the Linear split: properties-right-rail (fixed), markdown-body-left (scrollable, max ~720 px).** Render the body with `react-markdown` + `remark-gfm` (~6 kB, XSS-safe React elements). For code/`run:` syntax highlighting, **reuse Monaco read-only if `@monaco-editor/react` is already bundled** before adding `react-shiki`. The whole `<EnvelopeDetail>` should land under ~30 kB gzip incremental.

6. **The gate semantics force a divergence from every spreadsheet reference.** Inline cell edits to behavior-bearing fields (a rule's `severity`, an action's `run:`, an instruction body) must **not auto-save** — they queue a *proposal* into the `review` flow (the edited cell turns amber + "Propose"), wiring the table UI directly onto the `review approve|reject` verb. Most cells are read-only by default; libraries that assume all-cells-editable (react-data-grid, react-datasheet-grid) are a semantic mismatch for the primary browser.

7. **Logs/audit trails are a distinct surface — do not force them into the graph or the grouped table.** Use `react-virtuoso` (`followOutput` for live tail) with the WorkOS/Fibery/PlanetScale audit pattern: row-on-left, raw JSON payload on the right (split-pane), expandable diff rows (Customer.io), `verb.noun` event types as monospace badges, and explicit pagination only where "anchor to a known position in the log" is a real need (e.g., the log entry for a specific generation).

8. **Empty/loading states must be three-way specific, not generic.** Distinguish (a) genuinely empty / first-run → onboarding CTA ("Run `zz observe` or approve a proposal"); (b) filtered-to-zero → retain filter chips + "Clear filters"; (c) loading → skeleton rows at the exact configured row height to prevent layout shift. Sparse-graph first-run needs the same care (a 3-node example, not a blank canvas).

9. **Virtualization is non-negotiable but cheap here.** The local SQLite index answers at ~13 ms for 5,000 notes, so there's no server-pagination need for collection views — virtual scroll everywhere, explicit pagination reserved for audit logs. Pair `@tanstack/react-virtual` (~5–10 kB) with TanStack Table; `react-virtuoso` brings its own.

10. **Density, keyboard nav, and sticky group headers have specific failure modes worth pre-empting.** Density = a CSS custom property (`--row-height`) on the container, never a React re-render. Keyboard nav = document-level `j`/`k` + roving `tabIndex` (~30 lines, not a dep). Sticky group headers must be *list items inside the virtual scroll container* (react-virtuoso's `GroupedVirtuoso`), never `position:sticky` wrappers outside it (the virtual DOM zeroes the ancestor height and breaks the calc).

---

## 1. List & feed views

The envelope list is the workbench's primary collection surface, and the JSONL log/event stream is its companion. They have structurally different requirements and should be configured differently from one shared library.

### Patterns & design approaches (real apps + Mobbin)

**Linear — the reference for developer-tool list density** ([selection+action bar](https://mobbin.com/screens/be6c4ee4-aa93-42b4-89b3-dcfc8386f022), [issues list](https://mobbin.com/screens/46088879-314c-405c-88b5-eb7820c05efb)). The single most applicable model for the envelope list:

- Rows are **~28–32 px** — scannable without bloat.
- **Type/status is a small left-edge colored dot or icon, never a full badge.** Color carries categorisation (`type` → the five module kinds map naturally) without eating horizontal space. The rest of the row is text; the title is left-anchored and gets the most room.
- **Sticky group headers** collapse/expand the group and carry a count badge ("Backlog 21"); visually distinct (lighter background, smaller text) but share the row grid so columns stay aligned.
- **Inline metadata is right-justified** and progressively truncated at narrow widths (avatar, date, priority, label pills).
- **Selection model:** click a row to open; a leading checkbox appears on hover to enter bulk-select; once any item is checked, a contextual action bar replaces the column headers.
- **Filtering is chip-based** on a toolbar above the list; the list never wraps filter state into rows.

**Other directly-applicable references:**

- **Sentry issues feed** ([1](https://mobbin.com/screens/b12617bc-63e9-40d4-9518-536ab23197c2), [2](https://mobbin.com/screens/312c84c3-b42e-49eb-84ef-d0bde69f5668)) — two-line row variant (bold title + secondary snippet), right-side quantitative columns with sort arrows. The shape for a JSONL row (timestamp, actor, payload summary).
- **Superhuman Mail** ([1](https://mobbin.com/screens/8df679bd-12c9-4357-ae31-9782d80ac83f), [2](https://mobbin.com/screens/d02c7e73-c34b-42f1-8ab0-802779804103)) — high-density (~22 px) time-grouped feed, sticky date headers as the only separator, whitespace not borders. The model for scrolling thousands of JSONL entries fast.
- **Notion Mail** ([1](https://mobbin.com/screens/bc41536c-56aa-4614-a12e-787b075776a5), [2](https://mobbin.com/screens/270d85fb-89a9-48fa-8b9a-c894707b2993)) — a **"Group by" dropdown** (Date / Priority / Labels / …) reorganizes the same list without reload; sticky headers re-label, rows stay identical. Exactly zuzuu's "group by module" / "group by type" need.
- **Vercel activity feed** ([1](https://mobbin.com/screens/358be6bd-51d0-4c1f-83c6-f51ed316b6f0), [2](https://mobbin.com/screens/2f3056eb-a31a-4b3e-ae4b-1bcc1352117f)) — **narrative event rows** (icon + rich-text sentence + relative time), sticky month headers. The model for the observe/propose journal where events are actor-verb-target sentences from the JSONL log.
- **WorkOS Events** ([screen](https://mobbin.com/screens/487db82c-a6f6-4371-9c55-2b4f65e3fc3a)) — **split-pane audit list**: list left, code-rendered JSON payload right, click populates the right pane. The precise model for the JSONL log viewer.
- **Fibery audit log** ([screen](https://mobbin.com/screens/8ebb779a-53f5-4ba8-b717-ea5b9cda1017)) — dense ~24 px rows (Public ID, Entity, Event, When, Who, What Changed), hundreds of rows, virtualized/infinite path.
- **GitHub notifications** ([1](https://mobbin.com/screens/fbf0fa53-e61e-4130-9bda-c5405dc91304), [2](https://mobbin.com/screens/2e7cf2ed-0d26-4544-93c4-4a7b6cba2e8d)) — leading colored unread dot, hover checkbox, "Select all" in the header, floating bottom action bar.
- **Midday** ([tagged list](https://mobbin.com/screens/ea584882-b26b-47f4-b632-5860a9888060)) — multiple inline pill tags per row; directly useful — an envelope row can carry its `type:` and `relations:` count as inline pills without a separate column.

**Empty / loading states** — Mixpanel ([no-results, retains chips](https://mobbin.com/screens/27187cf5-dcc8-4435-a54d-38ec7bde55e2)); Better Stack ([centered spinner, chrome preserved](https://mobbin.com/screens/c48e044d-42af-4cac-a2b4-d0468d55ab88)); Midday ([no-results + "Clear filters", ghost rows blurred](https://mobbin.com/screens/764b3128-3a79-43ca-8815-9a9024832473)); Airbnb ([full skeleton at exact row heights, no layout shift](https://mobbin.com/screens/19457388-b11a-45f4-ab9c-de2a15d9dd6e)).

**Bulk selection / action bar** — Clay ([toolbar replaces headers](https://mobbin.com/screens/14020139-fdf1-4860-8301-210d0148a649)) and HubSpot ([same](https://mobbin.com/screens/bb7f0f5a-1de4-4773-b66a-f46e11c4ea24)); Hotjar ([floating bottom bar](https://mobbin.com/screens/ff3024b1-5264-483e-afa7-460a0224ff89)); Folk ([bulk ops in a ··· dropdown](https://mobbin.com/screens/53204879-6a32-4f5d-ad5f-2adef77f8dc6)).

### Interaction models & their failure modes

- **Density modes** (compact ~24 px / comfortable ~32 px / spacious ~44 px) are a user-persisted preference, **not** a responsive breakpoint. *Failure mode:* implementing as a React prop that re-mounts the list. *Fix:* a CSS custom property (`--row-height`, `--row-padding`) on the container.
- **Sticky group headers** must be rendered **as list items inside the virtual scroll container** (`position:sticky; top:0`), as `GroupedVirtuoso` does. *Failure mode:* sticky wrappers *outside* the virtual container — the virtual DOM only renders visible rows, so the sticky ancestor gets zero height and the calc fires from the wrong reference.
- **Keyboard nav** — roving-tabindex (one focusable element at a time); document-level `j`/`k` with a selection cursor distinct from browser focus (Linear). *Failure mode:* `tabIndex={0}` on every row makes Tab walk the whole list.
- **Checkbox selection** — "click row = open; hover reveals checkbox; click checkbox = bulk mode." *Failure mode:* always-visible checkboxes add 32 px of noise per row and train misclicks.
- **Empty-state specificity** — three separate implementations (genuinely empty / filtered-to-zero / loading), per the executive summary.
- **JSONL tail scroll** — pin to bottom in "tail mode" only if the user is already at the bottom; never yank a scrolled-up reader. react-virtuoso's `followOutput` handles this; TanStack Virtual requires manual work. *Failure mode:* `scrollToIndex(0)` on every event.

### Library options (list/feed virtualization)

| | react-virtuoso | @tanstack/react-virtual | virtua | react-window |
|---|---|---|---|---|
| Bundle (gzip) | ~17 kB | ~5 kB | ~3 kB | ~6 kB |
| Sticky group headers | **Built-in** (`GroupedVirtuoso`) | DIY | No | No |
| Dynamic heights | Auto | `measureElement` | Auto | Manual only |
| JSONL tail mode | **`followOutput`** | DIY | No | No |
| TypeScript | First-class | First-class | First-class | `@types/*` only |
| License | MIT | MIT | MIT | MIT |
| Status | Active (~2.1M/wk) | Active (~1.3M/wk) | Active | **Maintenance mode (2019)** |

- **react-virtuoso** ([repo](https://github.com/petyosi/react-virtuoso) / [docs](https://virtuoso.dev/)) — ~12 ms initial render at 100k items, 60 fps, ~20 DOM nodes in view. *Tradeoff:* it owns the scroll container + `position:absolute` wrapper, so nested-scroll layouts (Monaco + list in one panel) need care.
- **@tanstack/react-virtual** ([docs](https://tanstack.com/virtual/latest)) — headless hook, you own all markup; best when already using TanStack Table (single ecosystem) or for custom column virtualization.
- **virtua** ([repo](https://github.com/inokawa/virtua)) — lightest (~3 kB), auto dynamic height, but no sticky group headers; good for a groupless tail feed.
- **react-window** — do not use for new work.

### Recommendation (list/feed)

Use **react-virtuoso in two configurations:**

1. **Envelope collection list → `GroupedVirtuoso`.** Groups = `type` or `module`. Each row = type-color dot + id/title + `relations:` count badge + `run:` indicator + right-aligned relative timestamp, at comfortable density (32 px, CSS var). Hover-to-reveal checkbox; bottom-anchored action bar. Virtualize even though modules stay under ~2,000 notes — it's a local SPA next to a live session; DOM node count matters.
2. **JSONL log / event feed → `Virtuoso` + `followOutput="smooth"`.** Vercel-style prose rows; click → split-pane raw JSONL in Monaco or `<pre>` (WorkOS pattern); sticky date-bucket headers as virtual items. Unbounded during long sessions — virtualization mandatory.

Don't build your own virtualizer; don't add `cmdk` (command palette, not a list); don't use react-window.

---

## 2. Tables — the baseline

The typed table is the structured complement to the list: it surfaces frontmatter fields as columns and is the natural home for the JSONL/audit view's tabular variant.

### Patterns & design approaches (Mobbin)

**Clay — the gold standard for typed, heterogeneous record tables** ([filter](https://mobbin.com/screens/0f9965b7-d2fa-4baa-bcbc-23dab6413f1c), [sort](https://mobbin.com/screens/e7c75367-216e-4e7e-8293-c1050df07b3f), [column menu](https://mobbin.com/screens/0f37fa10-e008-4c91-b1e8-851d987a16d0), [bulk select](https://mobbin.com/screens/14020139-fdf1-4860-8301-210d0148a649), [all-selected](https://mobbin.com/screens/b0b3ddb8-5bb7-457e-8887-448ab2aa0186)). Shares zuzuu's exact structural problem — a typed store browsed/filtered by field type:

- **Column header = a first-class object.** Click to sort; caret/right-click opens Rename, Edit, Change color, Duplicate, Insert left/right, Sort, Filter, **Pin**, Hide, Delete.
- **Filter model** = floating bar above the body; each rule a three-tuple `field + operator + value`, AND-joined or grouped; field-picker lists fields with their **type icons** (text T, number #, tag, date) — this surfaces the typed schema inline. "Clear filters" appears as a red pill when active.
- **Sort model** = a separate floating panel with draggable rules; never merged with filter.
- **Row selection** = always-visible left checkbox column, "N/N rows selected" top-right, a "Row actions >" button, a bottom bar with a live "Cells running / Stop" badge.
- **Cell types in-cell**: tags as colored pills, URLs as icon+truncated text, numbers right-aligned, person as avatar+name chip. No cell expands inline; click opens a detail pane or inline edit by type.

**Other references:** **Attio** ([sort+filter](https://mobbin.com/screens/3c2d207c-037e-495b-b6c8-50fe3045ed0c)) — richer attribute picker with type icons; "Edit column label" separate from rename (display name ≠ backing field, relevant for frontmatter keys vs labels). **Notion Table** ([filter+sort](https://mobbin.com/screens/9e80b489-cadb-42dd-b321-b2a67d52a3d4)) — column type icons in header; multi-select tag cells as color pills; row click → detail/full-page (not inline edit). **Supabase** ([table editor](https://mobbin.com/screens/21828f4a-4447-4d18-8a83-c8951a1f6a43)) — column headers show the SQL **type annotation** (`id integer`, `product_name varchar`) — excellent for frontmatter keys; explicit "Apply filter" button; explicit pagination; **"Save changes / Discard changes" strip** on edit (the explicit-commit model — prevents accidental writes). **Neon** ([typed table](https://mobbin.com/screens/7cbc954a-958a-4342-bdf9-b4416b9cc9f9)) — type annotations + query time in header. **Retool** ([filter rule](https://mobbin.com/screens/3efdca63-2860-4c0e-a980-64175abc516e)) — `Where [column] [=] [value]`, dense 12 px rows, filter bar folds when empty.

**Audit / JSONL log patterns** — the direct models for `log.mjs`:

- **PlanetScale** ([log](https://mobbin.com/screens/8af442b9-2a21-43a6-a2b5-5b2ff3fbc79d)) — Actor / Action (`verb.noun` as a code-badge, e.g. `branch.enabled_safe_migrations`) / IP / Date; explicit Previous/Next, never infinite scroll for audit.
- **Fibery** ([log diff](https://mobbin.com/screens/8ebb779a-53f5-4ba8-b717-ea5b9cda1017)) — Entity / Event / When / Who / What Changed (diff field names) — densest, most useful for a mutation log.
- **Grok** ([log+chart](https://mobbin.com/screens/f7da7250-5322-4943-aa87-ae4f6626cb42)) — volume sparkline + date-range picker; **monospace truncated Event ID** (how to render content-addressed IDs).
- **Customer.io** ([diff expand](https://mobbin.com/screens/b38ebe97-02ca-4932-95ea-5b959fe8c9b5)) — **expandable rows** showing before/after JSON inline — the single most useful pattern for log entries carrying a `{delta}` payload.
- **Cloudflare** ([log](https://mobbin.com/screens/fa5520ff-fda8-435f-b65b-bf910991fab4)) — sortable Action Time, a "Details" hyperlink per row → suggests a per-row "open in Monaco/detail pane".

**Bulk selection** — two patterns: contextual **bottom bar** (Notion [2-selected](https://mobbin.com/screens/f49ef73e-f5ea-4da3-b785-f9c768aaca1b), ClickUp [3 tasks](https://mobbin.com/screens/e9639493-e0a6-46c9-93d1-d3189cbdc3c7), Pipedrive [side panel](https://mobbin.com/screens/1c70f25d-7816-4204-a257-c5c4309dcb0c)) vs **top-bar transform** (Clay, Mixpanel [2-selected](https://mobbin.com/screens/ff8d9a88-a673-4c00-848a-906504d01225), Deel [bulk edit](https://mobbin.com/screens/3bc65840-9e16-4227-82fa-6068da77bf1b)). For zuzuu, the **bottom bar is lower disruption** to the module view.

### Interaction models & their failure modes

- **Column resize/reorder** — drag border to resize, drag header to reorder; 4–6 px minimum hit target; **persist order+width per-view to localStorage** (the most common omission in custom builds).
- **Frozen/pinned columns** — left-pin identity (`id`, `title`), right-pin actions; *failure mode:* both pins + too-narrow content overlap — enforce a min content width.
- **Sorting** — single-click single sort; multi-column via an explicit "Add sort" rule (more discoverable than Shift+click); always show a sort indicator (+ rank badge when multi).
- **Filtering** — three-tuple with type-dependent operators (text: contains/equals/starts-with; number: `>`/`<`/`=`; date: before/after/is; enum: is/is-not); 0-rows → explicit empty state + "Clear filters".
- **Pagination vs infinite scroll** — explicit pagination for audit/log ("page 2, row 14" is a real need); virtual scroll for collections.
- **Inline editing** — click cell → highlight → type → Enter/Tab confirm → Escape cancel → "Save changes" strip if the store requires explicit commit. **For zuzuu this must route through the gate:** a behavior-bearing edit produces a *pending diff / proposal*, not a silent write.

**Cell types needed for envelopes:** `type` → enum select (knowledge/action/rule/instruction/episode); `id` → read-only monospace stem; `run:` → runnable icon indicator; relation fields → typed link chip (type icon + target id, clickable); `severity` (rules) → colored badge (deny=red, ask=amber, allow=green); `generation` → right-aligned numeric + rollback action; JSONL timestamps → relative/absolute toggle on hover; body preview → truncated, click-to-expand.

### Library options (tables)

- **TanStack Table v8** (headless, MIT, ~15 kB; v9 "Taking Form" is tree-shakable but not yet stable) — opt-in row models for sorting, multi-sort, column-level + global filtering, visibility, ordering, **resizing**, **pinning (left/right)**, row selection, pagination, grouping, expanding, **faceting**. Not built-in: virtualization (pair `@tanstack/react-virtual` ~10 kB), UI/styles (you supply), inline editing (you supply). Typed column defs (`ColumnDef<Note, FieldValue>`) map cleanly onto frontmatter — a `severity` column gets a `SeverityBadge` cell, a relation gets a `TypedLinkChip`. **Best fit.** ([column-pinning](https://tanstack.com/table/v8/docs/api/features/column-pinning), [virtualization](https://tanstack.com/table/v8/docs/guide/virtualization))
- **AG Grid Community** (~298–330 kB, MIT community / **Enterprise $999/dev/yr** for grouping, pivot, server-side, clipboard) — complete out-of-box but **grouping/aggregation is Enterprise-gated**, ~6× TanStack's weight, `ag-theme` CSS fights Tailwind preflight. **Poor fit.**
- **react-data-grid (adazzle)** (~90 kB, MIT) — both-axis virtualization + free Excel copy-paste; **spreadsheet default-editable model fights the gate**; no native grouping. Moderate — useful only for a dedicated bulk-edit mode, not the primary browser.
- **MUI X Data Grid** (~90–120 kB, MIT community; grouping/multi-sort/Excel **Pro-only $180/dev/yr**; drags in MUI theme) — **poor fit**.
- **Glide Data Grid** (~65–80 kB, canvas; lodash/marked peer deps) — native `bubble` (tag-array) cells render `relations:` beautifully, canvas 60 fps at millions of rows, **but no grouping, zero ARIA on canvas cells, last release Feb 2024 (uncertain maintenance)**. Second choice for a read-heavy browser only.
- **Simple Table** (~62 kB, MIT) / **react-datasheet-grid** (~30 kB, MIT, editing-only) / **SVAR React DataGrid** (~80 kB, full MIT, small ecosystem) / **Handsontable** (commercial — **disqualified**).

### Recommendation (tables)

**Build on TanStack Table v8 (migrate to v9 when stable).** Headless is correct for typed envelopes; bundle (~15 kB + ~10 kB virtual + ~20 kB custom cells/filter = ~45–60 kB) fits; MIT is clean. Configure:

- **Envelope collection table:** `id` frozen left (monospace, truncated hash), `type`+`title` next, action column frozen right; resize+reorder persisted per-module to localStorage; thin left-border stripe by `type` (not full background); row click → detail/editor pane; the *one* inline-editable field is title (double-click → Enter triggers the gate flow, not a silent write); relation cells as `[type-icon] [target.id]` chips that navigate.
- **JSONL/log table (read-only):** frozen `generation` (left), `timestamp`+`event_type` (left), `actor` (right); `expandedRowModel` for inline `{delta}` JSON; filter pushed to `log.mjs`/SQLite (don't load all JSONL); virtual scroll, explicit pagination only to anchor a generation's log entry.

Avoid AG Grid, MUI X, Handsontable, and any all-cells-editable-by-default grid.

---

## 3. Advanced tabular UX

Filter builders, grouping with aggregation, saved views, multi-view (table/board/gallery), and bulk-action trays — the "Airtable-grade" layer over the baseline table.

### Patterns & design approaches (Mobbin)

**Airtable — the canonical reference for all five sub-patterns:**

- **Filter builder** ([screen](https://mobbin.com/screens/f7af9d5b-86fc-41a7-be7b-1abb5f2b6122)) — a floating panel; `WHERE [field] [operator] [value]` triples with `+Add condition` / `+Add condition group` (AND/OR nesting); type-aware operators (user-search autocomplete for assignee [screen](https://mobbin.com/screens/8ad972d0-2457-4a91-955b-1411534bbb7c), `contains/does not contain` for text); field-picker with type icons ([screen](https://mobbin.com/screens/df2872f9-f7c3-4a69-a009-e4fd2560b790)); active-filter count badged; **filter state is per-view**.
- **Grouping with aggregation** ([screen](https://mobbin.com/screens/b5911deb-cbca-4ff6-b814-061938163c61)) — rows collapse under group headers with `Count N`; numeric columns auto-show `Sum` at group + table footers; sub-grouping is a distinct `+Add subgroup` (not primary); pivot is an upsell, not inline.
- **Saved views** ([screen](https://mobbin.com/screens/f77b0e84-2ab3-4e98-ab07-9ebc9d00e7d1)) — persistent left sidebar lists views by name+type icon; **Collaborative vs Personal** sections; the **"You've filtered a shared view — create a personal view?" toast** ([screen](https://mobbin.com/screens/e150f74a-ba16-4f6c-91d6-e1c27b0123bb)) is the most user-protective interaction in this space (detects mutation, offers a fork).
- **Multi-view switcher + Kanban** ([screen](https://mobbin.com/screens/6cc34f88-adff-4805-a018-5d4df885eda3)) — `Views` sidebar is the single entry point; creating a Kanban binds a grouping field at creation ([modal](https://mobbin.com/screens/f9d36075-9b8e-40c3-b607-d4efaf5b16ce)).
- **Gallery / image-rich** ([screen](https://mobbin.com/screens/6918427f-c487-4ee9-9643-0fa1f2ad9872)) — thumbnails inline, tag pills as field renderers.

**Notion** — view-type as primary nav: a picker (Table/Board/Chart/List/Timeline/Calendar/Gallery/Feed/Form, each described, [screen](https://mobbin.com/screens/b9686949-9230-4196-a203-33946f07afe3)); view names as editable top tabs ([screen](https://mobbin.com/screens/e3c6d725-1cf0-4c02-99bd-321651646710)); per-column menu `Edit / Change type / Filter / Sort / Group / Calculate / Display as` ([screen](https://mobbin.com/screens/83e2d76e-d836-406f-b72d-d5bc20e1d16f)) — `Calculate` is the aggregation entry.

**Linear** — compact list + **bulk action tray** ([list](https://mobbin.com/screens/d30d5448-25a1-49c5-bd55-61a52f278cec), [tray](https://mobbin.com/screens/be6c4ee4-aa93-42b4-89b3-dcfc8386f022)): on selection a floating bottom bar shows `N selected / [actions]`; the action palette is a command-k modal ([screen](https://mobbin.com/screens/4bb6ca92-8a1b-486a-8858-f51f5eb1cdce)). **Retool** — every table config in a right inspector (row selection mode, row height, empty-state message, row color, [screen](https://mobbin.com/screens/9d79bc14-9681-470d-8f32-6f02fb2de205)); Postgres-typed operator menus ([screen](https://mobbin.com/screens/5157cb1d-eb0b-461b-8aa8-e5062c3f983d)). **Confluence DB** ([screen](https://mobbin.com/screens/5b90695b-ac32-4dbe-a706-503f0de2a6d0)) — minimal saved-view flow with explicit "Save changes / Add as new view". **Canva Spreadsheet** ([screen](https://mobbin.com/screens/a9baaf50-90fc-4c41-84dd-23059e906852)) — status cell type = dropdown of colored labeled options + "Add new option" — the exact shape for the `type` field and `relations` link fields.

### Interaction models & their failure modes

- **Filter builder** — flat AND-only first (covers most cases); add condition groups only on explicit request. *Failure mode:* shipping AND/OR groups day one invites saved-presets + undo + shareable-URL scope creep.
- **Grouping** — cap at **two levels**; offer a "Summarize with pivot" escape hatch. *Failure mode:* unlimited nesting mimics a tree and loses the "this is a table" model.
- **Bulk action tray** — Linear's floating bottom tray beats a permanent toolbar; always show the exact count (ambiguous when groups are partially expanded). The command-palette inside the tray is overkill for zuzuu's small set — a flat action list suffices.
- **Multi-view switcher** — **tab bar (Notion), not a sidebar (Airtable)**: the workbench already has a left panel; a sidebar competes with the file tree and is always visible even for users who never save a view.
- **Saved views** — the "filtered a shared view" fork-toast is less critical for a single-user local tool but applies when modules are shared across sessions.

### Library options (advanced tabular)

- **TanStack Table v8 + Virtual + shadcn/ui cells** — `getGroupedRowModel` + `getExpandedRowModel` give Airtable-style group headers with `sum/min/max/count/mean/median/unique/uniqueCount`; **`getFacetedUniqueValues`** generates the value lists that power multi-select filter inputs (the Airtable filter-by-field UX) — the [shadcn Data Table](https://ui.shadcn.com/docs/components/radix/data-table) + [filters-faceted example](https://tanstack.com/table/latest/docs/framework/react/examples/filters-faceted) are direct templates. No pivot (derive externally + feed transformed data). *Failure mode:* grouping + custom cells + virtual scroll + filter builder compose cleanly but cost ~2–3 days vs ~4 hrs with a batteries-included grid.
- **AG Grid Community** — grouping/aggregation/pivot all **Enterprise-gated** + ~298 kB → **avoid**.
- **Glide Data Grid** — no built-in grouping, canvas a11y gap, uncertain maintenance → second choice for read-only browsing only.
- **react-data-grid / react-datasheet-grid** — good for a "bulk edit frontmatter" spreadsheet mode (both-axis virtualization, copy-paste) but **not** the filter/group/browse surface.
- **MUI X / SVAR** — same tier-gating (MUI) or small-ecosystem (SVAR) caveats as above.

### Recommendation (advanced tabular)

**TanStack Table v8 + TanStack Virtual + shadcn/ui cell renderers**, mapped to zuzuu:

1. `type` column → colored badge pills (custom `cell`).
2. `relations` column → inline chip list (link icon + target id) — Glide's `bubble` is prettier but carries canvas tradeoffs.
3. **Group-by module** → `getGroupedRowModel` with `count` → "how many notes per module" at a glance.
4. **Faceted filter** → `getFacetedUniqueValues` for `type`/`module` multi-selects (no separate index step).
5. Generation/JSONL audit → a *separate, simpler* component (don't over-apply TanStack); it's a tail, not a grouped collection.
6. **Multi-view: Table + Board** — Board (Kanban by `type`/`module`) is a second component reading the **same** filtered/grouped row model; switcher = tab bar above content (Notion).
7. **Bulk tray** — Linear floating bottom bar `N selected · [Approve] [Reject] [Move to module] [Delete]`, wiring Approve/Reject onto the `review approve|reject` verb.

Suggested build order: cell renderers (~1d) → group-by-module + count (~0.5d) → faceted filter bar (~1d) → saved views (localStorage `{filters, grouping, sorting, columnVisibility}` + tab switcher) (~1d) → bulk tray (~0.5d) → Board view (~1d, later milestone). Bundle math: ~45 kB added — acceptable alongside Monaco + xterm.js.

---

## 4. Force-directed graph views

The typed link graph (envelopes + `relations:` + backlinks) is the workbench's missing collection-as-graph surface.

### Patterns & design approaches (Mobbin)

- **Reflect "Map"** ([1](https://mobbin.com/screens/369d3c78-3a65-4b32-909b-7c15bea1c68c), [2](https://mobbin.com/screens/bcf9fd6e-05ba-4fef-ab8b-6a61d3b86d5d), [3](https://mobbin.com/screens/0e1be504-3f40-4cd2-8968-091212a155e5), [4](https://mobbin.com/screens/62c28391-8e90-465e-a8b5-a5db7ca629a2)) — **the closest analogue.** Nodes colored by *type*; **radius scales with degree** (backlink count); sidebar list + graph coexist; click → inline popover with frontmatter fields; **Filters panel** (Type/Access/"Show unlinked"/"Show blank") maps to filtering by `type:`; sparse + breathable at 20–30 nodes; disconnected components float freely (honest orphan representation).
- **Profound — Citation Relationships** ([1](https://mobbin.com/screens/21a2e59b-2a5d-4c15-89a8-400021367d8c), [2](https://mobbin.com/screens/2208a78b-e153-4a3a-ab4d-83e0bfa1fbd4)) — the dense end (200–400 nodes, pastel cluster halos, 2D/3D toggle); a ceiling design beyond immediate need.
- **Twingate — Access Graph** ([1](https://mobbin.com/screens/e936e96e-ccc9-45a6-8e1f-18e78d308cac), [2](https://mobbin.com/screens/e7653a89-2222-4691-9518-7de7aea347c8)) — **"Graph Focused on X"** narrows to a node's ego network with a Cancel to restore; the right mental model for "show notes related to this module." In-canvas zoom/fit.
- **Clay — Workflow graph** ([1](https://mobbin.com/screens/0246837b-55b6-4fc4-9806-a5884b8dc4ca), [2](https://mobbin.com/screens/2f13aad9-0501-40f4-9831-6574fcfa5c7d)) — DAG of rich node cards; right-click "Sources/Hide/Delete"; click → right detail panel. Maps to runnable `type: action` notes (show `run:`, `relations:`, status in a side panel).
- **Causal — Model Map** ([screen](https://mobbin.com/screens/326201b9-be93-4a3a-a3b4-c80ca911a52c)) — **faint grey bounding boxes cluster related nodes** (typed regions as a background rect, not a node) → module membership without clutter.
- **Fibery** ([1](https://mobbin.com/screens/dcce4f94-bdb8-4b33-9f54-863362dc7467), [2](https://mobbin.com/screens/0faf78da-f474-4e06-9f9f-c08ff615389d)) — two modes: force-directed Workspace Map + whiteboard "Connections" with **typed edge labels** (critical for `depends-on` vs `extends`).
- **NotebookLM** ([screen](https://mobbin.com/screens/fcd21c07-9d12-446c-9d1e-3f65fac0766f)) — under ~10 nodes, a **radial tree** beats a physics sim (a fallback-layout threshold matters).
- **WRITER — Blueprints** ([1](https://mobbin.com/screens/39cd0c63-a965-4b59-ad49-039a5968a19d), [2](https://mobbin.com/screens/7bb09b9c-de27-4a19-8183-36df6bb26afc)) — rich node cards with ports; click → full right-panel form editor (gold standard for the runnable-note view: click → frontmatter editor + run button).

### Interaction models & their failure modes

1. **Ego-network focus** (Twingate/Reflect) — click → dim non-neighbors to ~15% opacity. *Failure mode:* re-running the sim on a filtered graph jumps the layout; *fix:* keep all nodes in the sim, change opacity in the render pass only.
2. **Hover tooltip vs click-to-panel** — don't conflate; **8 px minimum hit target** even with a 4 px visual circle (invisible hit-area overlay mandatory).
3. **Filter bar outside the canvas** (Reflect) — prevents in-canvas widgets being occluded during zoom/pan.
4. **Node sizing by backlink count** — `r = base + sqrt(degree) * k` (sqrt is the sweet spot). *Failure mode:* a new brain with few links → uniform dots; add a min radius + a ring-color orphan indicator (the gap the `check` verb already surfaces).
5. **Sticky node drag** — `node.fx = node.x; node.fy = node.y` on drag-end; double-click to unpin. Without it the sim swallows manual arrangement.
6. **Zoom-to-fit on load** (~10% padding) + zoom/fit/reset controls — without it, sparse graphs show blank canvas, dense ones are illegible.
7. **Edge type color coding** (Fibery/Causal) with a legend; edge labels on hover / high zoom only.

### Library options (force-directed)

| Approach | Practical node limit | Bundle | React fit | Effort |
|---|---|---|---|---|
| D3-force + SVG (manual) | ~500 | ~15 kB | Medium | Medium |
| **react-force-graph-2d** (Canvas) | ~5,000 | ~150–200 kB (~60–90 kB w/ peer dep present) | **High** | **Low** |
| react-force-graph-3d (WebGL/Three.js) | ~10,000+ | ~800 kB–1 MB | High | Low |
| Sigma.js v3 + @react-sigma (WebGL) | ~50,000+ | ~350–450 kB | Med-High | Medium |
| Cytoscape.js + react-cytoscapejs | ~5,000 | ~400 kB | Medium | Medium |
| Raw WebGL (regl) | Unlimited | 5–15 kB | Low | Very high |

- **react-force-graph-2d** ([repo](https://github.com/vasturiano/react-force-graph), MIT, ~6.2k stars, ships TS types) — Canvas (pauses redraws when sim halts); `nodeCanvasObject` gives a raw canvas context per node (type colors + generation rings), `nodeVal` for degree-sizing, `linkDirectionalArrowLength` for directed edges, `onNodeClick`/`onNodeHover`. No built-in clustering/legend/filter (compose externally). **Default choice.**
- **Sigma.js v3 + graphology + @react-sigma** (MIT, ~12k stars) — WebGL; **ForceAtlas2 in a WebWorker** (won't block Monaco — the key scale advantage); graphology gives typed `Graph<NodeAttrs, EdgeAttrs>` + algorithms (Louvain community detection). Custom node shapes need the WebGL programs API (lower-level). **The scale-up target** (~2,000+ notes).
- **D3-force raw** (ISC, ~15 kB) — physics only, BYO renderer (what Obsidian uses); SVG degrades ~500–800 nodes (DOM + conflicts with Monaco's heavy DOM in the same pane). Only for a fully custom visual language.
- **Cytoscape.js** (MIT) — richest algorithm library but main-thread layout + ~400 kB; overbuilt for visual exploration. **Hold** until centrality/pathfinding becomes a feature.
- **vis-network** (Apache-2.0/MIT) — effectively unmaintained → **avoid**.
- **Edge bundling** — D3 hierarchical bundling (`d3-hierarchy` + `d3.curveBundle`, ~5 kB) for cross-module spaghetti; not day-one.

### Recommendation (force-directed)

**Phase 1 (0–2,000 envelopes): `react-force-graph-2d`.** Install the 2D-only package, not the monorepo. Draw nodes in `nodeCanvasObject` with type colors (knowledge=blue/teal, action=orange/amber, rule=red, instruction=green/purple, episode=grey) + a generation-ring; `linkDirectionalArrowLength: 6`; `nodeVal` = backlink count. Build on top: filter bar *outside* the canvas (type/module/runnable-only/pinned-only); ego-focus via opacity in render callbacks (no re-filter); module convex-hull background via `d3-polygon` (Causal pattern); sticky drag; `zoomToFit(400)` on load + zoom controls.

**Phase 2 (2,000+ or layout blockage): migrate to graphology + sigma.js v3 + @react-sigma**, ForceAtlas2 in a WebWorker. The graphology data model (each envelope = a node with `{type, module, generation, runnable}` attrs; each `relations:` entry = a typed edge) makes this a data-model swap, not a UI rebuild.

Avoid 3D/Three.js, Cytoscape, raw D3+SVG, vis-network.

---

## 5. Obsidian-style knowledge graphs

The note-graph idiom specifically (global vs local graph, depth control, backlinks, groups-by-search) — a refinement of §4 toward the "personal knowledge base" UX.

### Patterns & design approaches

- **Reflect** ([global+hover](https://mobbin.com/screens/62c28391-8e90-465e-a8b5-a5db7ca629a2), [filter dropdown](https://mobbin.com/screens/bcf9fd6e-05ba-4fef-ab8b-6a61d3b86d5d), [hover tooltip](https://mobbin.com/screens/0e1be504-3f40-4cd2-8968-091212a155e5), [backlinks panel](https://mobbin.com/screens/9d0db79a-cef1-4b10-b7c6-a06ba916c0d6)) — dark canvas; **≤5 hues** for type (stays readable); node size = link count; hover-focus dims to immediate neighbors; **filter panel opens *over* the canvas** (not a permanent sidebar); **labels on hover/zoom only** (solves label clutter); click navigates to the note (graph is read-only); **backlinks panel** in the note view ("Incoming backlinks (1)", collapsed, shows the containing sentence) — the text-mode complement, both needed.
- **Obsidian** (canonical, docs not Mobbin) — **Global vs Local graph** (local = notes connected to the open note, **depth slider 1–6**); filter panel (search, tags, attachments, existing-only, **orphans** toggle); display controls (node size, link thickness, **text fade threshold**, arrows, animate); **Groups** = search-based coloring rules (`tag:#action → orange`); hover highlights neighbors. *Documented failure modes:* global graph is an unreadable hairball past ~300 notes (no spatial clustering out of the box); sim never fully stabilizes in large vaults (pin nodes); no in-note local-graph banner by default.
- **Twingate Access Graph** ([1](https://mobbin.com/screens/59d446f8-3d51-4835-abd8-48632e9deaee), [3](https://mobbin.com/screens/74244329-d559-4c01-9e7e-2af421485d04)) — **"start with one node, grow outward"** (default shows only the focused entity + edges; "Add Filter" search-and-add) — avoids the hairball entirely; the model for zuzuu local-graph expansion. Click → right detail panel (frontmatter without navigating away).
- **Profound** ([2D at scale](https://mobbin.com/screens/fa73c906-5d35-4a43-92fb-aac702362e47), [3D](https://mobbin.com/screens/2208a78b-e153-4a3a-ab4d-83e0bfa1fbd4)) — at ~13k nodes the 2D view hairballs even with colored clusters; node-size-by-degree is the only thing keeping it partly readable → at scale, global graph *needs* mandatory clustering.
- **Fibery** ([workspace map](https://mobbin.com/screens/c8802ed3-80a8-4af0-986b-2a5fe00996c3)) — box-and-arrow for small structured graphs (5–20 nodes) vs force-layout for large exploratory ones — zuzuu needs both modes.

### Interaction models & their failure modes

- **Hover-focus** — dim non-adjacent to ~15–20%; **add a 100–150 ms debounce + ~200 ms opacity ease** (avoids flicker on fast cursor moves).
- **Local graph with depth control** — the single most impactful control. **Compute BFS reachability once on open, cache per depth; hide/show, don't re-simulate.** *Failure mode:* re-running the sim per slider tick causes jarring jumps.
- **Click-to-navigate vs click-to-expand** — for the workbench prefer **click → in-panel detail** (type chip, frontmatter, body snippet, in/out link counts) with full edit going to Monaco — keeps the user in graph context.
- **Global vs local toggle** — global defaults to modules-as-clusters; local defaults to depth 1. *Failure mode:* showing global first in a sparse/empty vault is a bad first impression → if `notes < 5` or `links < 3`, show a "not enough data yet" empty state with a CTA.
- **Filter panel** — overlay (Reflect), not a permanent sidebar, for a lean SPA. Controls: type checkboxes, module dropdown, generation filter, relation-type filter, orphan toggle, depth slider (local only).
- **Empty/loading** — animated skeleton circles (set spatial expectation), **complete the initial sim before rendering** (avoid the Obsidian "explosion from center"), and a 3-node knowledge/action/rule example for new vaults.

### Library options & market signals

Same library set as §4 — **react-force-graph-2d** for the build, **sigma.js + graphology** for scale. Market signals reinforce this: Obsidian's graph is *beautiful but underused* (open for wonder, close because it doesn't help navigation) — so **make zuzuu's graph actionable** ("what does this envelope connect to?", "where's the gap in this module?"), not decorative. Logseq's graph (Clojure overhead) was outperformed by a community **Sigma.js** replacement → Sigma is the production renderer at scale. Foam (VSCode, MIT, [`features/graph.ts`](https://github.com/foambubble/foam)) is a clean minimal D3-force webview reference. react-force-graph (~5.5k stars) is the de-facto React default.

### Recommendation (knowledge graph)

**`react-force-graph-2d` now; Sigma.js + graphology past ~300 routine nodes.** Concrete spec: one `<EnvelopeGraph mode="global"|"local" noteId depth>` component; **circle nodes** (not rects) with a 2 px type-color ring, `r = 6 + 2*sqrt(linkCount)`; labels via `nodeCanvasObject` only when `zoom > 1.5` or hovered (truncate ~24 chars); overlay filter toolbar (5 type checkboxes, module dropdown, orphan toggle, depth slider in local mode); hover sets `focusedNode` → dim non-adjacent to 0.15; click → navigate (local) or slide-in right panel (global); empty state if `nodes < 4` (static 3-node illustration before mounting the sim); `cooldownTicks=200 cooldownTime=5000`, drag disabled by default (knowledge graph ≠ diagram editor); optional generation-brightness encoding (latest gen full, rolled-back dimmed). **Keep the JSONL/event log a separate chronological list/table — never represent time-series in a spatial layout.** Vite code-splits the graph into a lazy chunk (CLI core untouched). Avoid 3D, Cytoscape, vis-network, and any shared graph+Monaco canvas.

---

## 6. The envelope detail / card view

The single-envelope surface: structured frontmatter + rich markdown body + typed relations + the `run:` action — the workbench's missing "specialized envelope visualization."

### Patterns & design approaches (Mobbin)

- **Linear — properties-right, body-left (the strongest reference):** a fixed **right-rail Properties panel** (120–180 px) of labeled icon+value rows (each field a distinct typographic unit, never a frontmatter "table"); the **left/center column owns the body** (title + markdown), max ~720 px reading width; **body and properties scroll independently**; properties are glanceable. ([detail](https://mobbin.com/screens/df252929-8c5b-481c-b9da-a0d08ea617cb), [fixed-rail](https://mobbin.com/screens/a1954b56-e8dd-4b8a-9a4d-1e8d989af7e0), [doc + rich body](https://mobbin.com/screens/c2cbaff3-1a8d-4fd4-af9a-c5c31533082c))
- **Notion — inline-header variant** ([1](https://mobbin.com/screens/934e02a4-fcd6-493f-af77-ee566e700c2a), [2](https://mobbin.com/screens/f95a2e7f-f556-48b2-9e76-e49523584df7)) — properties inline below the title with a "show N more" collapse. Works for long-prose `knowledge` envelopes; top-heavy for short `action`/`rule` notes → reserve for substantive bodies.
- **Jira / Customer.io — tab-switcher** ([Jira](https://mobbin.com/screens/8c62f591-194a-4e6d-a033-c096fe7886a5), [Customer.io](https://mobbin.com/screens/a4908591-f45a-4e31-a82c-a9fb89a9211f)) — Details/Comments/History/Related tabs. Good when relations/activity rival the body; for body-primary envelopes, prefer inline relations + a badge-counted Relations tab.
- **Typed relation chips** ([Plane](https://mobbin.com/screens/acb49906-5e78-45fc-b820-75354c74c2e0), [Jira linked-by-type](https://mobbin.com/screens/baf75577-93e3-4fc4-bf34-de4c7764ad07), [Salesforce grouped](https://mobbin.com/screens/ae6cdc4a-5b08-4d00-980f-67926330e35c)) — relations grouped **by type** (`depends-on` / `uses` / `overrides` / `implements`), each a labeled group not a flat list; each chip clickable (navigate to target), showing the target's `type` by icon/color.
- **Backlinks (Obsidian-native)** — inbound refs grouped by source with the surrounding sentence; **distinct from forward-relations**: outlinks are author-declared frontmatter (→ properties rail), backlinks are computed at render (→ a separate collapsible section at the body's bottom). Don't mix them (confuses intentional vs discovered).
- **Run field as action button** ([Codecademy Run](https://mobbin.com/screens/585c73a4-2e7e-4664-a51f-0c9b305a65a7), [Grok code header](https://mobbin.com/screens/660dc67c-5780-4404-970a-6b06ec2b3d00)) — `run:` is a single shell command in *frontmatter*, not the body → render it as a **dedicated action bar** below the properties: a read-only code chip + a `Run` button + an expandable output pane (`{stdout, stderr, exit}`, dismissible), gated through `act.mjs`. Do **not** render it as an inline body code block.

### Interaction models & their failure modes

1. **Inline property editing** (Linear/Notion) — click a value → in-place popover; auto-save + undo toast (not a confirm button). *Failure mode:* silent loss on blur with no undo.
2. **Relation navigation** — every chip is a link (hover preview = title + type chip + first 2–3 properties). *Failure mode:* labels that look interactive but open nothing break the whole "typed link graph" value prop.
3. **Backlinks computed async** (from `index.mjs`, rebuilt on mtime-staleness) — show "Computing backlinks…" while in flight + an empty/"Build index" state. *Failure mode:* a blank backlinks section looks broken.
4. **Run-button safety** — the `run:` field executes shell; use a terminal icon or the word "Run" (a play-triangle is ambiguous); confirm the first time (or always for `type: rule`); output pane dismissible, must not overflow into properties. *Failure mode:* long stdout floods the layout.
5. **Rail collapse at small widths** — below ~900 px the rail collapses to a header strip (top-3 properties + "N more" drawer). *Failure mode:* the rail squeezes the body too narrow to read.

### Library options (detail/card)

**YAML frontmatter** — already parsed in `notes/note.mjs`; pass the structured object as props from the Hono endpoint. Don't client-side-parse frontmatter. (`gray-matter` ~8 kB / `front-matter` ~3 kB / `remark-frontmatter` exist, but the substrate already splits it tolerantly.)

**Markdown body** — **`react-markdown` (~4.6 kB) + `remark-gfm` (~1 kB)** ([react-markdown](https://github.com/remarkjs/react-markdown), [remark-gfm](https://github.com/remarkjs/remark-gfm)): ~6 kB, XSS-safe (renders React elements, no `dangerouslySetInnerHTML`), `components` prop lets you override `a` (intercept `note:id`/`[[wikilink]]` → workbench nav) and `code` (→ highlighter). `marked`/`markdown-it` produce HTML strings needing sanitization → skip.

**Syntax highlighting** — **`react-shiki` (~12 kB core, grammars lazy-loaded)** for highest-quality (VS Code TextMate grammars); load only `bash/yaml/typescript/javascript/python`; gate behind `React.lazy`, `<pre>` fallback. **Counter-argument (preferred if available):** if `@monaco-editor/react` is already in `web/`'s `optionalDependencies`, reuse a read-only Monaco instance (`readOnly`, `minimap:false`, `lineNumbers:off`) and skip Shiki entirely — **check the bundle first.** (Prism via react-syntax-highlighter ~70–80 kB; highlight.js awkward in React → both heavier.)

**Property chips / relation chips** — **no library**; a bespoke `PropertyRow` (`{icon, label, value, type}` where `type` drives `"text"/"chip"/"link"/"date"/"boolean"`) (~80 lines) and a typed relation chip grouped by `type`. Form libraries / "properties-panel" npm packages carry opinionated styling that fights the workbench tokens.

### Recommendation (detail/card)

**`<EnvelopeDetail>` as a two-panel Linear split.** Left (scrollable, ≤720 px): title (editable-on-click only in Monaco edit mode) → **Run bar** (only if `run:` present; read-only command chip + Run + expandable output, via `act.mjs`) → body (`react-markdown` + `remark-gfm` + Shiki-or-Monaco for code) → **Backlinks** ("Referenced by", computed via `query`, flat chip list, separate from forward-relations). Right rail (fixed ~180 px): **`type` badge** at top (color-coded) → `id` (monospace, copy-on-click) → `module` (navigable) → remaining frontmatter as `PropertyRow`s (**render unknown/custom keys as plain text — the "unknown keys preserved round-trip-exact" invariant must be visible**) → **Relations grouped by type** → **Generations row** (`current generation N` + rollback dropdown wired to `zz module <m> rollback <n>`).

Avoid: rendering raw frontmatter YAML as a top-of-body code block (that's `cat`, not a workbench); a WYSIWYG editor (TipTap/ProseMirror) — display is read-only rendered markdown, edit opens Monaco; "properties-panel" libraries / React Hook Form for 8–12 rows; bundling all Shiki grammars. **Target: under ~30 kB gzip incremental** (react-markdown ~4.6 + remark-gfm ~1 + react-shiki core ~12 + bespoke chips/rows ~3–5, grammars lazy).

---

## Consolidated recommendations table

| Surface | Pattern verdict | Library verdict (lean Vite+React+TS) | Why |
|---|---|---|---|
| **Envelope list / feed** | Linear rows: ~32 px, type-as-left-dot, sticky collapsible group headers, hover checkbox, bottom action tray | **`react-virtuoso` `GroupedVirtuoso`** (~17 kB, MIT) | Built-in sticky group headers + counts + dynamic heights; no DIY scroll math |
| **JSONL / event log feed** | Vercel prose rows + WorkOS split-pane JSON + sticky date headers; live tail | **`react-virtuoso` `Virtuoso` + `followOutput`** (MIT) | `followOutput` solves tail-pinning that TanStack Virtual makes you build by hand |
| **Typed table (collection)** | Clay: type-icon columns, pin id-left/actions-right, three-tuple filter, type cell renderers | **TanStack Table v8 + `@tanstack/react-virtual`** (~25 kB, MIT) | Headless typed `ColumnDef` maps 1:1 to frontmatter; per-field cell renderers; column pinning stable in v8 |
| **Advanced tabular (filter/group/views)** | Airtable filter builder (flat AND first) + 2-level grouping + Notion tab switcher + Linear bulk tray | **TanStack `getGroupedRowModel` / `getExpandedRowModel` / `getFacetedUniqueValues` + shadcn/ui cells** | Faceted values power multi-select filters for free; grouping+aggregation built-in; no Enterprise gate |
| **Audit / mutation log table** | PlanetScale `verb.noun` badges + Customer.io expandable diff rows + explicit pagination | **TanStack Table read-only + `expandedRowModel`**, filter pushed to `log.mjs`/SQLite | Inline `{delta}` diff; SQLite-side filtering avoids loading all JSONL |
| **Force-directed graph** | Reflect: type-color nodes, sqrt-degree sizing, overlay filter, hover-focus, sticky drag, zoom-to-fit | **`react-force-graph-2d`** (~60–90 kB w/ d3 present, MIT) — **Phase 1** | Canvas fine to ~5k nodes; `nodeCanvasObject` raw context for type rings + generation rings; React-native API |
| **Graph at scale (>2k nodes)** | Sigma typed-graph + WebWorker layout, module clustering | **`sigma.js` v3 + `graphology` + `@react-sigma`** (~350–450 kB, MIT) — **Phase 2** | ForceAtlas2 off-main-thread won't block Monaco; graphology = the typed-link-graph data model; data-model swap, not UI rebuild |
| **Knowledge-graph idiom** | Global vs local + depth slider (cache BFS, don't re-sim), backlinks separate, actionable-not-decorative | Same as force-directed (react-force-graph-2d → sigma) | Obsidian/Logseq lesson: make it answer "what connects?", not just look pretty |
| **Envelope detail / card** | Linear properties-right / body-left split; run-as-action-bar; relations grouped by type; backlinks separate | **`react-markdown` + `remark-gfm`** (~6 kB) + **`react-shiki` lazy OR reuse Monaco**; bespoke `PropertyRow`/chips | XSS-safe React-element rendering; reuse Monaco if already bundled to drop Shiki; ~30 kB incremental cap |
| **Bulk actions (all surfaces)** | Floating bottom tray `N selected · [Approve][Reject]…`, exact count | App-level (~React state) wired to `review approve\|reject` | The gate is the moat — bulk approve/reject IS the review verb surfaced in UI |
| **Inline edit (gate-bearing fields)** | Edited cell → amber → "Propose" → queues a proposal | App-level, **not** an auto-save grid | Behavior-bearing edits must enter `propose → review`, never silent writes |
| **Avoid** | — | AG Grid (298 kB + Enterprise grouping), MUI X (Pro grouping + MUI theme), Handsontable (commercial), vis-network (unmaintained), react-window (maintenance mode), 3D/Three.js (~800 kB), Cytoscape (algorithm weight, no payoff yet) | Bundle weight, license cleanliness, or maintenance — all direct conflicts with the `optionalDependencies` + MIT-OSS posture |

---

## Open questions / decisions for the build phase

1. **Is `@monaco-editor/react` already in `web/`'s `optionalDependencies`?** If yes, reuse a read-only Monaco instance for code/`run:` highlighting and **drop `react-shiki` entirely** (~12 kB + grammar saved). This is the single biggest bundle decision in the detail view — resolve it before writing `<EnvelopeDetail>`.

2. **One shared filtered/grouped data model across Table + Board + Graph, or per-surface?** TanStack's row model can feed the Board view directly; the graph reads the same `{nodes, links}`. Decide whether a single `useCollectionView({filters, grouping, sorting})` hook backs all three (recommended) — this determines how saved views (localStorage `{filters, grouping, sorting, columnVisibility}`) are scoped.

3. **How does inline edit physically enter the gate?** The edited-cell → "Propose" → proposal-queue flow needs a concrete contract with `grow/propose.mjs` and `grow/review.mjs`. What does the workbench POST, and does the proposal carry the cell-level diff or a whole-note diff? This is the load-bearing semantic divergence from every spreadsheet reference.

4. **Backlinks source + latency.** Confirm the workbench reads backlinks via the `query` verb / `index.mjs` and define the "index not yet built / stale" UX (the "Computing backlinks…" + "Build index" states). Does the Hono daemon expose a backlinks endpoint, or does the client call `query` and walk the graph?

5. **Graph scale trigger — auto or manual?** Define the concrete threshold (node count? observed layout-block?) and whether the react-force-graph-2d → sigma migration is a silent auto-swap or a user/setting toggle. The graphology data model should be adopted *now* even on the 2D renderer to make the future swap a no-op.

6. **Audit log: pagination vs virtual scroll per view.** The collection list is virtual scroll; the generation/audit log wants explicit pagination only where "anchor to a known generation's log entry" is needed. Decide which log surfaces get page controls vs tail-scroll.

7. **Density modes — ship now or later?** Compact/comfortable/spacious as a CSS-var preference is cheap (~1 setting) but adds a settings surface. Decide if it's in the first cut or deferred.

8. **Empty-state copy + the new-vault graph example.** Concrete strings ("No envelopes yet. Run `zz observe` or approve a proposal to grow this module.") and the 3-node knowledge/action/rule illustration need design sign-off — they're the first-run impression for a tool whose vault starts nearly empty.

9. **Lazy-loading boundaries.** Confirm Vite code-splits the graph view, Monaco, and (if used) Shiki into chunks loaded only when their surface opens, so the workbench's initial bundle — and the zero-dep CLI core — stay untouched.

---

## Appendix — sources

**Library comparisons & docs.** [TanStack Virtual vs react-window vs react-virtuoso 2026 (PkgPulse)](https://www.pkgpulse.com/guides/tanstack-virtual-vs-react-window-vs-react-virtuoso-2026) · [react-virtuoso](https://github.com/petyosi/react-virtuoso) / [virtuoso.dev](https://virtuoso.dev/) · [TanStack Virtual](https://tanstack.com/virtual/latest) · [virtua](https://github.com/inokawa/virtua) · [TanStack Table vs AG Grid (Simple Table)](https://www.simple-table.com/blog/tanstack-table-vs-ag-grid-comparison) · [TanStack Table vs AG Grid vs react-data-grid 2026 (PkgPulse)](https://www.pkgpulse.com/guides/tanstack-table-vs-ag-grid-vs-react-data-grid-2026) · [React Data Grid bundle sizes (Simple Table)](https://www.simple-table.com/blog/react-data-grid-bundle-size-comparison) · [TanStack Table v9: Taking Form](https://tanstack.com/blog/tanstack-table-v9-taking-form) · [Column Pinning v8](https://tanstack.com/table/v8/docs/api/features/column-pinning) · [Virtualization v8](https://tanstack.com/table/v8/docs/guide/virtualization) · [Column Faceting v8](https://tanstack.com/table/v8/docs/guide/column-faceting) · [filters-faceted example](https://tanstack.com/table/latest/docs/framework/react/examples/filters-faceted) · [shadcn/ui Data Table](https://ui.shadcn.com/docs/components/radix/data-table) · [Top OSS AG Grid alternatives (SVAR)](https://svar.dev/blog/top-react-alternatives-to-ag-grid/) · [Glide Data Grid](https://github.com/glideapps/glide-data-grid) · [adazzle react-data-grid](https://github.com/adazzle/react-data-grid) · [react-datasheet-grid](https://react-datasheet-grid.netlify.app/docs/features/).

**Graph libraries.** [react-force-graph (vasturiano)](https://github.com/vasturiano/react-force-graph) · [Cytoscape vs vis-network vs Sigma 2026 (PkgPulse)](https://www.pkgpulse.com/guides/cytoscape-vs-vis-network-vs-sigma-graph-visualization-2026) · [sigmajs.org](https://www.sigmajs.org/) · [Sigma.js v3 release (OuestWare)](https://www.ouestware.com/2024/03/21/sigma-js-3-0-en/) · [Sigma + React walkthrough (William Lyon)](https://lyonwj.com/blog/sigma-react-graph-visualization) · [@react-sigma docs](https://sim51.github.io/react-sigma/docs/api/) · [react-force-graph perf issue #202](https://github.com/vasturiano/react-force-graph/issues/202) · [Hierarchical Edge Bundling (React Graph Gallery)](https://www.react-graph-gallery.com/hierarchical-edge-bundling) · [Obsidian graph view docs](https://obsidian.md/help/plugins/graph) · [Obsidian graph physics forum](https://forum.obsidian.md/t/graph-view-physics-and-force-directed-graphs/72586) · [Foam (foambubble)](https://github.com/foambubble/foam) · [JS graph viz library comparison (Cylynx)](https://www.cylynx.io/blog/a-comparison-of-javascript-graph-network-visualisation-libraries/).

**Markdown / frontmatter / highlighting.** [react-markdown](https://github.com/remarkjs/react-markdown) · [remark-gfm](https://github.com/remarkjs/remark-gfm) · [react-shiki](https://github.com/avgvstvs96/react-shiki) · [Shiki vs Prism vs highlight.js 2026 (PkgPulse)](https://www.pkgpulse.com/guides/shiki-vs-prismjs-vs-highlightjs-syntax-highlighting-2026) · [Comparing web code highlighters (chsm.dev)](https://chsm.dev/blog/2025/01/08/comparing-web-code-highlighters) · [gray-matter](https://github.com/jonschlinkert/gray-matter) · [front-matter vs gray-matter (npm-compare)](https://npm-compare.com/front-matter,gray-matter,yaml-front-matter) · [markdown-it vs react-markdown (npm-compare)](https://npm-compare.com/markdown-it,react-markdown) · [React Markdown guide (Strapi)](https://strapi.io/blog/react-markdown-complete-guide-security-styling).

**Mobbin screens** are linked inline throughout sections 1–6. Key references by app: **Linear** (list density, bulk tray, detail split), **Clay** (typed table, bulk select), **Airtable** (filter builder, grouping, saved views, multi-view), **Reflect** (knowledge-graph map, backlinks), **Twingate** (ego-network/grow-outward graph), **Notion** (group-by, view tabs, inline-header detail), **Vercel/WorkOS/Fibery/PlanetScale/Customer.io/Cloudflare/Grok** (log + audit-trail patterns), **Plane/Jira/Salesforce** (typed relation chips), **Codecademy/Grok** (run-as-action-bar).
