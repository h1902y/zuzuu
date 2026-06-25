# 04 · The Query Layer

**What to add to zuzuu's query engine — and what the workbench exposes to a human — for a filesystem-native record + graph database.**

## Framing

zuzuu's Project is a **filesystem-native database**. The mapping is exact:

| Database concept | zuzuu artifact |
|---|---|
| table | **module** |
| row | **note** (markdown body + YAML frontmatter — an "envelope") |
| column | frontmatter key |
| foreign key / edge | typed `relations:` link |
| index | the lazy `node:sqlite` cache |

The decisive fact for this whole investigation: **zuzuu already has a query engine.** `src/notes/index.mjs` is a `node:sqlite` cache (notes + KV props + a typed link graph + **FTS5**), rebuilt on mtime-staleness, benchmarked at 5000 notes → 157 ms build / 13 ms search. It already does **FTS5 BM25 full-text**, **typed field filters**, **boolean field AND**, **recursive-CTE graph walks**, **aggregation**, and **ordering**. The `zz query` verb (FTS + graph walk, TOON output) is the CLI face of it.

So the question is **not** "which backend engine" — that decision is largely already made and correct. The question is two-sided:

1. **Engine layer** — is there anything worth *adding* to or *swapping into* the existing index (e.g. for graph traversal beyond what recursive CTEs do well, or analytical aggregation), under the hard constraint that the **CLI core is zero runtime dependencies** (`node:*` only) and any web-only engine must ride as an `optionalDependency` in `web/`?
2. **Workbench surface** — what does a human actually click or type in the lean Vite+React+TS SPA to find notes, traverse the graph, and save a working set? Default filters and saved views vs. a power-user query language.

The user floated **"GRIP"** as a contender. This document resolves what GRIP is, surveys the full landscape across five paradigms, and gives a split recommendation for the engine and the surface.

---

## Table of contents

1. [Executive summary](#executive-summary)
2. [Verdict: what is GRIP?](#verdict-what-is-grip)
3. [Section A — Text & filesystem search](#section-a--text--filesystem-search-grep-rg-ugrep-fd)
4. [Section B — Plain-text record stores & note-DBs](#section-b--plain-text-record-stores--note-dbs)
5. [Section C — SQL-over-files engines](#section-c--sql-over-files-engines)
6. [Section D — Graph query languages & embeddable graph DBs](#section-d--graph-query-languages--embeddable-graph-dbs)
7. [Section E — The workbench query UX](#section-e--the-workbench-query-ux)
8. [Recommendation (a): the engine layer](#recommendation-a--the-engine-layer)
9. [Recommendation (b): the workbench surface](#recommendation-b--the-workbench-surface)
10. [Open questions for the build phase](#open-questions-for-the-build-phase)

---

## Executive summary

- **The engine is already right.** zuzuu's `node:sqlite` FTS5 + recursive-CTE index strictly subsumes every text-search tool (grep/rg/ugrep/fd), every plain-text record store (recutils, Dataview, Logseq), and the embeddable SQL-over-files tools (MarkdownDB, dsq) for the data model zuzuu actually has. Across all five paradigms the verdict converges on the same phrase: **borrow the idea, avoid the dependency.** There is essentially nothing to *adopt* as a new engine.
- **The zero-dep CLI core is the decisive constraint.** Every fast searcher and graph engine is either a system binary (unreliable across platforms), a bundled native binary (breaks the guarantee — the cost Claude Code 2.1.117 had to accept bundling ugrep+bfs), a JVM/Python sidecar, or an archived project. None belongs in the core; the most any belongs is an `optionalDependency` in `web/`.
- **The workbench is the real design surface.** Independent products (Airtable, Notion, Linear, Sentry, Obsidian Bases) have **converged** on one shape: **filter chips + saved named views in a sidebar + a personal/shared split + URL-shareable state.** That convergence is the strongest signal in the research. Build it natively; it's ~500–800 lines of React/TS over the existing index, zero new core deps.
- **The recommended workbench is a three-layer stack, default-to-first:** (1) a visual **filter-chip bar + saved-views sidebar** (covers ~80% of queries, no syntax); (2) a **scoped FTS search bar** with token chips (the next ~15%); (3) a power-user **graph/predicate query** — relation chips for traversal plus an optional DQL-/Cypher-flavored text serialization that **compiles to the existing CTE+FTS SQL**, never a new engine.
- **Borrow vocabulary, not engines:** Dataview's four-clause pipeline (`TABLE … FROM … WHERE … SORT … LIMIT`) as the power-mode grammar; the Notion/Linear `field→operator→value` chip as the atomic filter; Sentry's "Suggested Queries" as the on-ramp; Datasette's URL-as-query contract for shareable views; Linear's typed Relations as the model for graph-edge filters. Saved views store as `type: view` envelope notes in `.zuzuu/` — same format as everything else, evolvable through the same propose→review loop.
- **GRIP, one line:** there is **no established tool named GRIP** for this problem — the only real "GRIP" is BMEG's bioinformatics graph server (Go, server-only, zero fit). For zuzuu, **GRIP is a name to be defined, not a tool to adopt:** it should be a *serialization format for the filter/query state* (round-trippable with the visual builder, compiling to the existing SQLite), not a new query engine.

---

## Verdict: what is GRIP?

Two findings, both pointing the same way.

**1. The only real "GRIP" is the wrong GRIP.** The one concrete project bearing the name is the **BMEG Graph Integration Platform** ([github.com/bmeg/grip](https://github.com/bmeg/grip)) — a bioinformatics **server** written in Go that wraps MongoDB/PostgreSQL/MySQL/LevelDB/Badger behind a unified graph interface. Its query language **GripQL** is a TinkerPop/Gremlin-inspired traversal DSL (`V().hasLabel("Pathway").count()`). It is MIT-licensed but: deployed as a server (`grip server --config grip.yml`), called over HTTP, **no in-process JavaScript SDK**, last meaningful release 2025, sparse activity since 2024, and domain-specific to bioinformatics. It has **zero fit** for zuzuu's zero-dep, in-process, filesystem-native context.

**2. As a general "query language" name, GRIP does not exist.** External search finds no npm package, no spec, no project named GRIP in the context of querying a filesystem-native markdown + graph database, in any of the Obsidian / Logseq / Dataview / Notion / graph-DB communities. People who say "GRIP" meaning "graph query language" almost certainly mean **openCypher / ISO GQL pattern-matching syntax**.

**Therefore the verdict: GRIP is a name to be *designed*, not a tool to *adopt*.** The right thing for zuzuu to call "GRIP" — if it wants the name — is a **compact serialization format for the workbench's filter/query state**: round-trippable with the visual filter builder (click the builder → it emits a GRIP string into the URL; paste a GRIP string → it repopulates the builder), borrowing Dataview's clause vocabulary and Cypher's relation syntax, and **compiling down to the recursive-CTE + FTS5 SQL the existing index already runs.** It is a *human-typable mirror of the filter state*, not a second engine. Do not adopt BMEG GRIP; do not call anything "GRIP" until it is defined this precisely.

---

## Section A — Text & filesystem search (grep, rg, ugrep, fd)

**The paradigm:** use a regex/line scanner as the primary query engine over the filesystem. Core loop: pattern → match → filename/line → output. The question is how far pure text + path matching goes before you need an index.

**The hard boundary:** all of these tools fail at the same wall — and that wall is exactly where zuzuu's record model begins.

| Capability needed | rg / ugrep / grep / ag | zuzuu node:sqlite FTS5 + CTE |
|---|---|---|
| FTS over note body | Yes — fast | Yes — BM25-ranked, already built |
| Filter by exact frontmatter field | Fragile multiline regex | `WHERE type = 'rule'` — exact, typed |
| Typed comparison (`date > X`) | No | `WHERE mtime > X` (stored INTEGER) |
| Boolean AND across fields in one record | ugrep `-%%` (file-scoped); rg fragile | `WHERE type='rule' AND severity='deny'` |
| Count / aggregate | No | `SELECT count(*) GROUP BY type` |
| Graph walk (related-to, module links) | No | Recursive CTE on the link graph |
| Sort by field value | No | `ORDER BY mtime DESC` |
| Ranking by relevance | No (line numbers) | BM25 built into FTS5 |
| Join (notes → module manifest) | No | `JOIN modules ON module_id` |
| Saved / named views | No | Stored query strings, trivially |
| Zero runtime dependency | grep is POSIX; rg/ugrep/fd need a binary | `node:sqlite` is Node ≥ 22 built-in |

**The structural problem with YAML frontmatter:** it spans multiple lines. A query like "notes where `type` is `rule` AND `severity` is `deny`" requires `rg -U '(?s)type: rule.*?severity: deny'` — fragile (field-order-dependent), slow (reads whole files into memory, killing SIMD), and prone to false positives across document boundaries. `ripgrep-structured` adds JSON/CSV field filtering but **explicitly does not handle YAML frontmatter in markdown**.

The Obsidian ecosystem hit this exact wall and answered it twice: **Dataview** (DQL over frontmatter), then first-party **Bases** (2025, no-code filter/sort view). **MarkdownDB** (`mddb`) made the same choice — read frontmatter, build a SQLite file, expose JS API + raw SQL. Neither uses grep/rg as the engine; both build their own index. This is the closest published prior art to what zuzuu *already* built (and does better, with FTS5 + the link-graph CTE that MarkdownDB lacks, and lazily, with no persistent `.db` file to manage).

### Comparison table

| Tool | Queries what | Syntax | Embeddable / license / footprint | Fit for zuzuu |
|---|---|---|---|---|
| **grep** | File lines (text) | POSIX regex | POSIX system binary; GPL-2+; ~0 MB | Avoid as engine; fine for one-off CLI pipelines |
| **[rg (ripgrep)](https://github.com/BurntSushi/ripgrep)** | Directory text, gitignore-aware | Rust regex + PCRE2 opt | CLI binary, MIT/Unlicense, ~5–7 MB; spawn-only from Node | Avoid; a regression vs FTS5 for record queries |
| **[ugrep](https://github.com/Genivia/ugrep)** | Files + archives + compressed | POSIX ERE + PCRE2 + boolean + fuzzy | CLI binary, BSD-3, ~5–10 MB; no Node API | Avoid; bundling cost breaks zero-dep core (Claude Code 2.1.117 bundles it) |
| **[ag (Silver Searcher)](https://github.com/ggreer/the_silver_searcher)** | Code/text, gitignore-aware | PCRE | CLI binary, Apache-2.0, ~2 MB | Avoid; superseded, no structured query |
| **[fd](https://github.com/sharkdp/fd)** | **Filenames / paths only** | Regex/glob on path | CLI binary, MIT+Apache, ~3–5 MB; npm wrapper | Avoid as engine; `node:fs` glob covers zuzuu's scale |
| **rg-structured** | JSON/CSV fields via rg | rg regex + field selector | CLI pipe; no YAML/MD frontmatter | Avoid; wrong format, incomplete |
| **[MarkdownDB (mddb)](https://github.com/flowershow/markdowndb)** | Markdown frontmatter → SQLite | JS API + raw SQL | npm, MIT, ~SQLite | Closest prior art; zuzuu already does it better in-process |
| **[Obsidian Dataview DQL](https://blacksmithgu.github.io/obsidian-dataview/)** | Frontmatter + inline fields | SQL-ish pipeline | Obsidian plugin; not extractable | Borrow DQL syntax for a query bar |
| **[Obsidian Bases](https://obsidian.rocks/dataview-vs-datacore-vs-obsidian-bases/)** (2025) | Frontmatter → no-code filter | Field/operator/value | Obsidian-native | Borrow the UX for saved views + filters |

**Section verdict:** Avoid every text-search binary as a query-engine component. The zero-dep core makes it decisive. **Borrow two ideas:** (1) the *single search input that "just works"* — the workbench should open with a plain text box firing FTS5, not a query-builder form (the `Cmd+K` pattern across Evernote/Slite/Coda); (2) the *one-click field-filter rail* (type / module / severity / mtime) that post-filters results via SQL `WHERE`. Do **not** expose raw SQL/DQL in the first surface; back the visual UI silently with SQL.

---

## Section B — Plain-text record stores & note-DBs

**Research value: high.** Substantial prior art; one near-twin (Dataview) with five years of production lessons; recutils as the formal predecessor of "typed plain-text records with a query language."

#### GNU recutils / recsel
GNU's plain-text record DB — `.rec` files are records separated by blank lines, `FieldName: Value` pairs, with a `%type`/`%key`/`%mandatory` schema block. **Structurally isomorphic to YAML frontmatter.** `recsel` takes an infix predicate (`-e "Location = 'loaned' && Year > 2000"`), operators `= != < > <= >= ~`, logic `&& || ! ()`, types `int/real/date/bool/email/url/uuid/regexp`, aggregation `COUNT/SUM/AVG/MIN/MAX`. No JOIN, no graph, no FTS. **C toolchain, GPLv3, no first-party JS port** (community parsers are experimental and don't implement the `sex` evaluator). It *proves the paradigm is sound* — but zuzuu's index already surpasses it. [Docs](https://www.gnu.org/software/recutils/manual/recutils.html) · [homepage](https://www.gnu.org/software/recutils/).

#### Obsidian Dataview DQL
~3M installs. Frontmatter keys + `[key:: value]` inline fields + `#tags` + `[[links]]` as a record model. Four query types (`TABLE/LIST/TASK/CALENDAR`) + pipeline (`FROM … WHERE … SORT … GROUP BY … LIMIT`). Link traversal via `outgoing([[page]])` / `file.inlinks`. DataviewJS is the full-JS escape hatch. **MIT, on npm, but the package hard-codes Obsidian's `app` I/O — not cleanly embeddable** without shimming. Read-only; in-process index only; performance floor on un-scoped vault-wide queries. The successor **Datacore** (React-based, plans clean npm publish) is still community beta as of mid-2026. **DQL's four-clause grammar is the right shape to borrow;** the engine is not portable. [Docs](https://blacksmithgu.github.io/obsidian-dataview/) · [structure](https://blacksmithgu.github.io/obsidian-dataview/queries/structure/) · [repo](https://github.com/blacksmithgu/obsidian-dataview) · [Datacore roadmap](https://github.com/blacksmithgu/datacore/blob/master/ROADMAP.md).

#### Logseq advanced queries (Datalog / Datascript)
Exposes the in-memory Datascript (Datalog) DB: `[:find (pull ?b [*]) :where [?b :block/scheduled ?s] …]`. **Most expressive model here** — recursive graph walks, pattern matching, pull syntax, `:result-transform`. **Datascript itself is MIT + on npm** (~150k weekly), runs in Node — but requires ingesting every note *as datoms* first, a non-trivial step. Logseq's 2025 DB version pivoted to SQLite, signaling Datascript-over-files was a performance dead end. **Famously hostile syntax** (the community built a visual builder to paper over it). No net capability gain over SQLite CTEs. [Community hub](https://hub.logseq.com/features/av5LyiLi5xS7EFQXy4h4K8/getting-started-with-advanced-queries/8xwSRJNVKFJhGSvJUxs5B2).

#### Dendron
VS Code hierarchical markdown notes. Query = fuzzy **dot-hierarchical Lookup** (`project.backend.auth`) + frontmatter attribute filters. No user-facing query language. **Abandoned upstream (2023), VS Code-coupled — a dead dependency.** The dot-hierarchy lookup *idea* maps perfectly onto zuzuu's `module:id` address scheme and is worth borrowing. [Issue #159](https://github.com/dendronhq/dendron/issues/159).

#### Notion filter/formula model
Not OSS, not embeddable — **reference UX only.** Typed properties; filters as `{property, condition, value}` triples composable with AND/OR; views = saved named (filter + sort + columns). The atomic `property → condition → value` triple — never exposing a query string to a non-technical user — is the prior art to copy. No graph traversal, flat-table only. [Filter API](https://developers.notion.com/reference/post-database-query-filter) · [views/filters/sorts](https://www.notion.com/help/views-filters-and-sorts).

### Comparison table

| Tool | Queries what | Syntax | Embeddable? / license | Fit for zuzuu |
|---|---|---|---|---|
| GNU recutils | Typed plain-text records, no graph | Infix predicate (`sex`) | No (C); GPL-3 | Low — no JS port, GPL, no graph/FTS |
| Obsidian Dataview | Frontmatter + inline + links | SQL-ish pipeline | Partial — MIT npm but Obsidian-coupled | Medium — borrow DQL grammar |
| Datacore (WIP) | Dataview + React tables | Expression subset + React | Planned npm; MIT | Medium-high *if* it ships standalone; too early |
| Logseq advanced | Blocks + pages + links (datoms) | EDN Datalog | Datascript MIT+npm; ingestion couples to Logseq | Low — hostile syntax, no gain over CTEs |
| Dendron | Hierarchical md + frontmatter | Dot-hierarchy lookup | Abandoned; VS Code-coupled | Very low; borrow the lookup UX |
| Notion filter model | Typed DB properties (flat) | `{property, condition, value}` + AND/OR + views | Not OSS | High as UX reference only |

**Section verdict:** Adopt the **DQL interaction grammar** as the mental model; adopt **none** of the engines. The four-clause pipeline implemented as a ~200-line parser compiling to parameterized SQLite gives every Obsidian user instant familiarity with zero deps. Adopt the **Notion `(property → condition → value)` chip + saved views** as the UX, the **Sentry "Suggested Queries"** on-ramp, and **Dendron's dot-hierarchy** autocomplete for the `module:id` space. Avoid Datalog (hostile, no gain), recutils (GPL/no JS), Datacore-as-dep (beta), Dendron-as-lib (dead).

---

## Section C — SQL-over-files engines

**Research value: high** — includes one direct analogue (MarkdownDB) and strong workbench-UX patterns.

#### DuckDB
In-process OLAP ("SQLite, but columnar"). Node client `@duckdb/node-api`; queries JSON/Parquet/CSV directly with `read_json('*.json')`, auto-schema, glob, nested STRUCT/LIST. WASM variant (`@duckdb/duckdb-wasm` + `@duckdb/react-duckdb`) ~3.2 MB gzipped in-browser. **MIT.** 10–100× SQLite on aggregation-heavy analytics — but zuzuu's corpus is a rounding error for FTS5 (157 ms / 13 ms at 5000 notes). **The fatal gap: YAML frontmatter is not JSON** — `note.mjs` must parse it to JSON/Parquet first, negating the "query files directly" story. Node binary is a native `.node` (~20–40 MB installed) → breaks zero-dep core; **workbench `optionalDependency` only.** [Node overview](https://duckdb.org/docs/lts/clients/nodejs/overview) · [JSON loading](https://duckdb.org/docs/current/data/json/loading_json) · [WASM](https://github.com/duckdb/duckdb-wasm).

#### Datasette
Python tool wrapping any SQLite file → browseable HTML UI (faceted filters, SQL editor, canned queries) + auto JSON REST API. **Strongest conceptual model for the workbench SQL surface:** SQL reflected in the URL (bookmark/share), named params → form fields, `?_facet=column` chips, stored canned queries. It could serve zuzuu's `.zuzuu/index.db` *immediately* with zero schema change. **Apache 2.0, but Python runtime + ~15 transitive deps** → fatal for a Node-first local-first install; sidecar-only. **Borrow the UX contract; don't import it.** [SQL queries](https://docs.datasette.io/en/latest/sql_queries.html) · [facets](https://docs.datasette.io/en/latest/facets.html) · [home](https://datasette.io/).

#### Steampipe
Embedded PostgreSQL + Go plugins exposing APIs/files as virtual tables. No YAML/frontmatter plugin (would need a Go plugin). **AGPL-3 core + ~80 MB Go binary + embedded Postgres** → maximum impedance mismatch, overkill by two orders of magnitude. Avoid. [CSV plugin](https://hub.steampipe.io/plugins/turbot/csv).

#### dsq / q / OctoSQL / textql / csvq
CLI-only ad-hoc SQL over flat files. **[dsq](https://datastation.multiprocess.io/blog/2022-01-11-dsq.html)** (MIT, SQLite-backed), **q** (GPL-3), **[OctoSQL](https://github.com/cube2222/octosql)** (MPL-2, custom engine, stale 2024), **textql** (MIT), **csvq** (Go). **None parse YAML frontmatter, none have a graph model, none embeddable in Node.** Useful only as `zz query | dsq` one-off glue, unusable as a workbench surface.

#### MarkdownDB (`mddb`) — direct prior art
MIT/npm/TS. Parses markdown → frontmatter + tags + links + tasks into SQLite via Knex; JS API (`getFiles()` with frontmatter filters, `getLinks({fileId, direction})`). **Structurally nearly identical to what zuzuu built independently** — and zuzuu's `notes/index.mjs` exceeds it (FTS5 + recursive-CTE graph that `getLinks()` lacks). Validation that zuzuu's substrate design is independently correct; not a dependency candidate. [Repo](https://github.com/flowershow/markdowndb).

### Comparison table

| Tool | Queries what | Syntax | Embeddable / license / footprint | Fit for zuzuu |
|---|---|---|---|---|
| **DuckDB** | JSON/CSV/Parquet, in-process | SQL + file fns | npm `@duckdb/node-api`, native ~30 MB; MIT | Workbench optional-dep only; blocked by frontmatter≠JSON |
| **DuckDB-WASM** | Same, in-browser | SQL | `@duckdb/duckdb-wasm`; ~3.2 MB gz; MIT | Viable for browser "Power SQL" over an exported snapshot |
| **Datasette** | SQLite `.db` | SQL + URL params | Python sidecar; Apache-2.0; ~15 Py deps | Best UX analogue; Python breaks local-first install |
| **Steampipe** | APIs + files via Go plugins | SQL (Postgres) | AGPL + ~80 MB | Incompatible — license, runtime, overkill |
| **dsq** | JSON/CSV/Parquet (flat) | SQL | CLI-only; MIT | No frontmatter/graph; no embed |
| **OctoSQL** | JSONLines/CSV/Parquet/DBs | SQL | CLI-only; MPL-2; stale | No frontmatter/graph; no embed |
| **MarkdownDB** | Markdown + frontmatter + links | JS API + SQLite | npm; MIT | Validates design; superseded by `index.mjs` |

**Workbench UX patterns observed** — two dominant shapes: **A) SQL editor + schema sidebar** (Sigma/Snowflake/Neon/Retool — left tables, center SQL textarea, results below, "By you / By your team" saved-queries) and **B) table browser + filter chips** (Neon Tables/Attio/Clay — `where price less 30` dismissible chips, `+ Add filter`/`Clear filters`, Fields toggle). Reference Mobbin screens: [Stripe SQL editor saved queries](https://mobbin.com/screens/6d5b40cb-8a0b-46bf-a9d6-ad2b3d75e3c6) · [Neon table filter chips](https://mobbin.com/screens/926541e1-1d12-4677-8faf-54193a709b17) · [Retool query library](https://mobbin.com/screens/68441054-0ffc-4831-ad77-9879d8aa7c74) · [Neon SQL editor + history](https://mobbin.com/screens/19f03563-37d7-4366-8be2-bb61492ad472).

**Section verdict:** **Borrow the idea, adopt nothing as a core dep.** **DuckDB-WASM** is the *only* candidate for adoption — gated behind an optional "Power SQL" workbench mode for analytics (window functions, big GROUP BY pivots) the SQLite index does less well, querying an exported snapshot; it can never replace the index (frontmatter≠JSON). **Datasette** is the UX contract to copy natively (URL-as-query, facet chips, canned queries) — not import. The core insight: **zuzuu already has the hardest part.** The high-leverage move is a thin React SQL/filter pane in the workbench talking to the existing `node:sqlite` index via the Hono daemon.

---

## Section D — Graph query languages & embeddable graph DBs

**On GRIP** — see the [verdict](#verdict-what-is-grip) above. BMEG GripQL is a Gremlin-inspired traversal DSL on a Go server; zero fit. The four real paradigms:

#### 1. Cypher / openCypher / ISO GQL — via Kuzu
Declarative ASCII-art pattern matching, now ISO/IEC 39075 GQL (2024); SQL/PGQ embeds the same in SQL. The relevant *embeddable* impl is **[Kuzu](https://github.com/kuzudb/kuzu)** ("DuckDB for graph": in-process, column-oriented, MIT, Node N-API bindings, cited ~374× Neo4j on path queries). **What Cypher does that recursive CTEs cannot do cleanly:** (a) **mid-traversal node-type predicates** ("all paths from this action to a guardrail where every intermediate node is `status: approved`"); (b) **variable-length weighted paths** for ranking relation chains; (c) **named paths as return values** (the full edge sequence); (d) **graph-wide pattern aggregation**. SQLite CTEs handle depth-limited BFS well to ~50k nodes but break down at depth > 4 / branching > 10 and can't express "all cycles" / "all shortest paths" in one query. **Critical: `kuzudb/kuzu` was archived Oct 10, 2025** (last stable 0.11.3); active forks are **[RyuGraph](https://github.com/predictable-labs/ryugraph)** and a **[Vela Engineering fork](https://github.com/Vela-Engineering/kuzu)** (claims concurrent multi-writer, still MIT). Binary is hundreds of MB across platforms → `optionalDependency` only. `@kuzu/kuzu-wasm` exists for browser. [Data Quarry benchmark](https://thedataquarry.com/blog/embedded-db-2/).

#### 2. Gremlin / Apache TinkerPop
Imperative traversal pipeline. The `gremlin` npm package is a **client** to a remote Gremlin **Server (JVM)** — no embeddable in-process JS engine. Flatly incompatible with zuzuu's in-process zero-dep philosophy. **Skip.** [TinkerPop](https://tinkerpop.apache.org/) · [npm](https://www.npmjs.com/package/gremlin).

#### 3. SPARQL / RDF
W3C triple-store query. zuzuu's graph is a **property graph** (nodes with arbitrary props, typed labeled edges), not RDF triples — mapping `relations:` to triples needs a verbose translation layer. `oxigraph` (Rust/WASM, MIT) exists but the data-model mismatch costs more than the queries. **Wrong data model. Skip.**

#### 4. SQL/PGQ — graph pattern matching inside SQL
ISO/IEC 9075-16:2023 adds `GRAPH_TABLE`/`MATCH` to SQL; **DuckDB implements it (v0.10, 2024)**. Declarative Cypher-style matching while staying in SQL — no new language. But it means two embedded DBs (SQLite primary + DuckDB analytical). **Viable future direction *if* DuckDB is adopted anyway; not worth adding solely for graph queries.** [ISO/IEC 9075-16](https://www.iso.org/standard/79473.html).

### Comparison table

| Tool | Queries what | Syntax | Embeddable / license / footprint | Fit for zuzuu |
|---|---|---|---|---|
| **Cypher / Kuzu** | Property graph | Declarative pattern matching, var-length paths | Node N-API; MIT; hundreds MB; **archived Oct 2025** | High expressiveness; optionalDep only; archive risk |
| **Cypher / RyuGraph or Vela fork** | Same | Same | Active forks; MIT | Mitigates archive risk; fork-tracking burden |
| **Gremlin / TinkerPop** | Property graph (server) | Imperative traversal | npm client only; Apache-2; needs JVM | Zero fit |
| **GRIP / GripQL (BMEG)** | Bio property graph | TinkerPop-style; Go server | Server only; MIT; no Node embed | Zero fit — bioinformatics server |
| **SPARQL / oxigraph** | RDF triples | Triple pattern match | WASM; Apache-2 | Data-model mismatch |
| **SQL/PGQ / DuckDB** | Tables as graph views | SQL + GRAPH_TABLE/MATCH | Node N-API; MIT; ~25 MB | Good *if* DuckDB adopted; complex as add-on |
| **Recursive CTE / SQLite** | The existing index | `WITH RECURSIVE` + BFS | **Zero-dep; built-in** | Already shipped; breaks at depth >4 / branching >10 / mid-path type filters |

**Section verdict:** **Do not adopt Kuzu or any external graph engine now** — repo archived, forks too young, hundreds-of-MB footprint, and at realistic scale (hundreds–few thousand notes) the CTE ceiling is rarely hit. **Borrow Cypher's vocabulary** as a human-facing language: a **mini-pattern parser** (`MATCH (n:type)-[:relation]->(m)`) in `use/query.mjs` compiling to a recursive CTE (~200 lines, zero deps) + a **workbench relation-filter chip** (Linear's "Blocked by / Parent" model applied to open `relations:`). **If graph traversal ever becomes a genuine bottleneck**, the migration path is **DuckDB + SQL/PGQ** (one MIT dep, actively maintained) — *not* Kuzu's fork situation. Mobbin: [Reflect Map graph canvas](https://mobbin.com/screens/0e1be504-3f40-4cd2-8968-091212a155e5) · [Neon faceted filter](https://mobbin.com/screens/926541e1-1d12-4677-8faf-54193a709b17) · [Notion DB views](https://mobbin.com/screens/2782ff37-3d5d-4a04-93a6-13f63548aaaf).

---

## Section E — The workbench query UX

**The real question:** what does a human type or click in the zuzuu workbench? Three structural approaches exist in the wild.

#### 1. Faceted filters + saved views (Airtable / Notion / Linear / Obsidian Bases)
Visual `[field] [operator] [value]` conditions that stack; name the result → saved view in the sidebar. No syntax. Queries flat record properties (not graph walks).
- **Airtable** ([filter builder](https://mobbin.com/screens/13b59693-465d-451e-ac5c-942be0fc3a3f)): floating `Where [field] [is] [value]` panel, Add condition/group, named views sidebar (Grid/Calendar/Gallery/Kanban/List/Gantt), Collaborative vs Personal. [Views docs](https://support.airtable.com/docs/getting-started-with-airtable-views).
- **Notion** ([filter popover](https://mobbin.com/screens/8ff7ae4b-40f0-4d9b-bb30-611469098554)): per-view filters; quick filters personal until saved; 2025 "Databases reimagined" unified filter/sort/group. [Views docs](https://www.notion.com/help/views-filters-and-sorts).
- **Linear** ([chip bar](https://mobbin.com/screens/31054326-d694-4056-9456-8063654299fe), [menu](https://mobbin.com/screens/460e7846-9225-4c6a-b895-16c50352615d), [saved views](https://mobbin.com/screens/7e48f41c-5f98-4a2b-8e2c-f397d5abfd5b)): toolbar filter pills with `×`; **Relations (Blocked by / Parent / Sub-issue) are first-class filter dimensions — the closest analog to graph traversal in any tool**; "AI Filter" NL→filter; Personal vs Shared saved views; Match all/any (AND/OR) toggle. [Filters docs](https://linear.app/docs/filters).
- **Obsidian Bases** (2025): visual no-code table over frontmatter, edits write back to YAML; **only table views, only property data — body text and the link graph are unreachable.**

#### 2. Raw query language (Dataview DQL / SQL editor / Datalog)
The user writes text; the engine executes. **DQL**: `TABLE|LIST … FROM … WHERE … SORT … LIMIT`; no recursive graph walk, read-only, degrades on big vaults. **Datalog** (Logseq): expressive for graph, **hostile to non-experts** (community built a [visual query builder](https://adxsoft.github.io/logseqadvancedquerybuilder/)). **SQL editor** (Metabase visual builder → pick table → Filters → Summarize → Visualize; [Supabase](https://mobbin.com/screens/c70cd149-0681-49b0-912b-9701508c96c4), [Stripe Sigma](https://mobbin.com/screens/1db36ed4-866a-40ab-a976-5f03a55bc16e)). A CodeMirror SQL editor (`@codemirror/lang-sql`, MIT, ~50 kb) is a reasonable *optional* workbench dep, executing against the existing index over the existing wire. **Raw SQL/DQL as the default surface is dead-on-arrival for non-experts** — it creates a two-class workbench. [Metabase builder](https://www.metabase.com/features/query-builder).

#### 3. Command-palette / natural-language
Single input → fuzzy FTS, or LLM NL→filter. **monday.com "Search Everything"** ([screen](https://mobbin.com/screens/984db5d6-98cb-4386-9137-d85deccc08e6)): FTS + inline facet panel. **Sana AI** ([screen](https://mobbin.com/screens/11c062cb-dac2-44b5-851c-d4489adfc740)): source-scope chips ("2 sources / Commercial / After 1 Mar 2024") as inline filter tokens. **Linear AI Filter / Amplitude** ([screen](https://mobbin.com/screens/94cd24b3-0425-4ffa-85c8-60ff86ecd2be)): NL → structured filter objects (same output as clicking). NL is non-deterministic, opaque, needs the schema at query time, and a network call → **optional accelerator, not the default.**

### Comparison table

| Paradigm | Queries what | Interaction | Dep / license | Fit |
|---|---|---|---|---|
| Airtable / Notion filter builder | Flat record props | Visual field/op/value | Pattern freely copyable | High (borrow) |
| Linear filters + AI Filter | Props + typed Relations | Visual chips + NL | Copyable; AI optional | High for chips |
| Obsidian Bases | Frontmatter only (no body/graph) | Visual, no code | MIT plugin | Partial — wrong scope for graph |
| Dataview DQL | Frontmatter + 1-hop links | SQL-like text | MIT, ~300 kb, Obsidian-coupled | Power users only |
| Logseq Datalog | Block graph | EDN Datalog | AGPL | Avoid — hostile |
| Metabase builder | SQL tables | Visual pick→filter→summarize | AGPL; JVM ~200 MB | Avoid — wrong runtime |
| CodeMirror SQL editor | Raw SQLite schema | Raw SQL | MIT ~50 kb optional | Power escape hatch only |
| Command palette + FTS | Full text | Text input, BM25 | Built-in | Already exists (`zz query`) |
| Scoped chip search (Sana/monday) | FTS + property scopes | Word → chip suggestions | Pure UI, zero dep | High (borrow) |
| NL → structured filters (LLM) | Whatever filters support | Free text → filter object | Optional LLM call | Optional layer |

**Section verdict — the three-layer stack, default-to-first:**
- **Layer 1 (default, always visible):** filter-chip bar + saved-views sidebar. Chips = `[field][op][value]` triples over frontmatter; field picker autocompletes existing keys; operators are type-aware; AND/OR toggle. Sidebar = named saved views, personal (`.zuzuu/.local/`, gitignored) vs shared (`.zuzuu/`, tracked). The Airtable/Linear model on zuzuu's envelope schema.
- **Layer 2 (revealed):** FTS search bar with chip tokens — type → BM25 over bodies, suggested chips (`type:action`, `module:memory`, `has:relations`) compose FTS + property filters in one input (Sana/monday model). Shares state with Layer 1.
- **Layer 3 (power-user, hidden):** graph traversal — relation chips (`[links to][note-picker]`, Linear's Relations model) for 90% of graph queries with no syntax, plus an optional DQL-/Cypher-flavored text input that **compiles to the existing CTE+FTS SQL**. The workbench URL *is* the saved view — shareable, bookmarkable, diffable.

**Do NOT build:** a full SQL editor as the default; Datalog; an LLM-only NL bar as primary; embedded Metabase/Retool/Glide. Net new footprint for Layers 1–3: ~500–800 lines React/TS, **zero new npm deps** for the default path; optional CodeMirror only if a raw-SQL debug panel is ever added.

---

## Recommendation (a): the engine layer

1. **Keep the `node:sqlite` FTS5 + recursive-CTE index as the single source of truth.** Across all five paradigms the engine verdict is unanimous: **there is nothing to adopt.** The existing index equals or exceeds text search, plain-text record stores, SQL-over-files, and graph engines for the data model zuzuu actually has — and it is already in-process, zero-dep, and benchmarked. **One index, one query path.** Introducing any second engine creates a second source of truth for index state — the thing to avoid.

2. **Add two thin, dependency-free parsers in `use/query.mjs`** (the right home — the CLI core stays zero-dep, and `zz query` + the workbench both ride it):
   - a **DQL-flavored clause parser** (`TABLE/LIST … FROM … WHERE … SORT … LIMIT`, ~200 lines) compiling to parameterized SQLite — instant familiarity for Obsidian users;
   - a **mini-Cypher relation-pattern parser** (`MATCH (n:type)-[:relation]->(m)`, ~200 lines) compiling to a recursive CTE — declarative graph queries without an engine.
   Both are *human-typable mirrors of the visual filter state* — i.e. this is what zuzuu should mean by **"GRIP."**

3. **Reserve exactly one optional, web-only engine for the future: DuckDB** (`@duckdb/duckdb-wasm` in `web/` as an `optionalDependency`), gated behind a "Power SQL" mode for analytical queries (window functions, large GROUP BY pivots) over an exported index snapshot. It can **never** read `.md` directly (frontmatter≠JSON) and never replaces the index. If graph traversal later becomes a real bottleneck, **DuckDB + SQL/PGQ is the migration path — not Kuzu** (archived, fork-risk, heavy).

4. **Avoid as engines:** all text-search binaries (zero-dep core); recutils (GPL, no JS); Datalog/Datascript (hostile, no gain); Kuzu/Gremlin/SPARQL/Steampipe/Datasette-as-runtime (archive risk / JVM / Python / AGPL — all wrong for a Node-first local-first tool).

## Recommendation (b): the workbench surface

**Build the three-layer stack natively in the Vite+React+TS SPA.** The cross-product convergence (Airtable, Notion, Linear, Sentry, Obsidian Bases) is the strongest signal in the research — the pattern is settled; implement it, don't import it.

1. **Layer 1 — visual filter-chip bar + saved-views sidebar (the default; ~80% of queries).** `(field → operator → value)` chips over frontmatter, type-aware operators, AND/OR toggle, `+ Add filter`. Saved views stored as **`type: view` envelope notes in `.zuzuu/`** — same format as everything else, queryable by the index, evolvable through the propose→review loop. Personal (`.zuzuu/.local/`, gitignored) vs shared (tracked), per Linear. Seed **Sentry-style "Suggested Queries"** (`pending proposals · guardrail rules · recent notes · open sessions`) as the on-ramp.

2. **Layer 2 — scoped FTS search bar with token chips (~15%).** Plain text → BM25 over bodies; suggested scope chips compose FTS + property filters in one input; **Dendron-style dot-hierarchy autocomplete** for the `module:id` space (`guardrails.` surfaces the module's notes without a WHERE clause).

3. **Layer 3 — graph + power query (the differentiator, hidden by default).** Relation chips (`[links to][note-picker]`, Linear's typed-Relations model) over `relations:`, plus an optional **DQL-/Cypher-flavored "GRIP" text input** that round-trips with the visual builder and compiles to the existing CTE+FTS SQL. **The workbench URL is the saved view** (Datasette's URL-as-query contract) — shareable, bookmarkable, diffable. Optionally, a "Related" expander on any note row firing the recursive-CTE graph walk inline; and a graph-canvas view (D3/vis-network over the `zz query` JSON) for visual traversal.

**Do NOT** make raw SQL/DQL the first surface, expose Datalog, default to an LLM NL bar, or embed Metabase/Retool/Glide. The zero-dep CLI core is untouched; only `web/` changes, and it already carries React + Vite.

---

## Open questions for the build phase

1. **Saved-view storage shape.** `type: view` envelope notes in `.zuzuu/` (elegant, self-hosting, evolvable) vs a flat `.zuzuu/views.json`. The envelope route is on-brand ("everything is an envelope") but means views show up in note queries — desirable or noise? Personal/shared split: `.zuzuu/.local/` (gitignored) vs `.zuzuu/` (tracked) — confirm against the home deny-rule policy (`.zuzuu/.live/**` only).

2. **Define "GRIP" precisely, or drop the name.** If kept, GRIP = the *serialization format* for filter/query state (round-trippable with the builder, compiling to SQLite). Pick one grammar: DQL-flavored (`FROM … WHERE … SORT`) vs Cypher-flavored (`MATCH … RETURN`) vs a hybrid. The doc leans DQL-for-records + mini-Cypher-for-graph — is one unified syntax better than two?

3. **Graph-query ceiling — when (if ever) does it bite?** Validate the depth-4 / branching-10 CTE ceiling against a real dense module from the observe loop (e.g. co-invocation edges). Only if it bites does DuckDB+SQL/PGQ enter — otherwise CTEs stay.

4. **Type-aware operator catalog.** Frontmatter is schema-less; operators must be inferred per key (text → contains/matches; date → before/after/within; enum → is/is-any-of). How is the per-key type detected — sampling values from the index, a module-manifest schema declaration, or both?

5. **Power-SQL mode threshold.** Is DuckDB-WASM worth the ~3.2 MB + optional-dep complexity for analytics the SQLite index handles adequately at zuzuu's scale? Likely defer until a concrete analytical need appears.

6. **NL→filter accelerator.** A Linear-style "AI Filter" (NL → filter chips, *editable*, not opaque results) is attractive but adds an LLM call. In-scope for v1, or a later optional layer? The host already has a model — could it serve this without a new dep?

7. **Wire-protocol shape.** The query request crossing the Hono/ws daemon boundary: send a structured filter descriptor (safe, validatable) vs a raw query string (flexible, injection-surface). Likely descriptor for Layers 1–2, gated raw string for Layer 3.

8. **CLI ↔ workbench parity.** Should `zz query` gain the same saved-view and DQL/GRIP grammar so the CLI and workbench share one query language end-to-end, keeping the surfaces from drifting (the daemon↔CLI drift already noted in MEMORY.md)?
