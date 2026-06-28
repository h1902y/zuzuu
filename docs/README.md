# The docs map — read this first

zuzuu's documentation grew by accretion, so the same information ended up in several
places. This file is the **information architecture**: where every kind of information
lives, for whom, and the rule that keeps it from drifting. Read it to find the right
doc; **maintain it when you add one.**

## The rule (MECE)

> **Each kind of information has exactly ONE canonical home. Every other mention is a
> cross-reference — never a copy.** Docs are organized first by **audience**, then by
> **purpose**. If you're tempted to restate something, link to its home instead.

Mutually exclusive (no two docs own the same thing) · collectively exhaustive (every
thing has a home). When a new info-type appears, give it one home and add a row below.

## Audiences → surfaces

| Audience | Reads | Surface |
|---|---|---|
| **User** — runs zuzuu | how to use it | **the wiki** (`docs/guide/` → the GitHub `/wiki` tab) |
| **Contributor** — works on the code | how it works · why | `docs/` · `README.md` · `src/README.md` |
| **Agent** (Claude Code in this repo) | the architecture map | `CLAUDE.md` |
| **Strategy** — direction & rationale | why · what we decided | `docs/DESIGN.md` · the Decision Log |

(Contributor and Agent overlap: `CLAUDE.md` is the agent's map but contributors read it too.)

## Canonical homes — where each thing lives

| Information-type | The ONE home | Audience | Does **not** contain (it links instead) |
|---|---|---|---|
| What it is · quickstart · "where to find X" | **`README.md`** | everyone (front door) | architecture, the decisions list, user how-tos |
| The vocabulary — load-bearing **terms + relations** (the registry) | **`README.md` § The model** | all | overloaded/code-internal terms (→ learn glossary), user phrasing (→ wiki Glossary) |
| **Overloaded / code-internal** term disambiguation | **`docs/learn/glossary.md`** | contributors | the core definitions (→ README "The model") |
| The vocabulary in **plain language** (user view) | **`docs/guide/Glossary.md`** | users | the precise/canonical defs (→ README "The model") |
| How to **use** it — the guide *pages* (tasks · per-host · workbench · troubleshooting) | **the wiki** (`docs/guide/`) | users | architecture, deep rationale (the Decision/Inspiration logs & Roadmap are their own rows below — also sourced from `docs/guide/`) |
| How it **works** — the code map | **`CLAUDE.md`** | agent + contributors | decision *rationale/status* (→ Decision Log; keeps only a terse title index), the why (→ DESIGN), definitions (→ glossary) |
| How it **works** — the educative walk | **`docs/learn/`** (lessons 00–09) | contributors | — |
| The `src/` layout | **`src/README.md`** | contributors | — |
| **Why** — hypothesis & strategy | **`docs/DESIGN.md`** | strategy | the decisions list (→ Decision Log), prior art (→ inspiration) |
| **What we decided** (committed decisions) | **the Decision Log** (`docs/guide/Decision-Log.md`) | all | rationale prose (→ DESIGN) |
| **What shaped it** (prior art, deep) | **`docs/inspiration/`** | contributors | — |
| Prior art — the readable index | **the Inspiration Log** (`docs/guide/Inspiration-Log.md`) | all | the audits themselves (→ `docs/inspiration/`) |
| **History** — the dated build journal | **`docs/LOG.md`** (append-only) | all | — |
| **Future** — unshipped designs | **`docs/specs/`** | contributors | — |
| Future — the user-facing roadmap (index) | **the Roadmap** (`docs/guide/Roadmap.md`) | users | the detailed designs (→ `docs/specs/`) |
| In-flight **working artifacts** (transient) | **`docs/{brainstorms,ideation,plans,design-research}/`** | the author | — (scratch, not canonical reference) |

The wiki is **generated from `docs/guide/`** on merge (see `docs/guide/README.md`) — so
the Decision/Inspiration/Roadmap "wiki pages" are in-repo, reviewed, and shared by both
the user (rendered) and contributor (source) audiences. One source, two surfaces.

## The full surface inventory

**Reference (canonical) docs**
- `README.md` — front door: the pitch, the loop, "The model" (term relations), and a pointer here.
- `CLAUDE.md` — the architecture map for the agent (the `src/` structure + conventions).
- `src/README.md` — the code-layout map.
- `docs/learn/` — the educative walk: lessons `00`–`09`, `glossary.md` (overloaded/code-internal
  term disambiguation — the canonical registry is README "The model"), `reading-the-code.md`,
  `the-terminal-mechanically.md`, `README.md` (the book's index).
- `docs/DESIGN.md` — strategy & rationale (the *why*).
- `docs/LOG.md` — the append-only build journal (history).
- `docs/inspiration/` — the prior-art research shelf (the deep audits).
- `docs/specs/` — live specs for unshipped work.

**The wiki source** (`docs/guide/` → the GitHub `/wiki`; never edit the wiki repo directly)
- The user guide: `Home`, `Getting-Started`, `Workbench`, `Guardrails`, `Troubleshooting`,
  the module pages, the per-host pages (`Claude-Code`/`Codex`/`Gemini-CLI`/`OpenCode`/`pi`).
- The cross-audience canon: `Decision-Log`, `Inspiration-Log`, `Roadmap`, `Glossary` (user view).
- `_Sidebar.md` (wiki nav) · `README.md` (the publish model; not published).

**Working artifacts** (in-flight, not canonical reference)
- `docs/brainstorms/` — requirements docs (ce-brainstorm). Tracked.
- `docs/ideation/` — early exploration. Tracked.
- `docs/plans/` — execution plans (ce-plan). **Gitignored** (local-only).
- `docs/design-research/` — the workbench redesign briefs (a specific research effort).

## How this map was reached (the consolidations applied)

The docs had grown the same info-type into 3 places. The restructure that produced the homes
above — done in the same change as this map (so the table reflects reality, not a plan):

1. **Glossary 3 → distinct roles.** The canonical term registry stays **README "The model"** (the
   front-door nomenclature, unchanged). `docs/learn/glossary.md` was scoped to *overloaded /
   code-internal* terms — it disambiguates and links to the registry, never redefining a core term.
   The wiki `Glossary.md` is a plain-language *view* that links to the registry. Registry / disambiguator
   / plain-view — three distinct purposes, zero duplicated definitions.
2. **Decisions 3 → 1.** The Decision Log is canonical (the committed-decisions list with rationale +
   status). `CLAUDE.md` keeps a terse **title index** (titles only, no rationale/status) + a pointer;
   `DESIGN.md` points to it. The *list with rationale* lives once.
3. **Prior art 3 → 1 (+index).** `docs/inspiration/` is the canonical deep shelf; the Inspiration Log
   is its readable index; `DESIGN.md`'s §11 points there and keeps only its strategic synthesis.
4. **Roadmap / future.** The wiki Roadmap is the user-facing index; items with a `docs/specs/` design
   link to it. No design detail duplicated in the Roadmap.
5. **Architecture overlap.** `CLAUDE.md` = the map, `docs/learn/` = the walk, `README.md` = the planes;
   `DESIGN.md`'s v1 architecture sections point to CLAUDE/learn via its top banner (the *why* stays).
6. **Working folders.** `brainstorms/ · ideation/ · plans/ · design-research/` are named here as
   transient working artifacts — `design-research/` is kept as a dated research effort (not folded).

## Adding a doc — keep it MECE

1. Find the info-type in the canonical-home table. Put the content in **that** home.
2. Need it visible elsewhere? **Link**, don't copy.
3. New info-type with no home? Give it one and **add a row above** — that's the only way this map stays collectively exhaustive.
