# The Omnibar

One input runs the workbench. `⌘K` opens it; the map stays behind, glowing and
flying as your focus moves.

## Three modes, one line

| you type | you get |
|---|---|
| plain text | **nouns** — notes, modules, saved views, proposals, sessions, commands, ranked exact-substring first, content above chrome |
| `>` | **world commands** — `>fit` · `>table` · `>map` · `>review` · `>everything` · `>module <name>` |
| `/` | **the conversation** — your prompt goes to the agent (the ACP lane); the chat renders inside the panel |

## The shell grammar (Raycast-style)

- **Enter** runs a row's default action — a note opens in the map, a session
  resumes, a saved view runs its lens.
- **Tab** on a focused row opens its **action panel**: a note offers *open in
  map · open record · discuss*; a proposal offers *approve · reject · open the
  gate*; a module offers *table · island*.
- **Esc pops** one level (action panel → list → closed). It never
  closes-by-surprise, and closing a chat never loses the conversation — the
  daemon replays it when you come back.
- The **breadcrumb lives in the placeholder** — it always names where you are.

## List + detail

Focusing a rich row opens its detail beside the list: a note's preview, a
module's schema card, a proposal's change (op · target · preview · rationale),
a session's summary. Arrow around; the pane follows.

## The two lanes, visible

Rows that WRITE carry a badge:

- **`instant`** — the operator lane: your own action lands now (validated,
  logged, minted). New sessions, approve/reject decisions.
- **`proposal`** — the agent lane: this stages a change the review gate
  decides. "Create a note named…" from a no-match query is a proposal — THE
  INVERSION, readable at the input.

The moat is not a setting; it's visible in every row.

## Proposals in the panel

Pending proposals list as rows (they're what needs you — they lead the idle
list). Tab → **Approve** lands it (the ghost on the map solidifies), **Reject**
dissolves it. The full gate (`R`) remains for keyboard triage over many.

## Saved views

A `type: view` note appears under **Views**. Enter runs it: its lens (text ·
type · module scope) applies to the shared filter state and the scope's table
opens — press `T` and the same lens spotlights the map. One filter state, two
projections. (A view's `where`/aggregate axes run CLI-side: `zz query --view`.)

## Chat in the panel

`/your prompt` + Enter starts (or reuses) the agent conversation *inside* the
panel: streamed replies, tool cards, permission prompts — and `[[mentions]]`
glow their nodes on the map behind. Esc pops back to the list; the
conversation keeps running. The raw terminal stays available for full-fidelity
sessions (`>` new shell, or the Sessions rows).
