# 06 · CRUD-to-App Inspiration — Prior Art for the Project-as-Database Workbench

> **Framing.** This document is the synthesized inspiration shelf for zuzuu's **locked** web workbench — a CRUD-to-app admin over a *Project-as-database*. It surveys open-source CRUD frameworks, Airtable-likes, headless-CMS schema builders, internal-tool platforms, and DB studios, and distills every borrowable pattern into a single **BORROW / ADAPT / AVOID** map keyed to our surfaces.
>
> The design is **locked** — see [`05-experience-spec.md`](./05-experience-spec.md) for the two-world model (Work + Brain) and the review-gate behavior. The library/runtime constraints are in [`03-js-library-landscape.md`](./03-js-library-landscape.md). This doc does **not** relitigate those decisions; it feeds the build phase with proven patterns and explicit license/architecture guardrails.
>
> **The mental model this whole survey assumes** (our locked vocabulary, restated for the inspiration lens):
> - **module = table** · **note (markdown + YAML frontmatter "envelope") = row** · **frontmatter key = typed column** · **`relations:` = foreign keys / a link graph**
> - **Two worlds:** *Work* (a live agent session + a **review gate** that teaches) and *Brain* (the database app: tables → grid + views + filter-chips → the envelope record side panel → ER graph → audit).
> - **Hard constraints that gate every borrow:** a **LEAN Vite + React + TS SPA** (bundle + MIT-ish license discipline); the query engine is the **existing `node:sqlite`** (FTS5 + recursive-CTE) over the files — **no new engine**; **every write goes through a human REVIEW GATE** (the daemon shells the gated `zz` CLI — the single write door; the browser never writes directly); schema **GRADUATES** (modules born schemaless → promote to a typed table → split), so we need a field/keys registry + schema-to-FORM generation; it is **FILE-NATIVE + git-backed + LOCAL-first** (no multi-tenant SaaS backend).

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [The Master BORROW / ADAPT / AVOID Table](#the-master-borrow--adapt--avoid-table)
3. [Section A — Refine.dev: the reference data-provider architecture](#section-a--refinedev-the-reference-data-provider-architecture)
4. [Section B — DB-as-app: the open-source Airtable-likes](#section-b--db-as-app-the-open-source-airtable-likes)
5. [Section C — Headless-CMS schema & field-type builders](#section-c--headless-cms-schema--field-type-builders)
6. [Section D — Internal-tool platforms & DB studios](#section-d--internal-tool-platforms--db-studios)
7. [Section E — Cross-cutting architecture patterns (the data-provider seam)](#section-e--cross-cutting-architecture-patterns-the-data-provider-seam)
8. [The data-provider + schema-to-form architecture we should adopt](#the-data-provider--schema-to-form-architecture-we-should-adopt)
9. [Open questions for the build phase](#open-questions-for-the-build-phase)
10. [Consolidated source index](#consolidated-source-index)

---

## Executive Summary

Across ~20 open-source projects in five families, the prior art converges on **two architectural primitives** that map cleanly onto zuzuu's locked design:

1. **The data-provider seam** (Refine, react-admin, AdminJS) — a small, backend-agnostic CRUD interface (`getList / getOne / create / update / deleteOne` + `getMany` for relation batching) that decouples every grid/form/hook from the backend protocol. For zuzuu this is **the moat**: implement it once against the daemon, which shells the gated `zz` CLI, and every grid, form, and filter chip works for free over our file-native, SQLite-backed, gated store.

2. **The field-type registry → schema-to-form generator** (Baserow, Rowy, Directus, Payload, PocketBase) — a single per-field-type definition that drives *three surfaces simultaneously*: the grid cell renderer, the record side-panel editor, and the schema-graduation/diff view. Every CMS in the survey confirms this is the most expensive thing to retrofit, so we invest in the registry early.

**Top patterns to borrow:**
- **From Refine.dev:** the `DataProvider` interface (→ our daemon adapter), the **Inferencer's priority-ordered type-inference algorithm** (→ schemaless-key inference for graduation), **pessimistic-only mutation mode** (→ the review gate), and `getMany` reference batching (→ `relations:` rendering without N+1).
- **From the Airtable-likes:** Baserow's **three-component FieldType split** (cell / field-config-form / record-detail-form) + Rowy's **flat `IFieldConfig` object** as the registry shape; NocoDB's **count-pill → modal → card-list** relation UX and **views-as-saved-config**; Grist's **"Select By" widget-linking** for the ER graph; Mathesar's **record-summary** (show the linked note's `title`, not its id); Teable's **type-promotion ceremony** for graduation; PocketBase's **dangerous-changes detector** for the schema-write gate.
- **The grid component:** `@supabase/react-data-grid` (MIT) or TanStack Table (MIT) — both headless, virtualized, type-aware; the `meta` slot carries our field-registry metadata.

**The single sharpest decision:** adopt the **Refine `DataProvider` interface against the `zz` CLI** and make **every write pessimistic** (browser → daemon → `zz review` → confirm/reject → cache-invalidate), with all form generation driven by a `Map<FieldType, FieldConfig>` registry seeded by Refine-Inferencer-style inference over live frontmatter. Everything else layers onto that seam without new dependencies.

**The critical inversion to model:** every framework in this survey assumes a write resolves *when the mutation completes*. zuzuu's writes resolve to a **proposal (pending)** and only complete when the human gate fires — a semantically *deferred* write, not an optimistic one. This is the one place no prior art helps; we build it (Outerbase's staged-commit UX is the closest reference, not its code).

---

## The Master BORROW / ADAPT / AVOID Table

| Pattern | Source project (license) | Where it lands in our design | Verdict |
|---|---|---|---|
| `DataProvider` interface (`getList/getOne/create/update/deleteOne` + `getMany`) | Refine (MIT), react-admin (MIT) | `serve/api.mjs` façade + the daemon adapter → shells `zz` | **BORROW** (interface shape only) |
| `meta` passthrough bag on every method | Refine (MIT) | Carry `moduleId / proposalId / sessionId / FTS query` to the daemon | **BORROW** |
| Multiple named data providers | Refine (MIT) | Brain provider (`zz query`) vs Session provider (work-panel events) | **BORROW** |
| Inferencer **type-priority inference** (`relation>array>object>date>email>url>text>number>bool`; `*_id`→relation) | Refine (MIT) | Schemaless-key inference for the graduation proposal | **BORROW** (algorithm, ~50 LOC; not the package) |
| `@refinedev/inferencer` package (live API introspection) | Refine (MIT) | — | **AVOID** (circular against a file backend) |
| Pessimistic `mutationMode` (mutation fires first, UI holds) | react-admin / Refine (MIT) | The review gate — the only write mode we allow | **BORROW** |
| Optimistic / undoable mutation modes | react-admin / Refine (MIT) | — | **AVOID** (write is human-gated/deferred, not optimistic) |
| `getMany` / `ReferenceField` dedup batching | react-admin / Refine (MIT) | `relations:` column rendering (one query for all targets) | **BORROW** |
| Three-component FieldType split (cell · field-config-form · record-detail-form) | Baserow (MIT core) | The field-type registry's three render surfaces | **BORROW** (pattern; Python→TS) |
| Flat `IFieldConfig` object (no class hierarchy) | Rowy (Apache-2.0 / MIT) | The registry shape: `{type, DisplayCell, EditorCell, SideDrawerField, settingsSchema}` | **BORROW** |
| Three-mode `EditorCell` (inline · focus · popover) | Rowy (Apache-2.0) | Cell edit strategy (popover for select/date, focus for gated write) | **ADAPT** |
| Interface/display split (edit widget ≠ cell renderer) | Directus (BUSL-1.1) | Two registry entries per field type | **BORROW** (pattern only; no code) |
| Six-tab field drawer (Schema·Field·Interface·Conditions·Validation·Display) | Directus (BUSL-1.1) | The "promote/edit field" modal in schema graduation | **ADAPT** |
| Conditions (rule-based show/hide on sibling values) | Directus (BUSL-1.1) / Payload (MIT) | Field metadata `showWhen` predicate in the side-panel form | **ADAPT** (Payload's JS predicate over Directus's rule-tree) |
| Many-to-Any / replicator picker | Directus (BUSL-1.1) | ER-graph "add relation" picker (link a note in *any* module) | **ADAPT** |
| Blocks field (slug registry + per-block fields + type picker) | Payload (MIT) / Strapi Dynamic Zone (MIT) | Type-driven note form: `type:` value → that type's registered fields | **BORROW** |
| `admin.components` override (Field/Cell/Filter/Diff swappable) | Payload (MIT) | Registry extension points incl. the **Diff** component for the gate | **BORROW** |
| Join field (reverse relation, no column) | Payload (MIT) | Side-panel "notes that link here" backlinks section | **BORROW** |
| Draft-and-save staging (N/M/D badges, single commit) | Strapi (MIT) | Proposal queue UI: staged diffs, one "submit for review" action | **BORROW** |
| `UID` field (slug derived from another field) | Strapi (MIT) | Note id derived from content/title | **ADAPT** |
| Dangerous-changes detector (diff + warning before schema write) | PocketBase (MIT) | Review-gate UI: "this makes N envelopes schema-invalid" warning | **BORROW** |
| View collection (SQL SELECT → read-only virtual table, debounced dry-run) | PocketBase (MIT) | "Saved query" as a virtual module; FTS/CTE query editor | **ADAPT** |
| `Autodate` system fields | PocketBase (MIT) | Implicit `created_at`/`updated_at` from mtime/git-time | **BORROW** |
| Type-promotion ceremony (pick type → confirm) | Teable (AGPL) / Mathesar ENUM (GPLv3) | Schema graduation: right-click column → pick type → write `module.md` | **ADAPT** (manifest write, not DDL) |
| Record summary (display the linked record's title, not its id) | Mathesar (GPLv3) / Grist (Apache-2.0) | Relation chip label = `frontmatter.title ?? note.id` | **BORROW** |
| Count-pill → modal → searchable card list (relation cell UX) | NocoDB (SUL) | The `relations:` cell interaction in the grid | **BORROW** (UX; no code) |
| Stacked-modal linked-record traversal | Baserow (MIT) | Relation chip → linked envelope side panel, slide-over | **BORROW** |
| Views-as-stored-config (data shared, config per-view) | NocoDB (SUL) / Baserow (MIT) | Per-module saved views in `module.md` (`views:` key) | **BORROW** |
| "Select By" / widget-linking (master→detail, reactive, no query) | Grist (Apache-2.0) | ER-graph node click filters the grid to linked notes (already in the index) | **BORROW** |
| Resizable side panel + prev/next record nav | NocoDB (SUL) / ToolJet (Apache-2.0) | The envelope record side panel | **BORROW** |
| Filter chip bar (`key / operator / value`, additive, removable) | Supabase / ToolJet / Outerbase | Filter-chips compiling to SQLite WHERE fragments | **BORROW** |
| Staged-changes diff buffer + Commit/Discard | Outerbase Studio (AGPL) / Appsmith (Apache-2.0) | The pending-edits buffer flushed through the gate | **BORROW** (UX/model; no code) |
| Per-row Save/Discard column | Appsmith (Apache-2.0) | Explicit per-row write confirmation in the grid | **BORROW** |
| `@supabase/react-data-grid` component | Supabase (MIT) | The Brain grid (virtualized, type-aware cells) | **BORROW** (candidate) |
| TanStack Table `meta` slot as registry carrier | TanStack Table (MIT) | `ColumnDef.meta = {fieldType, options, relation}` | **BORROW** (candidate) |
| `react-jsonschema-form` as the production form renderer | rjsf (Apache-2.0) | — | **AVOID** (heavy + redundant schema language; write a lean `<FieldForm>`) |
| Drag-and-drop page/app/canvas builder | Appsmith/ToolJet/Budibase/Directus | — | **AVOID** (two locked worlds, not a canvas) |
| Real-time collab engine (WS/OT/Redis) | Teable/NocoDB/Baserow | — | **AVOID** (local-first, single-user) |
| Meta/data split (shadow metadata DB) | NocoDB (SUL) | — | **AVOID** (files are the truth; shadow DB = second source) |
| Server-side DDL for schema changes | Teable (AGPL) / PocketBase (MIT) | — | **AVOID** (graduation = a `module.md` write, gated) |
| Immediate-apply schema/cell writes | Directus/PocketBase/Supabase | — | **AVOID** (every write through `zz review approve`) |
| Schema-as-TS-code requiring recompile | Payload (MIT) / Sanity (MIT) | — | **AVOID** (schema must be runtime-writable, no build step) |
| Strapi "rename = delete + recreate" | Strapi (MIT) | — | **AVOID** (track immutable key separate from display label) |
| Multi-user auth / RBAC / SSO | most | — | **AVOID** (local-first, single-user v1) |
| AGPL / GPL / BUSL / Sustainable-Use code | Teable/NocoDB/Budibase/Windmill/Directus | — | **AVOID embedding** (patterns only, no code import) |

> License legend for borrowing **code** (not just patterns): **safe (MIT/Apache-2.0):** Refine, react-admin, Baserow *core*, Rowy, Grist, Payload, Strapi *community*, PocketBase, ToolJet *community*, Appsmith, `@supabase/react-data-grid`, TanStack Table, rjsf. **Pattern-only (copyleft/source-available — study, do not import):** Teable (AGPL), NocoDB (Sustainable Use License post-0.301), Mathesar (GPLv3), Budibase (GPLv3), Windmill (AGPL), Outerbase (AGPL), Directus (BUSL-1.1), Drizzle/Prisma Studio (commercial/proprietary).

---

## Section A — Refine.dev: the reference data-provider architecture

**[refinedev/refine](https://github.com/refinedev/refine)** · MIT · ~34.9k★ · v5 (April 2026) · demos: [refine.new](https://refine.new), [examples.refine.dev](https://examples.refine.dev) · core ~57 KB gzip (headless; UI adapters optional).

Refine is a headless React meta-framework for CRUD admin panels. Its thesis: decouple the **data layer** (data providers), **business logic** (hooks on TanStack Query), **routing**, and **UI** (optional kit adapters) so none locks the others. For zuzuu, take **only `@refinedev/core`** plus our own Tailwind components.

### The DataProvider contract (the load-bearing borrow)

A plain TS object satisfying the interface — **protocol-agnostic** (the interface does not mandate HTTP). Six required methods + optionals:

```ts
interface DataProvider {
  getList:   ({ resource, pagination, sorters, filters, meta }) => Promise<{ data: T[]; total: number }>
  getOne:    ({ resource, id, meta }) => Promise<{ data: T }>
  create:    ({ resource, variables, meta }) => Promise<{ data: T }>
  update:    ({ resource, id, variables, meta }) => Promise<{ data: T }>
  deleteOne: ({ resource, id, variables, meta }) => Promise<{ data: T }>
  getApiUrl: () => string
  // optional: getMany, createMany, updateMany, deleteMany, custom
}
```

`meta` is an arbitrary passthrough bag flowing from hook call site → provider unchanged. **Multiple providers are first-class:** `<Refine dataProvider={{ default: p1, notes: p2 }} />`, routed by `meta.dataProviderName`. **Resources** are a registry (`name`, route paths, `meta.icon/label/canDelete`) — the universal key threading the Inferencer, access control, and audit.

### Headless hooks

- **`useTable`** — pagination/sort/filter state surfaced as typed arrays. `CrudFilters` = `{field, operator, value}[]` (operators `eq|ne|lt|gt|gte|lte|in|nin|contains|containss|between|null|...`); `CrudSorting` = `{field, order}[]`; permanent vs initial (user-clearable) filters; **`syncWithLocation`** encodes table state into the URL (shareable views). 100% headless — wire it to TanStack Table (`@refinedev/react-table`) over your own cells.
- **`useForm`** — unifies create/edit/clone; in edit it `useOne`-fetches + populates, `onFinish(values)` calls `useUpdate`; cache invalidation automatic. Returns `onFinish` + state only; for headless you wire your own inputs.
- **Relation hooks** — `useMany`, `useOne`, `useSelect`, `useAutocomplete` lazy-load and wire FK selects.

### The Inferencer (algorithm to port, package to avoid)

`@refinedev/inferencer` fetches a sample record and runs **priority-ordered type detection**: `relation > array > object > date > email > image > url > richtext > text > number > boolean`. Relations: field names ending `id`/`ids`, single-`id` objects, arrays of `{id,...}`, or strings matching a known resource — then a probe `getList`. Generates live CRUD views **plus eject-ready source** (the "Code Viewer"); `fieldTransformer` overrides any field. It is a **dev-time scaffold** (`hideCodeViewerInProduction`).

### Access control + audit

- `accessControlProvider.can({resource, action, params})` → `{can}`; checked at render, disables/hides buttons (UI-side only; the data provider is the real enforcement point).
- `auditLogProvider` hooks every create/update/delete post-success; `previousData` comes from TanStack Query's cache; `useLogList` reads history.

### BORROW / ADAPT / AVOID for zuzuu

**BORROW** — the DataProvider interface as the daemon adapter (`getList → zz query`, `getOne → zz query --id`, `create/update → zz review approve` after proposal, `deleteOne → gated delete`); `meta` carries `moduleId/proposalId/sessionId`; the resource registry as the **module registry**; `useTable` (headless) + `syncWithLocation` for shareable per-module views; `useForm` (edit) as the envelope editor (pessimistic only); the Inferencer's **inference algorithm** for schemaless-key graduation; `useCan` as the read-side face of the review gate (e.g. disable "Edit" if a proposal is pending); the audit-log *shape* mapped to `zz module <m> generations`; multiple providers for the two worlds.

**AVOID** — `@refinedev/inferencer` itself (live API introspection is circular against a file backend); the UI adapter packages (`@refinedev/antd` etc. — Ant Design is 2.5 MB+); `auditLogProvider.update` (our audit/`LOG.md` is append-only); optimistic/undoable modes; letting `custom()` bypass the gate (override it to throw on mutating methods); the auth provider (local single-user).

**The inversion to model:** Refine assumes `create/update` resolve when the mutation completes. Ours resolve a **proposal**: `create()` returns `{ data: { id: proposalId, status: "pending" } }`; the real write completes only when the gate fires — poll/subscribe for the `approved` state. Semantically deferred, not optimistic.

**Sources:** [DataProvider](https://refine.dev/core/docs/data/data-provider/) · [useTable](https://refine.dev/core/docs/data/hooks/use-table/) · [useForm](https://refine.dev/core/docs/data/hooks/use-form/) · [Inferencer](https://refine.dev/docs/packages/inferencer/) · [Access Control](https://refine.dev/docs/advanced-tutorials/access-control/) · [Audit Log](https://refine.dev/docs/audit-logs/audit-log-provider/) · [Mutation Mode](https://refine.dev/docs/advanced-tutorials/mutation-mode/) · [v5 announcement](https://refine.dev/blog/refine-v5-announcement/) · [LocalForage data provider (marmelab)](https://marmelab.com/blog/2022/10/26/create-an-localforage-dataprovider-in-react-admin.html).

---

## Section B — DB-as-app: the open-source Airtable-likes

### B1 · NocoDB — [github.com/nocodb/nocodb](https://github.com/nocodb/nocodb) · **Sustainable Use License** (post-v0.301; non-OSI, source-available) · ~49k★ · NestJS + Nuxt/Vue · demo [nocodb.com](https://nocodb.com)
Polyglot DB-as-app over any SQL DB. **Meta/data split** (`NC_DB` holds definitions; user data stays external — UI always driven from meta). **UITypes enum → `HANDLER_REGISTRY` → `componentMap`**: each field type maps to a handler (`parseUserInput/parseDbValue/applyFilter`) and a render component — the clearest "schema-to-UI from a type token" prior art. **LTAR V2 (Link To Another Record):** HasMany/BelongsTo/ManyToMany via a uniform junction; the grid cell shows a **count pill → modal → searchable card list** of display-value pills (not raw ids). **Views as first-class entities** (Grid/Gallery/Kanban/Calendar/Form/Map/Timeline/Gantt) each store their own filter/sort/visibility/grouping in meta; data shared. **Expanded record** = resizable right panel, prev/next nav.
- **BORROW (UX, no code):** the UIType→registry→componentMap three-layer idea; views-as-config; count-pill→modal→card-list relation UX; side panel with prev/next. **AVOID:** the license (no code), the meta/data split (files are our truth), the collab engine.

### B2 · Baserow — [github.com/baserow/baserow](https://github.com/baserow/baserow) · **MIT core** (premium features source-available) · ~13k★ · Django + Vue · demo [baserow.io](https://baserow.io)
**Dual registry** (Python `field_type_registry` + JS `$registry`). Each `FieldType` implements **three Vue components** — `GridViewFieldComponent` (cell), `SubFormFieldComponent` (the field creation/config form, driven by `allowed_fields`), `RowEditFieldComponent` (the record-detail form field). This **three-component split** (grid cell vs field-config vs record-detail) is the clearest in the survey. **Link Row** opens a row-select modal of colored token chips → clicking a chip opens a **stacked record-detail modal** (deep traversal without leaving context). **Undo/redo + 3-day trash** — the most mature safety net.
- **BORROW:** the three-component FieldType pattern (→ our registry's three surfaces); the stacked-modal relation traversal; `SubFormFieldComponent`-from-`allowed_fields` as the "promote key → typed column" config UI. **ADAPT** to flat TS objects (not a Python class hierarchy).

### B3 · Teable — [github.com/teableio/teable](https://github.com/teableio/teable) · **AGPL-3.0** (EE proprietary) · ~21k★ · NestJS + Next.js + Prisma/Postgres · 1M-row [demo](https://app.teable.ai/share/shrVgdLiOvNQABtW0yX/view)
**Schema IS the Postgres schema** (no meta/data split; promotion = a real DDL ALTER). The honest version of "schemaless → promote to typed table." Proves a no-abstraction approach survives 1M rows (our local analog is `node:sqlite`+FTS5). Direct SQL access for power users.
- **BORROW (pattern only — AGPL):** the **type-promotion ceremony** (pick a type → confirm) as the graduation UX. **AVOID:** AGPL code; server-side DDL (ours is a `module.md` write).

### B4 · Grist — [github.com/gristlabs/grist-core](https://github.com/gristlabs/grist-core) · **Apache-2.0** (most permissive) · ~7k★ · Node + TS/Python · **SQLite-per-document** · demo [getgrist.com](https://www.getgrist.com)
Structurally closest to us: every document **is a SQLite file**. **Reference / Reference List columns** store the target row id; display shows a chosen column (`$Manager.Name` formula). **Widget linking ("Select By"):** any widget can be filtered by selecting a row in another widget that references the same table — **reactive, zero-query master→detail** (state already in memory).
- **BORROW:** **"Select By"** as the ER-graph interaction (click a node → filter the grid to linked notes, no new query — the link graph is already in our index); Reference display-formula as relation-title display; SQLite-per-document validates our index model.

### B5 · Mathesar — [github.com/mathesar-foundation/mathesar](https://github.com/mathesar-foundation/mathesar) · **GPLv3** · ~2.5k★ · Svelte + Django + Postgres-native · demo [mathesar.org](https://mathesar.org)
Zero abstraction (UI = live Postgres schema). **Record selector for FK fields:** fuzzy-search modal over the target table with a **"record summary"** (first text-like column, customizable) as display; inline-create from the selector. **Form builder auto-generated from schema**; **transactional submission** (parent + related in one commit). **ENUM support (v0.10.0)** → select input — closest prior art to our "single_select" graduation.
- **BORROW (pattern — GPLv3):** **record summary** = relation display default (`title ?? id`); form-builder-from-schema; transactional submit (→ one `zz review approve` writes the note AND mints the generation atomically); the Svelte signal that a *lean typed-component* approach covers the whole schema-to-UI surface.

### B6 · Rowy — [github.com/buildship-ai/rowy](https://github.com/buildship-ai/rowy) · **Apache-2.0 (MIT shared pkgs)** · TS/React/Vite/Firebase · [field-type docs](https://docs.rowy.io/contributing/add-a-field-type)
The **cleanest field-type architecture** in the space. Each type exports one **flat `IFieldConfig`** object: `{type, name, group, dataType, initialValue, DisplayCell, EditorCell (inline/focus/popover), SideDrawerField, settings schema}`. New type = one directory + one config + one enum entry. No class hierarchy — a flat object `Map`.
- **BORROW:** the `IFieldConfig` flat-object shape **verbatim** (architecture, not Firebase runtime); three-mode `EditorCell`; `SideDrawerField` = the envelope side-panel field renderer.

### B7 · APITable — [github.com/apitable/apitable](https://github.com/apitable/apitable) · AGPL-3.0 · Java + React · **largely dormant** (team pivoted to `aitable.ai`).
- **SKIP** — AGPL + Java + unmaintained OSS line; patterns no more advanced than NocoDB/Teable.

**Section B sources:** NocoDB [architecture](https://nocodb.com/docs/product-docs/engineering/architecture/) · [views](https://nocodb.com/docs/product-docs/views) · [links field](https://nocodb.com/docs/product-docs/fields/field-types/links-based/links) · [expand record](https://nocodb.com/docs/product-docs/records/expand-record) · [license discussion](https://github.com/nocodb/nocodb/discussions/12891). Baserow [field-type plugin](https://baserow.io/docs/plugins/field-type) · [enlarging rows](https://baserow.io/user-docs/enlarging-rows) · [link-to-table](https://baserow.io/user-docs/link-to-table-field). Teable [repo](https://github.com/teableio/teable). Grist [linking widgets](https://support.getgrist.com/linking-widgets/) · [reference columns](https://support.getgrist.com/col-refs/). Mathesar [relationships](https://docs.mathesar.org/0.2.0/user-guide/relationships/) · [0.10.0 release](https://mathesar.org/blog/2026/04/26/release-0-10-0). Rowy [add-a-field-type](https://docs.rowy.io/contributing/add-a-field-type). Grid: [react-datasheet-grid](https://github.com/nick-keller/react-datasheet-grid).

---

## Section C — Headless-CMS schema & field-type builders

### C1 · Directus — [github.com/directus/directus](https://github.com/directus/directus) · **BUSL-1.1** (→GPL3 after 3y; license trap for embedding) · Vue 3 + Node
DB-first; `directus_fields` stores a **metadata overlay** per column. The key abstraction is the **interface / display split**: every field has an **interface** (edit-mode widget) and a **display** (read-mode cell renderer), independently configured. **Interface registry:** each interface exports `{id, name, types, group, component}`; `VForm` renders by looking up `field.meta.interface`. **Six-tab field drawer:** Schema · Field · Interface · Display · Validation · **Conditions** (rule-based show/hidden/required/readonly from sibling values, no code). **Relation wizards** (M2O/O2M/M2M/M2A) are each first-class; **alias fields** (O2M/M2A) display related records with *no new column*. `directus-labs/schema-builder-kit` is a fluent API emitting the same payload as the GUI (schema is inspectable/reproducible in code).
- **BORROW (pattern, no code — BUSL):** the **interface/display split** (→ two registry entries per type); the **six-tab field drawer** for graduation; **Conditions** (→ a `showWhen` predicate); **M2A picker** for the ER-graph "add relation"; **alias fields** for reverse-link traversal in the side panel.
- **AVOID:** BUSL code; live-apply-to-DB; the drag-and-drop canvas builder (our ER graph is a *viewer*); the WYSIWYG (envelopes are plain markdown).

### C2 · Strapi — [github.com/strapi/strapi](https://github.com/strapi/strapi) · **MIT community** (EE commercial) · Node + React admin · ~67k★
Schema lives as **JSON files on disk** (`schema.json`) — inherently file-native; Content-Type Builder is **dev-only**. **Draft-and-save staging:** all field edits across types accumulate in a buffer with **N/M/D badges**; one Save commits + restarts the dev server. **Dynamic Zone** = polymorphic array; editor picks a component type from a palette inline. **Components** = reusable sub-schemas. **UID** = slug auto-derived from another field. **Conditional fields** (bool/enum triggers). **Critical caveat: rename = delete + create → old data becomes unreachable.**
- **BORROW:** **draft-and-save staging** (→ the proposal queue with N/M/D badges, one "submit for review"); **Dynamic Zone / type-driven form** (pick note `type:` → render that type's fields); **component reuse** (→ field-group presets in `src/notes/module-templates.mjs`); **UID** (note id from content); conditional fields.
- **AVOID:** server restart on schema change (we read `module.md` at query time); the **rename = delete+recreate** failure mode — we **must** track an immutable key separate from the display label (verify enforced in `grow/evolve.mjs`).

### C3 · Payload CMS — [github.com/payloadcms/payload](https://github.com/payloadcms/payload) · **MIT** · Next.js-first · ~32k★
**Schema = TypeScript code** (`CollectionConfig` → DB + REST + GraphQL + admin UI, all derived). **Blocks field:** an array of polymorphic objects, each defined by a `slug` + its own `fields` — a **registry of named block types** with a picker drawer; `blockType` identifies the schema; blocks reusable across collections. **`admin.components` override:** Field, **Cell**, Label, Error, Filter, **Diff** all separately swappable (ships `@payloadcms/ui`). **Join field** = reverse relation, no column, lazy-loaded. **`admin.condition`** = a JS predicate `(data, siblingData) => boolean`. **Presentational fields** (Collapsible/Row/Tabs/UI) are zero-column layout primitives.
- **BORROW:** the **Blocks field** as the template for our type-driven note form (`type:` value = block slug; type's fields = the form); the **`admin.components` override** as the registry's extension points — **especially the Diff component for the review gate**; the **Join field** for the backlinks panel; the **JS `condition` predicate** (lighter than a rule-tree for our owned bundle); presentational fields as layout metadata; the `@payloadcms/ui` idea (ship an internal `zuzuu/ui`).
- **AVOID:** schema-as-TS-code requiring recompile (ours must be runtime-writable, no build step); the Next.js coupling (we're Vite); its DB adapters (we have `node:sqlite`); the Lexical rich-text editor.

### C4 · PocketBase — [github.com/pocketbase/pocketbase](https://github.com/pocketbase/pocketbase) · **MIT** · single Go binary + embedded SQLite + Svelte admin
Collections: **Base / View (read-only SQL SELECT) / Auth**. 14 field types incl. **`Autodate`** (auto `created_at`/`updated_at`). Schema edited at runtime; field config in a tabbed modal (Fields | API Rules | Options). **Dangerous-changes detector:** before persisting, diffs new vs current, flags renames (matched by id), deletes, and multi→single conversions (data truncation) in a warning component the user must acknowledge — **the most honest schema-level write gate in the survey**. **View collection** = a SQL SELECT with **200ms debounced dry-run validation**; output schema inferred from the query. Import/export JSON with **diff visualization** before apply.
- **BORROW:** the **dangerous-changes detector** → the review-gate UI shows "this makes N envelopes schema-invalid" before approve; the **View collection** → our FTS5+CTE saved queries as virtual modules, with debounced dry-run; **Autodate** → implicit system fields (mtime/git-time); import/export-with-diff → `zz module <m>` in the Brain; the tabbed collection modal (Fields | Relations | Settings) for the module editor.
- **AVOID:** immediate-apply schema model; the Go backend; porting Svelte components; the Auth collection (no multi-user v1).

### C5 · Corroborating signals
- **DatoCMS** (proprietary): **environment-isolation** (sandbox schema → merge to prod after validation) = the SaaS analog of our review gate — confirms non-destructive schema evolution needs an explicit promotion step. Blocks/Modular-Content distinction mirrors Payload/Strapi. *Our git branch is the isolation unit.*
- **Sanity** (MIT Studio): code-first `defineType/defineField`; the `object` type as an arbitrarily-deep composable primitive = the cleanest sub-schema/field-group formalization. *But needs their Content Lake — not portable to `node:sqlite`.*

**Section C sources:** Directus [data-model](https://directus.com/docs/app/data-model) · [interfaces](https://directus.com/docs/guides/data-model/interfaces) · [relationships](https://directus.com/docs/guides/data-model/relationships) · [fields/drawer](https://directus.com/docs/guides/data-model/fields) · [schema-builder-kit](https://github.com/directus-labs/schema-builder-kit) · [license](https://directus.io/blog/changing-our-license-one-year-later). Strapi [content-type-builder](https://docs.strapi.io/cms/features/content-type-builder) · [LICENSE](https://github.com/strapi/strapi/blob/develop/LICENSE). Payload [fields overview](https://payloadcms.com/docs/fields/overview) · [blocks](https://payloadcms.com/docs/fields/blocks) · [open-source](https://payloadcms.com/posts/blog/open-source). PocketBase [collections](https://pocketbase.io/docs/collections/) · [collection-management UI](https://deepwiki.com/pocketbase/pocketbase/5.3-collection-management-ui). DatoCMS [schema-builder](https://www.datocms.com/features/schema-builder).

---

## Section D — Internal-tool platforms & DB studios

### D1 · Budibase — [github.com/Budibase/budibase](https://github.com/Budibase/budibase) · **GPLv3 core** (copyleft trap) · Svelte + Koa + CouchDB
Typed column registry incl. **Link-to-Row** (bidirectional FK; pick a **display column** for the chip). **Schema → form auto-generation** ("Form block" → pick schema → fields auto-populate by type; "Field groups" **auto-syncs** when schema changes). One-click **CRUD-screen generation** from a table.
- **BORROW (pattern, no code — GPL):** **display-column concept** (→ our `title` key as the relation-chip label); **field-group auto-sync** (side-panel form re-renders new fields when a key is added); one-click table-view generation from a module with a `schema:`. **AVOID:** GPL code, Svelte, CouchDB, the page builder, the automation engine.

### D2 · ToolJet — [github.com/ToolJet/ToolJet](https://github.com/ToolJet/ToolJet) · **Apache-2.0 community** · React + NestJS + Postgres
ToolJet DB = spreadsheet over Postgres. **Row drawer** (double-click complex row → full-height side panel, type-aware inputs). **Visual FK picker** (source col → target table/col → ON DELETE/UPDATE rule; visual joins). **Filter/sort chip bar** (`column/operator/value`, removable, compositional).
- **BORROW:** the **row drawer** → our envelope side panel; the **filter-chip** pattern → compiles to SQLite WHERE fragments; the visual FK-relation creation UI → the ER-graph "add relation" flow (encode as `relations:` on the manifest). **AVOID:** the UI-builder canvas, NestJS backend, Postgres, enterprise auth, AI codegen.

### D3 · Appsmith — [github.com/appsmithorg/appsmith](https://github.com/appsmithorg/appsmith) · **Apache-2.0** · React + Java (~2GB image)
**Table widget** auto-populates columns from query result; per-column type + editable flag. **Inline edit:** double-click → type-aware editor. **Staged-changes at the row level:** single-row mode shows a **Save/Discard column**; multi-row accumulates `Table.updatedRows` flushed by an explicit action. Git commit modal shows diffs by resource.
- **BORROW:** the **per-row Save/Discard column** (edits never auto-save → "Save" stages a review proposal, "Discard" resets to last-committed note); the **`updatedRows` accumulation** model (→ `pendingEdits: Map<noteId, Partial<Frontmatter>>` flushed via one `POST /api/review/stage`). **AVOID:** Java backend + Docker footprint, the canvas, the `{{…}}` binding syntax.

### D4 · Windmill — [github.com/windmill-labs/windmill](https://github.com/windmill-labs/windmill) · **AGPLv3** · Svelte + Rust + Postgres
Code-first inversion: **script parameters ARE the schema** → form auto-generated from the function signature. **Type→field map** (`string`→text, `number`→numeric, `bool`→toggle, TS union→dropdown, resource type→picker, nested object→sub-form). **Native approval step** (a human must click Approve before a downstream step runs) — **structurally identical to our review gate**.
- **BORROW (pattern, no code — AGPL):** the **type-signature→form-field mapping table** as a blueprint; the **approval step** as the mental model for the gate in the Work world (agent proposes → approval card → human Approve/Reject → daemon shells `zz review`). **AVOID:** AGPL code, the workflow/job engine, the credential system.

### D5 · Supabase Studio — [github.com/supabase/supabase](https://github.com/supabase/supabase) · **Apache-2.0 studio**; **`@supabase/react-data-grid` is MIT** (forked from adazzle `react-data-grid`) · React/Next.js
The highest-quality open-source DB grid in the ecosystem. Column type → renderer + editor (custom cross-browser date-picker; JSON → side-panel expand; FK → "view referencing record" jump). **Row expand** → side panel form (type-aware). **Filter chip bar**, URL-synced. **Schema-editor ER diagram** (Studio 3.0): table nodes + FK edges on a canvas. Cell edits commit immediately today, but **Discussion #42460** shows demand for queue-before-commit (our pattern).
- **BORROW:** **`@supabase/react-data-grid` (MIT)** as the **strongest grid candidate** (virtualization, resizing, keyboard nav, copy/paste, type-aware editors); the **filter-chip** UX; **row-expand → side panel**; the **ER diagram** (table nodes + FK edges → port as React Flow / d3-force over the index's link graph). **AVOID:** Supabase infra coupling (Auth/Realtime/Storage); the full Next.js Studio; immediate cell-commit; the AI SQL editor.

### D6 · Outerbase Studio — [github.com/outerbase/studio](https://github.com/outerbase/studio) · **AGPL-3.0** · Next.js + TS (acquired by Cloudflare → D1 Studio) · [libsqlstudio.com](https://libsqlstudio.com)
The **reference implementation of staged-commit** in our exact tech-stack analog: all edits accumulate in a **local diff buffer**, "Preview changes" shows the pending set, one **Commit** flushes in a transaction (the `git add` + `git commit` model). **Row-detail sidebar**; **FK picker** (queries the referenced table, select by display value). Point-and-click schema editor (no DDL).
- **BORROW (UX/model, no code — AGPL):** the **staged-changes model** (buffer in React state, pending-row highlight, diff-count badge, Commit/Discard — flush on Approve); the **FK → relation picker** (search-and-select over `zz query <target-module>`).

### D7 · NocoDB *(internal-tool lens)* — see B1. **BORROW** here: **named views as saved filter-configs** (Brain saved presets → `{filters, sort, hiddenKeys}` keyed by `module:view-name`); **Lookup/Rollup** as a v2 "derived/computed keys" model. **AVOID:** the SUL license, Kanban/Calendar (out of v1 scope).

### D8 · Drizzle Studio / Prisma Studio — commercial/proprietary studios. **AVOID code.** **BORROW concept:** *schema-file-as-source-of-truth* (our `module.md` IS the schema source — Drizzle); *FK navigation as first-class UX* (clicking a relation chip deep-links to the referenced note's expand view — Prisma).

**Section D sources:** Budibase [repo](https://github.com/Budibase/budibase). ToolJet [tooljet.com](https://tooljet.com) · [repo](https://github.com/ToolJet/ToolJet). Appsmith [repo](https://github.com/appsmithorg/appsmith). Windmill [app.windmill.dev](https://app.windmill.dev) · [repo](https://github.com/windmill-labs/windmill). Supabase grid [repo](https://github.com/supabase/supabase) · archived [supabase/grid](https://github.com/supabase/grid). Outerbase [repo](https://github.com/outerbase/studio).

---

## Section E — Cross-cutting architecture patterns (the data-provider seam)

This section consolidates the recurring **architecture** (vs. UX) patterns and the supporting React component libraries.

### E1 · The data-provider seam (Refine, react-admin, AdminJS)
All three converge on a small backend-agnostic CRUD interface. **react-admin** ([marmelab/react-admin](https://github.com/marmelab/react-admin), MIT) adds **`getManyReference(resource, {target, id, ...})`** — a reverse-relation fetch ("all children of a parent" → all notes in a module, or all backlinks). Its **MVC seam** (controller hooks `useListController`/`useEditController` + declarative views) and **`mutationMode`** are the sharpest write-path prior art. **`ReferenceField`** internally `getMany`-batches with page-wide dedup (no N+1). Its **`ra-data-fakerest` + `ra-data-localforage`** layering proves the model: implement the 9-method interface over *any* query engine — our `node:sqlite`+FTS5 is a drop-in.

**AdminJS** ([SoftwareBrothers/adminjs](https://github.com/SoftwareBrothers/adminjs), MIT): three adapter classes — `BaseResource`/`BaseDatabase`/`BaseProperty`. **`BaseProperty`** is the schema-inference atom (name, type, per-action `isVisible` for list/edit/show/filter, reference flag) — clean prior art for our per-key registry and the module→note→key hierarchy. *(Generates UI server-side — wrong shape for a Vite SPA; take the type hierarchy only.)*

### E2 · The field-type → interface registry (Directus pattern, generalized)
Map `field.meta` (`type`, `interface`, `options`, `conditions`, `width`) onto our frontmatter-key registry. A `VForm`-style renderer takes `FieldDef[]` and dispatches by `meta.interface` through a global registry. Relation interfaces (`list-m2m`, `select-dropdown-m2o`) are *registered entries*, not special cases — relation complexity lives inside the component.

### E3 · The grid engine — TanStack Table ([repo](https://github.com/TanStack/table), MIT, headless)
Owns zero DOM. `ColumnDef.meta` is a free-form typed slot — **the canonical place to carry our field-registry metadata** (`{fieldType, options, relation, hidden}`) into the cell renderer; the engine ignores it. **Accessor columns** sort/filter/group; **display columns** (relations, row actions, expand) do not. Pairs with `@tanstack/react-virtual` for large row sets. *Candidate alongside `@supabase/react-data-grid`; pick one at build time (see Open Questions).*

### E4 · Schema → form — `react-jsonschema-form` ([rjsf-team/react-jsonschema-form](https://github.com/rjsf-team/react-jsonschema-form), Apache-2.0)
Generates forms from JSON Schema; custom widgets per type (the same registry idea). **AVOID as the production renderer** — its bundle (~80 KB + adapter) and its own schema language are redundant when we already own the key-registry format. Write a lean ~200-LOC `<FieldForm>` over react-hook-form + Zod that reads our `FieldDef[]` directly. (rjsf is the *fallback* if we want JSON-Schema interop.)

**Section E sources:** [react-admin DataProviders](https://marmelab.com/react-admin/DataProviders.html) · [Edit/mutationMode](https://marmelab.com/react-admin/Edit.html) · [ReferenceField](https://marmelab.com/react-admin/ReferenceField.html) · [AdminJS Resource](https://docs.adminjs.co/basics/resource) · [Directus interface extensions](https://directus.com/docs/guides/extensions/app-extensions/interfaces) · [TanStack column defs](https://tanstack.com/table/v8/docs/guide/column-defs) · [rjsf repo](https://github.com/rjsf-team/react-jsonschema-form).

---

## The data-provider + schema-to-form architecture we should adopt

This is the synthesized target, mapped to `web/src/{shared,server,client}`, the `zz` CLI, `node:sqlite`, and the review gate. Cross-reference [`05-experience-spec.md`](./05-experience-spec.md) (the two worlds) and [`03-js-library-landscape.md`](./03-js-library-landscape.md) (runtime/license constraints).

### 1 · The `ZuzuuDataProvider` (the seam — the moat)

Implement the Refine `DataProvider` interface in `web/src/client/` as `fetch()` calls to the local daemon (`web/src/server/`), which shells `zz`:

| Method | Daemon route | `zz` shell | Resolves to |
|---|---|---|---|
| `getList({resource, filters, sorters, pagination, meta})` | `GET /api/:module` | `zz query <module>` (filters→FTS5 WHERE/CTE) | `{ data, total }` (read; never gated) |
| `getOne({resource, id})` | `GET /api/:module/:id` | `zz query <module> --id` | `{ data }` (the parsed envelope) |
| `getMany({resource, ids})` | `POST /api/:module/batch` | one batched query | `{ data[] }` (relation rendering, dedup) |
| `create({resource, variables, meta})` | `POST /api/:module/propose` | `zz` proposal → **queued** | `{ data: { id: proposalId, status: "pending" } }` |
| `update({resource, id, variables})` | `POST /api/:module/:id/propose` | proposal → **queued** | `{ data: { id: proposalId, status: "pending" } }` |
| `deleteOne({resource, id})` | `POST /api/:module/:id/propose-delete` | gated delete proposal | `{ data: { status: "pending" } }` |
| *(approve)* | `POST /api/review/:proposalId/approve` | **`zz review approve`** (the single write door) | `{ data }` (write completes; cache invalidates) |

- **`meta`** carries `moduleId / proposalId / sessionId / ftsQuery` unchanged. **Resources = modules.** **`getApiUrl()`** returns the daemon's local URL. **`custom()` is overridden to throw on any mutating method** — no write bypasses the gate.
- **Two providers** (Refine multi-provider): `default` (Brain, `zz query`) and `session` (Work-panel live events).
- **Pessimistic only** (react-admin's mode): the browser never mutates locally; the deferred-write inversion is modeled as the two-phase `pending → approved` cycle (poll or subscribe).

### 2 · The field-type registry (the schema-to-form generator)

A flat `Map<string, FieldConfig>` (Rowy's `IFieldConfig` shape + Baserow's three surfaces + Payload's override slots), checked at startup; **adding a YAML key type = one object, zero framework changes**:

```ts
interface FieldConfig<T = unknown> {
  type: string;          // matches the frontmatter key type token, e.g. "single_select", "relation"
  dataType: string;      // "string" | "number" | "boolean" | "string[]" | "date" | ...
  DisplayCell:     React.FC<CellDisplayProps<T>>;   // Brain grid cell (read)
  EditorCell:      React.FC<CellEditorProps<T>>;    // inline | focus | popover edit
  SideDrawerField: React.FC<SideDrawerFieldProps<T>>; // envelope side-panel field
  DiffComponent?:  React.FC<DiffProps<T>>;          // the review-gate diff (Payload's Diff slot)
  settingsSchema?: JSONSchema;                       // drives the "promote key → typed column" config form
  showWhen?: (doc: Frontmatter) => boolean;          // Payload-style conditional visibility
}
const FIELD_REGISTRY = new Map<string, FieldConfig>();
```

- **Grid** renders `DisplayCell`; **side panel** renders `SideDrawerField`; **review gate** renders `DiffComponent`; **graduation dialog** renders from `settingsSchema`. One source of truth, four surfaces.
- **Grid component:** wrap `@supabase/react-data-grid` *or* TanStack Table; each column's `meta = {fieldType, options, relation}` dispatches into `FIELD_REGISTRY`.
- **Built-in system fields** (PocketBase `Autodate`): `created_at`/`updated_at` derived from mtime/git-time, registered, not user-defined.

### 3 · Schemaless → typed graduation

- **Cold-start inference** (Refine Inferencer algorithm, ~50 LOC): sample the first N notes' frontmatter; per key, run the priority chain (`*_id|*_ids`→`relation`; ISO-8601→`date`; `true/false`→`boolean`; number→`number`; else `text`). Store the inferred `FieldDef[]` in the module registry.
- **Promotion ceremony** (Teable/Mathesar-ENUM): right-click a column header → pick a type from `FIELD_REGISTRY` keys → write `key: {type, ...}` into `module.md`'s field map (**this write also goes through `zz review`**); `settingsSchema` drives the dialog. **No DDL — a manifest write.**
- **Safety:** track an **immutable key** separate from the **display label** (the Strapi anti-pattern) — verify in `grow/evolve.mjs`. Before any schema-affecting approval, show **PocketBase's dangerous-changes diff** ("this makes N envelopes schema-invalid").

### 4 · Relations, views, ER graph, audit

- **Relation cell:** NocoDB **count-pill → modal → searchable card list**; pill label = Mathesar **record summary** (`frontmatter.title ?? note.id`); chip → **stacked** linked-envelope side panel (Baserow). Rendering uses `getMany` dedup batching (no N+1).
- **Backlinks:** Payload **Join field** pattern — a virtual "notes that link here" section (reverse query, no stored column; react-admin `getManyReference`).
- **Views:** NocoDB/Baserow **views-as-config** — per-module saved `{filters, sort, hiddenKeys, groupBy}` in `module.md`'s `views:` key, keyed `module:view-name`; switching is a client-side config swap (the full module set is already in the SQLite index); URL-synced (Refine `syncWithLocation`).
- **ER graph:** React Flow / d3-force over the index's link graph; node click = Grist **"Select By"** (reactive filter of the grid, no new query). "Add relation" = Directus **M2A picker** → writes `relations:` on the manifest (gated).
- **Audit:** Refine audit-log *shape* → `zz module <m> generations`; the diff view = the generation diff (append-only — no update path).

---

## Open questions for the build phase

1. **Grid component: `@supabase/react-data-grid` vs TanStack Table?** Supabase's is a higher-level batteries-included grid (type-aware editors, FK jump) but heavier; TanStack is lower-level + maximally lean with the cleanest `meta` slot. Decide on bundle budget + how much cell-editor UX we want for free. (Both MIT.)
2. **Deferred-write modeling: poll vs subscribe?** The `pending → approved` cycle needs the SPA to learn when the gate fires. Daemon WebSocket push (we already run `ws` for the terminal) vs TanStack Query polling. WS is cleaner but couples the Brain to the live channel.
3. **`react-admin`/Refine as a dependency, or just the interface?** Do we pull `@refinedev/core` (57 KB, real hooks/caching for free) or reimplement the ~6-method seam + thin TanStack Query wrappers ourselves to stay maximally lean? Lean-bias suggests the latter; speed-bias suggests the former.
4. **Where does the field registry live — client-only, or shared?** `web/src/shared/` could host the registry so the daemon also reasons about field types (e.g., for validation in the proposal step), or it stays client-only and the daemon treats frontmatter opaquely. Affects how much schema logic duplicates across the gate boundary.
5. **Inference cadence:** run cold-start inference once on first grid visit and persist `FieldDef[]`, or re-infer on every load until a key is explicitly promoted? Persisting risks staleness as notes evolve; re-inferring costs a scan.
6. **View config storage:** in `module.md` frontmatter (git-tracked, shareable, but pollutes the manifest) vs a separate `.zuzuu/views/` store. The former is more "everything is an envelope"; the latter keeps manifests clean.
7. **ER-graph library:** React Flow (richer, ~MIT, heavier) vs a hand-rolled d3-force canvas (leaner, more work). Gated on whether the ER view is interactive (drag, "add relation") or read-only in v1.
8. **`settingsSchema` format:** JSON Schema (interop, rjsf-compatible) vs our own minimal descriptor (leaner, no rjsf). Ties to whether we ever want JSON-Schema interop for templates.
9. **Backlinks at scale:** the Payload Join pattern is a reverse query — confirm the `node:sqlite` link graph + recursive-CTE handles backlink fan-out cheaply for hot notes, or cache it.
10. **Diff component reuse across worlds:** the review gate appears in both Work (teaching) and Brain (schema graduation). Is the `DiffComponent` per-field-type (registry) or one generic envelope-diff view? Likely both — a generic frontmatter diff with per-type cell overrides.

---

## Consolidated source index

**Refine / data-provider seam:** [refine repo](https://github.com/refinedev/refine) · [DataProvider](https://refine.dev/core/docs/data/data-provider/) · [useTable](https://refine.dev/core/docs/data/hooks/use-table/) · [useForm](https://refine.dev/core/docs/data/hooks/use-form/) · [Inferencer](https://refine.dev/docs/packages/inferencer/) · [Access Control](https://refine.dev/docs/advanced-tutorials/access-control/) · [Audit Log](https://refine.dev/docs/audit-logs/audit-log-provider/) · [Mutation Mode](https://refine.dev/docs/advanced-tutorials/mutation-mode/) · [v5 announcement](https://refine.dev/blog/refine-v5-announcement/) · [react-admin repo](https://github.com/marmelab/react-admin) · [DataProviders](https://marmelab.com/react-admin/DataProviders.html) · [Edit/mutationMode](https://marmelab.com/react-admin/Edit.html) · [ReferenceField](https://marmelab.com/react-admin/ReferenceField.html) · [localforage provider](https://marmelab.com/blog/2022/10/26/create-an-localforage-dataprovider-in-react-admin.html) · [AdminJS repo](https://github.com/SoftwareBrothers/adminjs) · [AdminJS Resource](https://docs.adminjs.co/basics/resource).

**Airtable-likes:** [NocoDB repo](https://github.com/nocodb/nocodb) ([arch](https://nocodb.com/docs/product-docs/engineering/architecture/) · [views](https://nocodb.com/docs/product-docs/views) · [links](https://nocodb.com/docs/product-docs/fields/field-types/links-based/links) · [expand](https://nocodb.com/docs/product-docs/records/expand-record) · [license](https://github.com/nocodb/nocodb/discussions/12891)) · [Baserow repo](https://github.com/baserow/baserow) ([field-type](https://baserow.io/docs/plugins/field-type) · [rows](https://baserow.io/user-docs/enlarging-rows) · [link-to-table](https://baserow.io/user-docs/link-to-table-field)) · [Teable repo](https://github.com/teableio/teable) ([1M-row demo](https://app.teable.ai/share/shrVgdLiOvNQABtW0yX/view)) · [Grist repo](https://github.com/gristlabs/grist-core) ([linking widgets](https://support.getgrist.com/linking-widgets/) · [reference cols](https://support.getgrist.com/col-refs/)) · [Mathesar repo](https://github.com/mathesar-foundation/mathesar) ([relationships](https://docs.mathesar.org/0.2.0/user-guide/relationships/) · [0.10.0](https://mathesar.org/blog/2026/04/26/release-0-10-0)) · [Rowy repo](https://github.com/buildship-ai/rowy) ([add-a-field-type](https://docs.rowy.io/contributing/add-a-field-type)).

**Headless CMS:** [Directus repo](https://github.com/directus/directus) ([data-model](https://directus.com/docs/app/data-model) · [interfaces](https://directus.com/docs/guides/data-model/interfaces) · [relationships](https://directus.com/docs/guides/data-model/relationships) · [fields](https://directus.com/docs/guides/data-model/fields) · [interface extensions](https://directus.com/docs/guides/extensions/app-extensions/interfaces) · [schema-builder-kit](https://github.com/directus-labs/schema-builder-kit) · [license](https://directus.io/blog/changing-our-license-one-year-later)) · [Strapi repo](https://github.com/strapi/strapi) ([content-type-builder](https://docs.strapi.io/cms/features/content-type-builder) · [LICENSE](https://github.com/strapi/strapi/blob/develop/LICENSE)) · [Payload repo](https://github.com/payloadcms/payload) ([fields](https://payloadcms.com/docs/fields/overview) · [blocks](https://payloadcms.com/docs/fields/blocks) · [open-source](https://payloadcms.com/posts/blog/open-source)) · [PocketBase repo](https://github.com/pocketbase/pocketbase) ([collections](https://pocketbase.io/docs/collections/) · [collection UI](https://deepwiki.com/pocketbase/pocketbase/5.3-collection-management-ui)) · [DatoCMS schema-builder](https://www.datocms.com/features/schema-builder).

**Internal-tool platforms & DB studios:** [Budibase repo](https://github.com/Budibase/budibase) · [ToolJet repo](https://github.com/ToolJet/ToolJet) · [Appsmith repo](https://github.com/appsmithorg/appsmith) · [Windmill repo](https://github.com/windmill-labs/windmill) · [Supabase repo](https://github.com/supabase/supabase) (grid: archived [supabase/grid](https://github.com/supabase/grid), MIT `@supabase/react-data-grid`) · [Outerbase repo](https://github.com/outerbase/studio).

**Component libraries:** [TanStack Table](https://github.com/TanStack/table) ([column defs](https://tanstack.com/table/v8/docs/guide/column-defs)) · [react-datasheet-grid](https://github.com/nick-keller/react-datasheet-grid) · [react-jsonschema-form](https://github.com/rjsf-team/react-jsonschema-form).

**Internal cross-references:** [`05-experience-spec.md`](./05-experience-spec.md) (the locked two-world spec) · [`03-js-library-landscape.md`](./03-js-library-landscape.md) (the library/runtime landscape).
