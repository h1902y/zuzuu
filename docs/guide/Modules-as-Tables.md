# Modules as tables

**A module is a table. A note is a row. The frontmatter keys are the columns.** This page is the working guide to that idea — schema, typed columns, computed columns, queries, rollups, saved views, and bulk import/export.

Everything below is plain markdown on disk. The "table" is a rebuildable `node:sqlite` index over your files — you can always just open the folder.

## Declare a schema (or don't)

A module with no `fields` block in its `module.md` is **schemaless** — any frontmatter goes. Declare columns when a shape stabilizes:

```bash
zz module add-column crm company text --required --label "Company"
zz module add-column crm stage select --options lead,won,lost --default lead
zz module add-column crm tier number --default 3
zz module drop-column crm fax
zz module alter-column crm tier --required
```

- **8 column types**: `text · longtext · select · multi · link · date · number · bool`.
- **`--required`** — a row missing it is refused at the write boundary (never lands malformed).
- **`--options a,b`** — the allowed values for `select`/`multi`.
- **`--default v`** — fills the column on `zz note create` when absent.
- **`--label l`** — the display name a UI renders (forms stop guessing from key names).
- Every schema change **mints a generation** (a git commit) — `zz gen rollback` undoes it, rows and schema together.
- Undeclared keys still round-trip untouched: the schema validates its columns, it doesn't forbid others.

## Computed columns

A column can be **derived at index time** — never written into the note file, but filterable/sortable like any stored column:

```bash
zz module add-column actions end_date date --computed 'dateAdd(start_date,duration_days)' --label "Window end"
```

`dateAdd(<dateField>, <numberField>)` is the first builtin: `end_date = start_date + duration_days` days. Now "active today" is one query:

```bash
zz query actions --where "start_date<=2026-07-02" --where "end_date>2026-07-02" --where "status=active"
```

## Rows: create · edit · delete

```bash
zz note create crm acme --type account --field company="Acme Corp" --field tier=1
zz note create crm acme --force ...            # upsert: replace an existing row
zz note create crm --batch '[{"id":"a1","type":"account","company":"A1"}, …]'   # many rows, ONE generation, all-or-nothing
zz note set crm acme stage won                 # one field (coerced by its declared type)
zz note append crm acme "Called them today."   # append to the body
zz note delete crm acme
zz note rename crm acme acme-corp              # rewrites every inbound link
zz note fold crm acme-old acme-corp            # merge two rows, re-point referrers
```

These are **your** lane — instant, but never unsafe: every one is schema-validated, provenance-logged, and minted through the same single write boundary the agent's gate uses. (The agent cannot call any of these — see [Two lanes](Two-Lanes).)

## Query v2

```bash
zz query crm "acme"                       # FTS + id substring, BM25-ranked
zz query --all "retro"                    # cross-module, the whole project
zz query crm --where "tier>=2" --where "stage!=lost"
zz query crm --group-by stage             # rollup: rows per stage
zz query crm --group-by stage --agg sum:tier
zz query crm --to crm:acme                # backlinks: who links here
zz query crm --from crm:acme --depth 2    # graph walk
zz query crm --as-of 3                    # time travel: the table at generation 3
```

- `--where` operators: `=` `!=` `>` `<` `>=` `<=`. A numeric operand compares numerically; everything else lexicographically — which is exactly right for ISO dates.
- `--agg` functions: `count` (default) · `sum:field` · `avg:field` · `min:field` · `max:field`.
- Add `--json` anywhere for machine output.

## Saved views — views are notes

A view is a row like any other (`type: view`) whose `query:` map carries the parameters. Being data, it's versioned, shareable, and reviewable like everything else:

```bash
zz note create crm view-pipeline --change '{
  "type": "view", "title": "Open pipeline by stage",
  "query": { "module": "crm", "where": ["stage!=lost"], "group-by": "stage" }
}'
zz query --view crm:view-pipeline
```

The `query` map accepts `module · text · type · status · tag · where` (a list of `"key<op>value"` strings) `· group-by · agg · limit`. Command-line flags override the view's saved values.

## Import & export

```bash
zz module export crm > crm.json           # every row, lossless (custom columns ride)
zz module export crm --csv > crm.csv      # RFC-4180; lists/objects as JSON cells
zz module import crm --csv leads.csv      # bulk rows: ONE generation, all-or-nothing, schema-validated
zz module import crm --json rows.json --force
```

Import goes through the same batch-create as `--batch`: any invalid row reverts the whole file, and the agent is denied the verb entirely.

## One table over everything

Modules are tables — but they aren't silos. `zz module items --all` serves EVERY
module's rows through the same filter/sort/paginate contract, each row carrying
its module:

```bash
zz module items --all --limit 20 --json          # the whole Project, one page
zz module items --all --type activity --json     # filters compose across modules
```

In the workbench this is the **Everything** view: one grid over the whole
Project, module as a column (with its island color dot), module/type/status
facet chips to narrow. Press `T` and the same lens becomes a spotlight across
the whole World — a module facet lights one island whole. The per-module
tables remain (a module still has its schema and its own grid, one chip-click
away); they're just not navigation anymore.

## The workbench grid

Both the per-module table and Everything render through the same native grid
(`NotesTable`): identity is the id (never a blank first cell), a row-number
rail that reveals a checkbox on hover, field-type glyphs in every header, and
one elastic **Attributes** cell on heterogeneous rows so no frontmatter key is
ever unreachable — click a chip and it becomes a filter clause.

**Filtering, one grammar, three entry points** (§H.3.1). Type into the filter
box: free text live-filters via FTS as you type; a `key<op>value` shape (or
`#tag`) commits on Enter as a dismissible **where clause** instead — the same
grammar `--where` speaks on the command line. Click an Attributes chip and it
becomes the same clause. Or open the **[Filter]** button's anchored panel
(field/op/value + "+ add condition") — builder and typed input write the
identical state, so the chip row below the toolbar is always the complete,
honest picture of what's narrowing the table.

**Group and sort** (§H.3.3/§H.4.3). The **[Group]** button picks a column;
rows collapse into sections with a count and, for numeric columns, a per-group
Σ. The **[Sort]** button picks a field + direction directly (column-header
click still cycles asc/desc the same way it always did). Group-by is
client-side over the currently loaded page — there's no daemon route for
`--group-by`/`--agg` through `module items` yet (only `zz query` has it, see
above), so a multi-page group under-counts; a true cross-page aggregate is a
follow-up once that route exists. The footer bar below the table always shows
the row count, plus the loaded page's numeric Σ.

**Selection is context, the omnibar is the verb** (§H.3.4). Hover a row and
its checkbox appears (or press `x` while hovering to toggle it) — no bulk
action lives as table chrome. Once anything is selected, a **Selection** group
appears at the top of the omnibar (⌘K): *Export N as CSV* (instant, from the
rows already loaded) and *Delete N selected* (a proposal — it loops the
existing per-row delete through the gate, one at a time; there's no single
all-or-nothing batch generation yet, a noted gap).

Cells stay read-only everywhere: click one and, wherever wired, it pre-fills
the omnibar's `set` verb instead of editing in place — one write door in the
UI, matching the one write door in the engine. Row expansion (the chevron)
opens the same `NoteDocument` the Record stage and the omnibar's detail pane
render — one detail grammar, every container.

## See it

`zz module items crm` is the table read (filter/sort/paginate server-side); `zz module items --all` is the whole Project as one table; `zz host web` renders both as grids — and as islands in [the World](The-World).
