# Recipe: a personal vault — the first non-coding vertical

The recorded positioning says *"coding is the first vertical, not the boundary: the same mechanism serves any folder-based knowledge work."* This recipe is that claim, lived: a real personal knowledge vault — **277 notes across 5 modules** — running as a zuzuu Project, driven entirely by conversation, migrated off Obsidian in a day (02-07-2026).

## The shape

The vault uses **root-mode** (`zz init --root`): the repo root *is* the Project — modules live at the top level, ephemera stay in `.zuzuu/`. Five modules, each a table with its own shape:

| Module | Rows | What it holds |
|---|---|---|
| `knowledge/` | 124 | concepts, insights, people — schemaless by design |
| `library/` | 57 | external references; typed columns: url, author, platform, status, provenance |
| `journal/` | 30 | dailies/weeklies/quarters — the episodic stream |
| `actions/` | 8 | scheduled activities; typed columns incl. a **computed** `end_date` |
| `social/` | 58 | channel briefs, drafts, and engagement targets as `type: target` rows |

## What "driven by conversation" means

The owner types one command at their agent — a `/hi` front door — and converses. Under it:

- **The agent's lane**: a daily digest *stages* library proposals; saying "save 2 and 5" approves them through the gate. Nothing lands unread.
- **The owner's lane**: journal entries, captured thoughts, and engagement logs land instantly via `zz note create` — validated, provenance-logged, minted.
- **Structure emerges as data**: engagement targets started life as a hand-maintained markdown table; they became 47 `type: target` rows with `tier`/`platform`/`last-engaged` columns — now the ritual is a query (`zz query social --where "type=target" --where "platform=x"`), not a table parse.

## The queries that run the life

```bash
# what's active today (end_date is computed: start_date + duration_days)
zz query actions --where "start_date<=2026-07-02" --where "end_date>2026-07-02" --where "status=active"

# what's been sitting active past its window (the guilt query)
zz query actions --where "end_date<=2026-07-02" --where "status=active"

# the whole vault by note type
zz query --all --group-by type

# a saved view, stored as a note like everything else
zz query --view actions:view-active
```

## The map

`zz host web` renders the vault as [the World](The-World): knowledge as the dense central island, journal and library as flanking archipelagos, actions and social as small bright clusters — and when the digest stages proposals mid-conversation, they appear as ghosts over the library island until the owner approves.

## Why this is the flagship

Everything the coding vertical uses is used here unchanged: the same envelope, the same gate, the same generations, the same index. The only thing that changed is *what the tables hold*. That is the personal-application thesis in one sentence: **converse about your life, and the application that manages it keeps building itself — with nothing landing you didn't approve.**
