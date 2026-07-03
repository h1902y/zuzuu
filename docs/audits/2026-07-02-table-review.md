# Moderation review — the §H table rebuild (`b1a9e07..9898a4f`)

Scope: 6 commits rebuilding the workbench grid on the envelope's doctrines.
Reviewed against `docs/specs/2026-07-02-polish-showcase-experience.md` §H/§H.1–§H.4/§H.6,
`docs/guide/Two-Lanes.md`, and the 02-07 Decision-Log entry. Read-only review.

**Verdict: ship-after-should-fixes** — gated on BLOCKER-1. The grid architecture is
faithful and lands: identity-is-id, the elastic Attributes cell, single-sourced clause
state (typed input · attribute chips · builder panels all write `useTableFilter`), the
NoteDocument unification (§H.6), ds-token discipline, and **no new npm deps** (the GFM
parser is hand-rolled) all check out. But one headline capability silently doesn't work
end-to-end, and the destructive delete verb inverts the two-lanes doctrine. Fix those
two seams (both contained — no grid rework) and it ships.

---

## BLOCKER

### B1 · Comparison / inequality filters are silently dropped server-side — the "one grammar" (§H.3.1) half-works and the chip UI lies
The client builds the full op grammar the spec names — `OPS = [">=","<=","!=","=",">","<"]`
(`web/src/client/shell/stage/table-model.ts:64`), parsed by `parseInputClause`
(`table-model.ts:73`) and offered in the Filter builder's op picker
(`web/src/client/shell/stage/TableBuilders.tsx:59`, emitted at `:38`). But the daemon
flattens it: `buildModuleQueryFlags` splits each clause on the **first `=`** and rebuilds
`--where key=value` (`web/src/server/zuzuu-peek.ts:97-103`) — for `tier>=2` the key
becomes `tier>`, which fails `SAFE_SLUG = /^[a-z0-9][a-z0-9_-]*$/` (`zuzuu-peek.ts:53`) and
is dropped; for `tier>2` there is no `=` so `eq<=0 → continue`. This builder feeds **both**
list routes (`web/src/server/zuzuu-read.ts:82` module, `:99` unified `/items`).

Net: `tier>=2`, `start_date<=2026-07-02`, `k!=v` — the spec's own §H examples
(`spec §H:292`, `§H.3.1:308`) — render as active dismissible chips + a "Filter (1)" badge,
but the table returns **unfiltered rows**. The UI asserts an active filter that does
nothing. Only `=` and `#tag` (→ `tag=`) actually reach the index.

*Fix:* the CLI already parses `k<op>v` (`src/cli/verbs/data.mjs:42`, `:199` via
`whereFilters`), so `buildModuleQueryFlags` should recognize the full op set and forward
`--where <clause>` verbatim (validate key/op/value, don't reconstruct `key=value`). Until
the daemon does, gate the client (`OPS` + `parseInputClause`) to `=`/`#tag` only so it
never offers an operator the backend swallows.

---

## SHOULD-FIX

### S1 · Selection→Delete routes the OPERATOR's delete through the AGENT gate (N per-row proposals) — inverts two-lanes + misses §H.3.4
`delete-selection` loops `dataProvider.remove` over the selection
(`web/src/client/palette/PaletteBody.tsx:277-291`), and `remove` = `zuzuu.stage({op:"delete"})`
(`web/src/client/data/provider.ts:75`). So each selected row becomes its own pending
proposal; the verb is labelled `lane:"proposal"` / "↵ stage"
(`web/src/client/omnibar/omni-sources.ts:100`) with toast "Staged N deletes for review."

Doctrine says the opposite: operator deletes land **instantly** through commit, only the
agent-lane twin stages (`Two-Lanes.md:24`; Decision-Log 02-07 `:131`). §H.3.4
(`spec:390-394`) is explicit — operator bulk = "ONE batch through commit (one generation,
all-or-nothing); the agent-lane twin ('ask the agent to …') stages proposals."

Weighing the counter (bulk-destructive-safe-by-default): the safety instinct is right, but
the review gate is the **agent's** knowledge-poisoning defense, not a human confirm.
Co-opting it (a) misframes the human as proposing to themselves, (b) floods the review
queue with N self-authored entries and is **not** atomic (approve each), (c) is not the
speced verb. The one honest mitigation: the whole web `dataProvider` is currently
inversion-only — there is no instant operator-write method at all (`provider.ts:4`) — so
this couldn't be instant without new plumbing, and the code is candid about the gap.

*Recommended semantics:* keep **Export** (genuinely instant + safe, `lane:"instant"`,
`omni-sources.ts:92`). For **Delete**, end-state = an instant operator batch-commit
(`actor:human`) fronted by an in-omnibar **count-confirm row** ("Delete N · permanent —
Confirm") — that is destructive-safe-by-default *without* the gate. Interim, since no
batch route / instant-write method exists yet: prefer holding Delete out of this pass
(ship Export only), or loop **instant** deletes behind the confirm. If proposal-routing
must remain a stopgap, make it ONE staged batch (`review plan/apply`) and stop calling it
the §H.3.4 verb.

### S2 · Stale selection leaks across navigation → the omnibar can delete rows from a table you left
The selection store clears cross-scope only inside `toggle`
(`web/src/client/state/table-selection.ts:32-39`); plain navigation (module A grid → B
grid) never toggles, so the store keeps `scope:"A"` + A's ids. `selectionFor(B)` returns
empty (`:44`), so B shows no checked rows — **but** `PaletteBody` reads the raw
`s.ids.size` (`web/src/client/palette/PaletteBody.tsx:112`), so the Selection group still
offers "Delete N" targeting A's rows while B is on stage. Within one scope, selection also
accumulates across filter changes and pages (no clear on `setText`/`setPage`), so
Delete/Export act on rows not currently visible. Compounds S1 into a blind bulk delete.

*Fix:* clear (or scope-guard) the selection when the active scope unmounts / the
filter/page changes; have the omnibar count read `selectionFor(currentScope)`, not the
raw store size.

### S3 · Footer prints the true server total beside a page-only Σ, no distinction → reads as a grand total when paginated
`TableFooter` renders `{total} rows` (the server pre-paginate total) next to `Σ key value`
(`totalSums` over the **loaded page only**) in identical muted styling
(`web/src/client/shell/stage/TableFooter.tsx:17` and `:20`; `group-model.ts:20`). With
`pageSize:50` (`list-state.ts:22`), any set > 50 shows a full count beside a partial sum —
a reader takes 156 as the total of 120 rows. The docs disclaim it (Modules-as-Tables.md)
but the UI doesn't (the group headers have the same property, but there the count is also
page-local, so they're at least internally consistent; the footer mixes a true total with
a partial sum).

*Fix:* qualify the Σ when `total > rows.length` ("Σ … · page" / "of N shown"), or hide it
until the daemon aggregate route lands (the §H.3.3 follow-up already named).

---

## NIT

- **N1 · Multi-session provenance truncated to the first session.** `bornHere` returns
  `session ${s.sessions[0]}` (`web/src/client/note/note-document-model.ts:114`); the old
  Record rendered *all* session chips. The move to a quiet footer is a legit §H.6 design
  change — only the `[0]` truncation is the loss.
- **N2 · `width="wing"` branch is dead.** `NoteDocumentWidth` includes `"wing"` and styles
  for it (`web/src/client/note/NoteDocument.tsx:18`, `:76`), but no caller passes it — only
  `"panel"` (Record, OmniDetail) and `"row"` (expansion). §H.6 names wing/sidebar as a
  NoteDocument container; the wing is still the editable Form, so the retrofit is 2/3.
- **N3 · Dead export.** `propertyStack` (`web/src/client/shell/stage/property-stack.ts:22`)
  lost its only consumer (Record); Form.tsx imports a *different* export
  (`editableFieldDefs`) from the same file, so the file survives but the function is dead.
- **N4 · Phantom Tailwind class.** `pl-31` (`NoteDocument.tsx:112`) is not in the default
  spacing scale — the relation edge-note indent silently no-ops. Use `pl-[7.75rem]` or a
  real token.
- **N5 · Parser edge `k=a>=b`.** `>=` is matched before `=` (`table-model.ts:73`), key
  becomes `k=a`, fails `KEY_RE`, `break` → falls to FTS text rather than key `k` / value
  `a>=b`. Pathological; the common `k=a=b` case is handled correctly (key `k`, value
  `a=b`). Note only.
- **N6 · Tests are behavioral but blind to the two live bugs.** ~40 added cases pin the
  pure models' real outputs well (not shape-only) — `parseInputClause`, `groupRows`,
  `selectionToCsv`, the selection store's cross-scope clear are all genuinely asserted.
  But none exercise the client→server operator round-trip (where B1 hides — the parser
  tests stop at clause-string construction, `table-model.test.ts`) or stale-selection on
  navigation-without-toggle (where S2 hides — `table-selection.test.ts` only tests the
  clear-on-toggle path). The green suite gives false confidence that filtering works.

---

## Doctrine scorecard

| Check | Result |
|---|---|
| Cells read-only everywhere (no inline edit) | PASS — cells render values/pills/chips; row→navigate, chip→filter, checkbox→select; the "click cell → pre-fill omnibar set" is honestly hedged "wherever wired" and simply not built yet (read-only preserved) |
| ONE NoteDocument (no second read-detail impl) | PASS — Record + OmniDetail bespoke layouts removed; row-expansion + both consume NoteDocument |
| ds tokens only (no raw hex / inline style) | PASS — StatusPill via token class-map; the SVG `fill=hsl(hue …)` dot follows the codebase's existing "identity hue, not a style" allowance; no hex anywhere (see N4 for a phantom token) |
| No new npm deps | PASS — GFM parser hand-rolled; no package.json change |
| Clause state single-sourced | PASS — typed input, attribute chips, and Filter panel all route through `useTableFilter`; sort/group write the reducer directly but are table-local (not map-mirrored) by design |
| Operator writes instant (two-lanes) | FAIL — see S1 |
| Filter grammar honored end-to-end (§H.3.1) | FAIL — see B1 |

---

## Fixed (same day)

The BLOCKER, all three SHOULD-FIXes, and one trivial NIT — same-day, small commits, each gated on typecheck + full suite (721, up from 713) + build.

| Finding | Commit | What changed |
|---|---|---|
| B1 — comparison/inequality filters dropped | `6f425d3` | `buildModuleQueryFlags` (`web/src/server/zuzuu-peek.ts`) now parses the op FIRST (longest-first, mirroring the CLI's own `parseWhere`), validates the key AFTER stripping the op, clamps the value, and forwards `key<op>value` verbatim — for both `/module/:key` and `/items`. Seam test: a `>=` clause asserted in the CLI argv through both routes (`web/tests/server/zuzuu-routes.test.ts`), plus a pure unit test for the full op grammar. |
| S1 — Selection→Delete routed the operator's delete through the agent gate | `80f8a45` | Delete is now a two-step in-omnibar flow: "Delete N selected" pushes a count-confirm row ("Delete N rows — Enter to confirm"; Esc cancels, nothing written); confirming loops the daemon's existing instant per-row route (`DELETE /module/:key/row/:id` → `zz note delete`, added as `api.zuzuu.deleteRow`) — no proposals, no gate. The one-batch-verb gap is noted in code. Export and the agent-lane twin (`dataProvider.remove`) are untouched. |
| S2 — stale selection leaks across navigation | `78940de` (store) + `80f8a45` (omnibar) | `clearIfScope` + `useClearSelectionOnQueryChange` (`web/src/client/state/table-selection.ts`) clear a table's selection on scope, filter, sort, or page change (one cleanup-based effect covers both). The omnibar's selection count and delete/export targets now read `selectionFor(currentScope)` (derived from the world selection), never the raw store. Pure store regression test added (no React). |
| S3 — footer Σ read as a grand total when paginated | `1f08086` | `isPartialSum(total, loadedRows)` (`web/src/client/shell/stage/group-model.ts`, pure/tested) qualifies the footer's Σ as "page Σ" in a dashed chip whenever the server has more matching rows than are loaded; unchanged (and un-labelled) when the whole match set fits on one page. |
| N4 — phantom `pl-31` Tailwind class | `b7f2ed4` | Replaced with `pl-[7.75rem]` (`web/src/client/note/NoteDocument.tsx`) — the relation edge-note indent actually renders now. |

**Live verify** (rebuilt daemon, `~/Documents/personal`, claude-in-chrome): on the `actions` module table, `duration_days>=30` narrowed 8 rows → 4 (`job-application-prep`, `linkedin-industry-visibility`, `reddit-community-presence`, `twitter-profile-growth`, Σ 150) and dismissing the chip restored all 8 (Σ 193) — B1 confirmed live end-to-end. In the unified Everything table, selecting 2 rows and invoking Delete from ⌘K showed the count-confirm row exactly as designed ("Delete 2 rows — Enter to confirm"); Esc'd out without confirming — nothing was written (verified against the vault's git status and item count after the session). Changing the active filter made the Selection group disappear from the omnibar entirely, reproduced twice. Zero console messages (errors or otherwise) across the full session.

Deferred (not in this pass, all previously flagged optional/NIT): N1 (multi-session provenance truncation), N2 (dead `width="wing"` branch), N3 (dead `propertyStack` export), N5 (the `k=a>=b` parser edge case — pathological, noted-only in the original review).
