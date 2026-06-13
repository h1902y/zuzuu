# Versioning, Lineage & Time-Travel — Design Research

> Mobbin study (web platform), lane 05. Mined for the zuzuu workbench's
> versioning surfaces. Every observation below comes from looking at the
> actual screenshots, not from app reputation.

## Brief

The zuzuu workbench needs to make **versioning feel like progression, not a
scary git log.** The surfaces this research informs:

- **Per-module generations** — each of the 5 faculties (Knowledge, Memory,
  Actions, Instructions, Guardrails) has its own version lineage. A module
  "levels up" each time a human-gated proposal mints a new generation.
- **Checkpoints** — a *composed snapshot across all modules* at a moment in
  time. The agent's "save state" you can return to.
- **Rollback** — flip the active pointer back to a prior generation /
  checkpoint. Must feel safe, reversible, and undramatic.

Design questions carried into the study:

1. How do mature tools present a version **list** so it reads as a calm
   timeline rather than a commit dump?
2. How is **lineage/branching** drawn when there's more than a straight line?
3. What does a **trustworthy, non-scary restore** flow look like (preview →
   confirm → done)?
4. Can any of these be bent toward **progression/leveling** affect (levels,
   milestones, % complete) without becoming gimmicky?
5. Where does **diff** belong, and how much should we show by default?

---

## Studied

Grouped by app. Each link is the durable Mobbin reference.

### Document/page history (the "calm timeline" canon)
- [Notion — version history panel with per-timestamp list](https://mobbin.com/screens/0c3543e7-68f2-4a0f-87e8-f93fb08b2587) *(flow)*
- [Notion — Creative Strategy Framework, dense time-grouped history rail](https://mobbin.com/flows/0c3543e7-68f2-4a0f-87e8-f93fb08b2587)
- [Dropbox — Version history list with rename/edit/restore events](https://mobbin.com/screens/cc126ffc-c194-4efc-93b1-ed93a89e8101)
- [Dropbox Paper — "5 changes since 6 days ago" change list](https://mobbin.com/screens/912beb46-e679-4a4d-9746-eff2a3f3e113)
- [Substack — version history rail, current version pinned](https://mobbin.com/screens/d1d0d099-5452-4842-bbb7-681486136291)
- [WRITER — "Last 30 days" version rail + viewing-a-version banner](https://mobbin.com/screens/d6e6654e-119a-456a-acef-fcb72d9ec330)
- [Confluence — numbered versions table (v.1/v.2/v.3) with Restore/Delete](https://mobbin.com/screens/b405410d-7a2d-4bd6-b44d-4efa934e0dec)
- [Sana AI — version history right rail, "via Sana" attribution](https://mobbin.com/screens/0d1c373e-876d-48f2-b460-54aa375f8b35)

### Snapshots & time-travel (the closest analogue to checkpoints)
- [Gamma — "7 snapshots over the last 18 minutes" with Restore](https://mobbin.com/screens/2f99dcb8-2617-468b-9fad-ab2834d5bddd)
- [Pitch — per-slide version history with a horizontal snapshot scrubber](https://mobbin.com/screens/ec673809-125c-4d56-abf2-0fe9a237295b)
- [ChatGPT — "You are viewing a previous version" / Restore vs Back to latest](https://mobbin.com/flows/3f3cecc6-54c3-4601-a8b9-6bc04bd4f406) *(flow)*
- [Manus — version cards with Preview / Rollback / Publish per entry](https://mobbin.com/screens/4142fbf7-14e2-4841-aad7-70e51ddf2dfe)

### Branch & lineage graphs (the "more than a line" cases)
- [FLORA — node graph of image generations branching left→right](https://mobbin.com/screens/bf0de2b6-a2fb-4998-93d6-42d35f54b1ef)
- [GitLab — Repository graph: commit nodes on a vertical lane](https://mobbin.com/screens/52c2a85c-af19-4a9d-b877-5bcf31f8284a)
- [PlanetScale — Branches list, main + child branch indented under it](https://mobbin.com/screens/5f548e87-9e0e-4ec0-9779-a1dccf1ec256)
- [Retool — History panel with production / Latest branch tabs](https://mobbin.com/flows/c78f82dd-7969-4726-9f36-c0913e24a25e) *(flow)*

### Diff & compare (where detail lives, on demand)
- [Linear — version history with inline strikethrough + "Highlight changes" toggle](https://mobbin.com/screens/6c14e085-9ff5-4e61-9a21-b04f1b0a3433)
- [Sana AI — inline redline diff with "Highlight changes" on](https://mobbin.com/screens/e4f25c59-b045-49ac-9505-86d6f2e8ed3d)
- [GitBook — "Show only changed pages", inline page redline + revert menu](https://mobbin.com/screens/d8307789-31af-4bdd-b7cf-dab69a87dd95)
- [Google AI Studio — "Viewing differences" per-file, expandable accordions](https://mobbin.com/screens/3430ca7f-87b3-4475-ba40-fe8258cf2687)
- [GitHub — PR "Files changed" unified diff with viewed/unviewed state](https://mobbin.com/screens/72783a50-4cc2-4e3d-83f9-048f9a2455cf)
- [ChatGPT — canvas redline of edits with "2 more edits" pill](https://mobbin.com/screens/e177b7df-2b14-43ba-b516-b17ff8979480)
- [Adaline — prompt version history rail + JSON diff (green/red)](https://mobbin.com/screens/c53724d7-9387-4a81-8a96-bc74baddd24c)

### Rollback / restore as an *event* in an activity stream
- [Vercel — Activity log with an explicit "rolled back … from … to …" entry](https://mobbin.com/screens/8d7f08a3-ffbe-4ce0-a8d8-6cd09739f70c)
- [Vercel — Activity log, deploys nested under a parent with date filter](https://mobbin.com/screens/67d09ef8-fb84-4821-9405-8606c0e7c850)
- [incident.io — incident Timeline with status transitions + side timestamps](https://mobbin.com/screens/64c65bfb-68b0-4618-bff8-4d031ec92ea5)
- [incident.io — "Edit timeline": curate which events appear (Added chips)](https://mobbin.com/screens/67f0577f-cf4d-4d5d-9aab-6c24f0d2833d)
- [GitLab — Activity feed of pushes/commits with short SHAs](https://mobbin.com/screens/95e63815-3f52-4cc3-a176-d43b8c05314c)
- [Fibery — Activity Log as a filterable table (Who / Event / When)](https://mobbin.com/screens/94ad5a19-976a-4301-a5b9-c62e1c3f7b00)

### Progression / leveling framing (the Duolingo-adjacent angle)
- [Linear — Milestones panel with per-milestone "70% of 5", "0% of 4"](https://mobbin.com/screens/1a1fcfe9-f0b8-4ed5-ad99-58ad41993582)
- [Productboard — roadmap swimlanes with milestone flags on a time axis](https://mobbin.com/screens/144ed5ee-110d-4b29-906a-d8d0107ad1a7)
- [Linear — roadmap timeline, milestone diamonds along a horizontal line](https://mobbin.com/screens/15707b6a-286b-4fe6-816e-8ee88ea1980a)

---

## Patterns

What the screenshots actually show.

### Layout / grid
- **The right rail is the near-universal home for history.** Notion, Sana,
  Substack, WRITER, ChatGPT canvas, Linear, GitBook, Adaline all dock the
  version list to a narrow (~250–320px) right panel while the *content stays
  primary and centered*. History is an overlay on the work, not a separate
  destination. This is the single strongest convention I saw.
- **Two-column "history + preview"** is the restore pattern: list on one side,
  the *selected version's full content* rendered on the other (Gamma, WRITER,
  Linear, Confluence, Retool). You read the past state in place before acting.
- **Branching uses one of two drawings:** (a) a *vertical lane* of nodes with
  short connector stubs and labels to the right (GitLab repository graph), or
  (b) a *free-form left→right node canvas* where each card is a state and edges
  fan out to derived states (FLORA). FLORA is the more approachable, less
  "engineer" rendering — cards carry thumbnails, not SHAs.
- **PlanetScale avoids a graph entirely:** branches are a plain *indented list*
  (child branch tucked under `main`). For shallow lineage this is calmer than
  any graph.

### Spacing & density
- **High-trust history rails are airy.** Notion's is the exception — it packs
  ~20 timestamps tightly because power users scrub fast. Most others (Gamma,
  WRITER, Substack) give each entry a generous row with two lines: a primary
  label and a muted secondary (author / relative time).
- **Date grouping is the organizing device everywhere:** "Today", "Yesterday",
  "Last 30 days", "Last 7 Days", month headers (Vercel). Sticky-ish section
  headers chunk an otherwise endless list into digestible eras.
- **Diffs are dense by nature** but the good ones *gate the density*: GitBook's
  "Show only changed pages" toggle and Google AI Studio's collapsed per-file
  accordions mean you never face the full firehose unless you ask.

### Hierarchy
- **"Current version" is always explicitly marked** — a pill/badge ("Current
  version", "Latest", "current version") on the top entry (Dropbox, Sana,
  Substack, Confluence). The present is a labeled anchor, not just position 1.
- **Primary action sits bottom-right of the preview pane**, dark/filled
  ("Restore", "Restore this version", "Roll back to this version") — Gamma,
  WRITER, Linear, Notion, Dropbox Paper. Secondary ("Cancel", "Back to latest
  version") is ghost/outline next to it.
- **Per-entry actions are progressive-disclosed** via a "…" overflow (GitBook:
  Revert / Preview in new tab / Copy URL) rather than crowding every row.

### Color usage
- History chrome is **near-monochrome** — grays, one neutral surface. Color is
  reserved for *meaning*: the current-version badge (Linear/Sana tint it
  purple-blue), diff add/remove (green/red), and the destructive confirm.
- **Diff color is the consistent green-add / red-strike language** (Sana,
  GitBook, GitHub, ChatGPT, Adaline, Google AI Studio). Restores that *destroy*
  forward state use a **red confirm button** (Notion's "Restore to this
  version?" modal, Confluence's "Revert" dialog) — red signals irreversibility,
  not danger-everywhere.
- Vercel's activity log keeps every entry gray *except* the verb — "rolled
  back", "deployed", "deleted" — so the stream scans by action type.

### Type treatment
- **Two-tier type per row:** medium-weight primary label + smaller muted
  secondary (timestamp, author). Timestamps are frequently *relative*
  ("19 minutes ago", "2 hours ago") with absolute on hover/secondary line.
- Author identity shows as **avatar + name** inline (Dropbox Paper, Notion,
  Sana "via Sana"). Provenance is first-class — who/what made this version.
- Diffs use **monospace** only where it's code (GitHub, Adaline JSON, Google AI
  Studio); prose diffs (Notion, Sana, Linear) stay in the document's own font
  with strikethrough/highlight — keeping it readable, not terminal-like.

### Iconography
- Restraint. A clock for history/snapshots (Gamma, Amplitude), a small revision
  glyph, avatars for authorship. GitLab adds tiny file-action icons
  (add/edit/delete) per node. No iconographic noise; icons mark *kind of event*.

### Motion / interaction cues
- **Selecting a history entry re-renders the preview in place** (the two-column
  pattern) — implies a quick cross-fade, not a navigation.
- **Pitch's horizontal scrubber** turns time into a draggable track of dots —
  the most literal "time-travel" affordance seen; scrubbing previews states.
- **"Highlight changes" is a toggle** (Linear, Sana) — diff is an *optional
  lens* over the version you're viewing, off by default for calm reading.
- **ChatGPT's viewing-a-past-version banner** ("You are viewing a previous
  version") is a persistent mode indicator with two exits (Restore / Back to
  latest) — you always know you're in the past and how to leave.

### State handling
- Clear states: **current** (badge), **viewing-past** (banner/mode),
  **restoring** (confirm dialog), **restored** (toast — PlanetScale's
  "Successfully deleted… branch" green toast is the model).
- Confirm step before destructive restore is **near-universal** when forward
  work would be lost: Notion and Confluence both interrupt with a modal;
  Confluence even pre-fills a "Reverted from v.2" comment so the restore is
  *itself logged as a new version* (no history is destroyed — restore appends).
- Empty/early states stay quiet (Retool's history with just "Create app",
  "Create query", "Rename query (current version)").

---

## For zuzuu

Mapping each pattern to the named zuzuu surface.

### Per-module generations
**Adopt:**
- **A right-rail history per faculty**, opened from the module's header — the
  Notion/Linear convention. Module content stays center; lineage docks right.
  This keeps "see your Knowledge module's past lives" one click from the module
  itself, never a separate scary screen.
- **Date-grouped, two-tier rows**: generation label + muted (who/what minted it
  + relative time). Since zuzuu generations are *human-gated*, the secondary
  line is gold — "minted from proposal #12 · you · 2h ago" mirrors Sana's
  "via Sana" provenance and reinforces the human-in-the-loop story.
- **An explicit "Active generation" badge** (Linear's purple-tint current
  marker), so the present is a labeled anchor.
- **Lean into leveling here, lightly:** number generations as **levels**
  (Gen 1 → Gen 2 → Gen 3) the way Confluence numbers v.1/v.2/v.3 — a clean
  ordinal ladder reads as progression, not a hash soup. Optionally pair each
  generation with the Linear "70% of 5" device: show *what graduated* ("3 new
  facts, 1 retired") as the module's "XP gain" for that level.

**Avoid:**
- The GitLab repository-graph rendering (vertical SHA lane). It's correct but
  it's exactly the "scary git log" we're fleeing. Generations are mostly
  *linear* per module — render them as a ladder/timeline, not a commit graph.
- Showing diffs by default. Make diff a **"Highlight changes" toggle** (Linear/
  Sana) so opening history is calm reading first, forensics second.

### Checkpoints (composed cross-module snapshots)
**Adopt:**
- **Gamma's snapshot framing** is the template: "7 snapshots over the last 18
  minutes", a clock icon, each row a moment, one **Restore**. Rename to the
  zuzuu vocabulary ("checkpoints") but keep the affect — snapshots feel safe and
  plentiful, versions feel heavy and rare.
- **The two-column preview** for a checkpoint: list of checkpoints on the left,
  and on the right a *composed summary card* of what each faculty was at that
  moment (Knowledge: Gen 4, Actions: Gen 2, …). This is the one place a small
  multi-module readout earns its complexity.
- **A persistent "viewing a checkpoint" banner** (ChatGPT's pattern) with
  Restore / Back to now — so time-traveling the whole agent never traps the user
  in the past.
- Consider **Pitch's horizontal scrubber** as the hero time-travel gesture for
  checkpoints — dragging a dotted track literally *is* time-travel and is the
  most game-like, least git-like control in the whole study.

**Avoid:**
- A node graph for checkpoints. Checkpoints are points on a timeline, not a DAG;
  a scrubber or a vertical dated list communicates that far more calmly.

### Rollback
**Adopt:**
- **Restore-as-append, never destroy.** Follow Confluence: a rollback creates a
  *new* generation/checkpoint pointer ("flip the active pointer") and is itself
  logged in the lineage — which is exactly zuzuu's existing model (rollback =
  flip pointer, not `git revert`). The UI should *say* so: "This won't delete
  Gen 5 — it makes Gen 4 active again." That single sentence kills the fear.
- **The bottom-right dark "Restore" + ghost "Cancel"** action placement, and a
  **confirm modal only when forward state would be shadowed** (Notion's centered
  red-confirm dialog) — reserve the red for the moment that genuinely matters.
- **Log rollback as a first-class event** in a faculty/agent activity stream,
  Vercel-style ("rolled back Knowledge from Gen 5 to Gen 4"). The activity
  stream doubles as the audit trail zuzuu already values.
- **A success toast** after rollback (PlanetScale model) — quiet confirmation,
  not a page reload.

**Avoid:**
- Language like "discard", "revert", "reset --hard". Use **"make active"** /
  **"return to"** — restore is a *move along the ladder*, framed as choosing a
  level, not undoing a mistake.
- Multi-step diff-then-confirm walls for the common case. Preview-in-place +
  one confirm is enough; don't make the safe action feel like defusing a bomb.

### Cross-cutting: progression affect (the Notion-calm / Duolingo-game brief)
- **Generations as levels** (ordinal ladder) + **checkpoints as save-states**
  (plentiful snapshots) is the core metaphor swap that turns "version control"
  into "progression". Borrow Linear's milestone **% / count** chips to show each
  module's growth, and Productboard/Linear's **milestone diamonds on a timeline**
  if we ever want a single "this agent's journey" view.
- Keep the **chrome monochrome, meaning in color** discipline throughout —
  that's what makes Notion/Linear feel calm. The game-like warmth should come
  from *framing and motion* (snapshot scrubber, level-up moments, append-safe
  restores), not from decorative color.

---

## Standouts

Three to revisit first:

1. **[Gamma — "7 snapshots over the last 18 minutes"](https://mobbin.com/screens/2f99dcb8-2617-468b-9fad-ab2834d5bddd)**
   — the single best model for *checkpoints*: snapshots feel abundant, safe, and
   restorable; clock-led timeline; one calm Restore. This is the affect we want.

2. **[Linear — milestones with "70% of 5" + version highlight toggle](https://mobbin.com/screens/1a1fcfe9-f0b8-4ed5-ad99-58ad41993582)**
   (pair with [Linear's diff/highlight rail](https://mobbin.com/screens/6c14e085-9ff5-4e61-9a21-b04f1b0a3433))
   — the bridge from "version history" to "progression": per-unit % / counts
   read as leveling, and diff stays an optional lens, not the default.

3. **[Notion — restore flow with append-safe red-confirm modal](https://mobbin.com/flows/0c3543e7-68f2-4a0f-87e8-f93fb08b2587)**
   — the gold standard for *rollback that isn't scary*: dense-but-readable right
   rail, clear current marker, a single decisive confirm, and (crucially) a
   restore that appends rather than destroys — exactly zuzuu's pointer-flip model.
