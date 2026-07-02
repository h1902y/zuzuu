# Observability — teach the substrate

zuzuu has no database and no server-side state of its own. Every "magic moment" in the workbench — a ghost node, a generation, a spotlight — is one click from the **plain file** that explains it. This page names those files and the workbench surfaces that read them.

## log.jsonl — a note's provenance

Every module keeps an append-only `<module>/log.jsonl` (root-mode) or `.zuzuu/<module>/log.jsonl` (classic): one JSON line per mutation, written by the one write boundary (`grow/commit.mjs`) on every create/update/delete/deprecate, whichever lane it came through (operator or agent-approved).

```json
{"event":"create","ts":null,"note":"brahman","actor":"migration","source":"obsidian-vault-2026-07-02"}
{"event":"update","ts":null,"note":"brahman","actor":"human","proposal":"patch-brahman"}
{"event":"update","ts":null,"note":"brahman","actor":"human","backfill":"envelope-floor"}
```

- **`actor`** names who did it: `human` (the default), `migration` (a one-time import), `init` (the safety-floor seed), or `agent` in principle — though the moat means an agent write only ever reaches this log through an approved proposal.
- **`ts`** is honestly `null` on most entries today — nothing in the current write path stamps a timestamp on every op. The workbench renders "time not recorded" rather than inventing "just now."
- Everything past those keys is the mutation's own "why": `proposal` (the staged-change id it landed from), `backfill` (which healing pass), `rename`/`merge`/`refactor`/`rollback`/`relation` (which refactor).

**In the workbench**: open any note's detail (omnibar pane · wing · row expansion — the one `NoteDocument` component) and expand the collapsed **History** group above the footer. Each row is one log line: an actor glyph, the op, the "why," and a relative time. The footer's "born here" line (when the note carries provenance) opens History and scrolls to the note's earliest `create` entry.

No CLI verb parses `log.jsonl` as JSON yet — the daemon reads the file directly (`GET /api/zuzuu/module/:key/item/:id/history`), the same root-mode-aware pathing every other read uses.

## generations.json — a module's lineage

`git is the substrate`: minting a generation stages `.../<module>` and commits it with a `zz-gen: <module>/<n>` trailer, so the module's whole history rides in git's own object store — no parallel content-addressed blob store. `<module>/generations.json` is the tiny ledger recording *which* commits are generations (`{n, mintedAt, mintedFrom}`); the bytes themselves are the git commit.

```bash
zz gen list crm            # the ledger + active generation
zz gen diff crm 3 4        # which notes changed between two generations
zz gen rollback crm 3      # restore gen 3's bytes — as a NEW forward generation
```

Rollback is never destructive-in-place: it's a `create`/`delete` op batch through the one write boundary, so it validates, logs, and mints like any other write — you can roll back a rollback.

**In the workbench**: a module's wing shows a compact horizontal **generation strip** — `gen N`, relative mint time, a from-count, the active one highlighted. Click a chip to open its **"what changed"** panel (the real `gen diff` against the previous generation) and a **"roll back to here"** button that shows the honest consequence ("lands as gen N+1") before it runs.

## module.md — the table's contract

**A module is a table, a note is a row.** `<module>/module.md` declares the columns (types, `required`, `default`, `description`, computed formulas) that make a module's notes validate at the write boundary. No `fields` block means schemaless — any frontmatter goes. See [Modules as Tables](Modules-as-Tables) for the full column grammar.

**In the workbench**: the module wing's COLUMNS card renders `module.md`'s schema directly; a quiet caption under it (and under a note's own Fields group) names the file's on-disk path and offers a copy button.

## project.md — the root marker

A root `project.md` carrying `type: project` + a `format: zuzuu/…` line is what makes a folder **root-mode**: modules live at the repo root (`knowledge/`, `library/`, …) instead of under a hidden `.zuzuu/`. Every daemon read resolves the Project's home the same way (`resolveHome`): root-mode when the marker is present, `.zuzuu/` otherwise. This vault is root-mode; a fresh `zz init` project is classic.

**In the workbench**: Settings' "Under the hood" section reports whether the current Project is root-mode, alongside the daemon's port and the Project's root path.

## The plain-file link

Everywhere a note or a module's schema card is shown, a quiet caption names its on-disk path — root-mode aware, never guessing a `.zuzuu/` prefix that isn't real — with a copy button. It is a caption, not a file-opener: a browser page can't reach your local filesystem, so "open the file" means "here is exactly where it lives, in your own editor."

## Settings → Under the hood

The footer-right gear opens Settings; its last section names all four files above (one sentence each, linked here) plus the daemon's own facts: port, Project root, and root-mode. It's the single place that answers "what IS this thing, mechanically" without leaving the workbench.

## See also

- [Two Lanes](Two-Lanes) — the write boundary these files record
- [Modules as Tables](Modules-as-Tables) — the full `module.md` column grammar
- [The World](The-World) — ghosts, generations, and spotlights made visual
- [Decision Log](Decision-Log) — "git is the substrate," the envelope floor, the two write lanes
