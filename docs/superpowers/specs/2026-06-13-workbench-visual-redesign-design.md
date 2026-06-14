# Workbench Visual Redesign — Design Spec

**Date:** 2026-06-13
**Branch:** `redesign/workbench` (off `research/mobbin`, which carries the design brief)
**Status:** design — awaiting user review before plan

## Goal

Transform the zuzuu web workbench from its current "VS Code terminal" feel into a calm, premium, consumer-SaaS-grade product — **Notion-calm × Duolingo-progression × serious-not-toylike** — by re-laying its token foundation and then redesigning every human-facing surface against it. This is a *visual + interaction* redesign of an existing, working SPA: no new product features, no daemon API changes except where a surface genuinely needs a field that already exists in the data.

The authoritative design source is `docs/design-research/` — read `00-design-directions.md` (vision, 9 principles, current→target table) and `tokens-candidates.md` first, then the per-surface lane file (`NN-*.md`) for the surface being built. This spec operationalizes that brief into a buildable plan; it does not restate it.

## Background — current state

The workbench lives at `web/` (npm-workspaces monorepo: `protocol` / `daemon` / `web`). The React SPA is `web/packages/web/src/`:

- **Tokens:** `src/index.css` — a Tailwind v4 `@theme` block. Already has a W2.5 pass: duotype (`--font-sans` Geist / `--font-mono` JetBrains), a cool-ish warmed ink ramp (`--color-ink-950…100`), per-module OKLCH hues, semantic status (`--color-success/pending`), radii, two drop-shadows, a small motion set (`wc-slide-in`, `wc-rise-in`, `wc-pop-in`, `wc-pulse-once`, `wc-approve-out`), `.wc-sans`/`.wc-eyebrow` helpers. **The app `body` defaults to `font-mono`** — surfaces opt *into* sans via `.wc-sans`. This is backwards from the brief (mono should be the exception, not the default) and is the root of the terminal feel.
- **UI kit:** `src/components/ui/` (Bar, Button, IconButton, Field, Tabs, Dialog) — compose these. `src/panel/kit/` holds module-tile/card primitives.
- **Surfaces** (files): app shell `app/Layout.tsx` + `app/Sidebar.tsx` + `app/Footer.tsx` + `app/SessionPane.tsx`; session UI `term/TermView.tsx` + `components/SessionComposer.tsx` + `components/SessionCards.tsx` + `components/SessionIndicator.tsx`; right panel `panel/*` (`PanelRoot`, `RightPanel`, `ModuleView`, `ModuleDocs`, `ModuleGenerations`, `GenerationsTimeline`, `GenerationDiff`, `NeedsYou`, `ProposalDetail`, `ProposalRow`, `SessionsSection`, `SessionDetail`, `SessionBrief`); review `modules/ReviewFlow.tsx`; explorer `explorer/FileTree.tsx` + `SearchPanel.tsx`; editor `editor/*`; palette `palette/CommandPalette.tsx`; onboarding `onboarding/VaultPicker.tsx` + `WelcomeOverlay.tsx`; preview `preview/*`.
- **Tests:** vitest (logic-level — `search-logic`, `session-cards`, `review-queue`, `schema-fields`, `sections`, `module-paths`, `right-panel`, `host-launch`, etc.). These assert behavior, not pixels, so the redesign must keep them green.

**Terminology note:** the root project renamed *faculty → module*; the live code uses "module" (`ModuleView`, `module-paths`). `web/CLAUDE.md` still says "faculty/FacultyCard" in prose — it is stale; follow the code. Use **module** throughout.

## Principles (from the brief — the load-bearing ones for build)

1. **Color only for state** — surfaces rest neutral (~90% neutral pixels); color = status, module identity, or actionable.
2. **Receipts, not logs** — tool calls collapse to one-line records, expand on click.
3. **Real XP, never fake currency** — borrow progression *mechanics* (levels/counts/streaks/graduation), not the *costume* (mascots/confetti/coins).
4. **Preview the filled state** — empty screens show a faint preview + warm future-tense copy, never a void.
5. **Mono = machine data only** — sans for *all* chrome/prose; mono *only* for ids/paths/durations/code/logs.
6. **Detail in a rail** — dense data lives in a right inspector showing only the selected thing.
7. **Calm by default, color-on-action** — affordances and status color appear on hover/when-meaningful.
8. **Levels, not commits** — generations as an ordinal ladder; rollback as append ("make Gen 4 active — won't delete Gen 5").
9. **Finishable ceremonies** — review one-at-a-time with a counter, WHAT/WHY/WHAT-HAPPENS, warm finish.

## Architecture

Two layers, built in order: **(1) the foundation** (tokens + primitive kit), then **(2) surfaces**, each composing the foundation. The foundation is built directly and carefully (it is the taste lock); surfaces fan out against it.

### Layer 1 — Foundation

**1a. Token overhaul (`src/index.css`).** Replace the W2.5 ramp/defaults with the brief's system. Concrete changes:

- **Flip the default font:** `body` becomes `font-sans` (Geist). Introduce a `.wc-mono` / `font-mono` opt-in for machine data only (ids, paths, durations, span ops, log lines, code, the terminal, the literal guardrail pattern chip). The terminal (`xterm`) and code blocks keep mono. Audit every surface so no chrome/label/button/heading renders mono.
- **Warm neutral ramp (dark, primary mode):** retune the ink ramp to the brief's warm-charcoal 5-step intent (`bg.base ≈ #0E0F12`, `raised ≈ #15171B`, `card ≈ #1B1E23`, `hover ≈ #22262C`, warm text `primary ≈ #E8E6E3` / `muted ≈ #9A9690` / `faint ≈ #6B6862`). Keep the existing `--color-ink-*` token *names* (many components reference them) but shift their *values* warm, and ensure the semantic aliases (`--color-app/surface/elevated/hover/border/muted/subtle`) map onto the new ramp. Elevation = lightness steps + hairline borders; **remove drop-shadows on dark** (keep a soft diffuse shadow for light mode only).
- **Light mode:** add a warm off-white ramp (`canvas #FBFBFA`, `card #FFFFFF`, `text #2E2C28`) behind a `:root[data-theme="light"]` (or `.light`) selector, with soft diffuse shadows. (Dark stays default; light is additive — wire a token set even if a theme toggle ships later.)
- **Module hues:** retune all five to a *shared* OKLCH lightness/chroma (`L ≈ 0.70 / C ≈ 0.13`) so none shouts; add a `*.subtle` (high-L/low-C) variant per hue for tag/pill backgrounds. Hues used only as identity markers (icon chips, badges, active spine, chart series, type tags) — never card backgrounds.
- **Semantic status:** keep distinct from module hues — `success`/`warn`/`error`/`info`/`running` (add `warn`, `error`, `info`, `running`; today only `success`/`pending`). Add a `status.error.subtle` for faint full-row failed-state tint.
- **One brand accent:** reserve the existing `--color-accent` for *primary action + active nav only* (send button, primary CTA, active sidebar spine) — strip it from decorative/code/link uses where it currently leaks.
- **Radius:** nudge to brief (`card ~10px`, `control ~8px`, `pill full`); cap at ~12px.
- **Spacing step:** document `4·8·12·16·24·32·48`; the two density tiers (calm vs dev-table) are usage conventions enforced per surface.
- **Type scale:** keep the existing rungs; add a **serif display accent** family token for reading surfaces (digest intro, knowledge-fact rendering, proposal rationale) at display sizes only; add a "hero number" treatment (one large numeral per card, ~28–48px).

**1b. Motion vocabulary (`src/index.css`).** Map the brief's named transitions onto the existing keyframes, renaming/adding for clarity: `receipt.expand` (~180ms ease-out), `graduate.celebrate` (~700ms one-shot, inline non-blocking — the only expressive motion), `status.pulse`/`progress.fill` (continuous), `toast.enter`/`exit` (~200ms), `panel.enter` (~240ms slide-in for rails/drawers), `nav.active`/`card.hover` (~120ms, no movement), `timetravel.scrub` (pointer-follow). All `prefers-reduced-motion`-aware (already wired). No per-action confetti; no full-screen takeovers.

**1c. Primitive kit (`src/components/ui/` + `src/panel/kit/`).** Add/extend primitives that surfaces compose (each gets a logic-test where it has logic; pure-presentational ones are verified visually):

- `Card` — neutral surface, lightness elevation, hairline border, `radius.card`, `~20–24px` calm padding.
- `Receipt` — a one-line tool/event record: leading glyph + sans label + optional mono detail chip, expandable (`receipt.expand`) to reveal diff/output. The core session primitive.
- `Rail` — right-hand inspector container (slide-in `panel.enter`), holds label+value property rows.
- `PropertyRow` — `label (muted) · value`, value as a colored pill only for enums.
- `StatusPill` / `Count` / `Badge` — status pill (semantic colors), count chip, module-identity badge (hue chip).
- `Level` / `ProgressBar` — ordinal generation ladder node + the "N more to next gen" horizon bar.
- `Button` variants — primary (accent), secondary, ghost, and a **softened 3-way** approve/secondary/destructive set (destructive never a red slab).
- `EmptyState` — centered single-column: faint product preview slot + warm second-person headline + one CTA.
- `CoachMark` — anchored, dismissible, "N of M" counter, relaunchable.
- `HeroNumber` — the one-large-numeral treatment.
- `Toast` — quiet auto-dismissing confirmation.

### Layer 2 — Surfaces

Each surface is redesigned to its row in the brief's current→target table, composing Layer-1 primitives. Acceptance per surface = matches the target description + cited references, keeps its vitest green, passes a Chrome-DevTools screenshot self-check (calm/neutral resting state, mono only on machine data, color only on state). Surfaces (each is a plan task or small task-group):

1. **App shell + sidebar + footer** (`app/Layout`, `app/Sidebar`, `app/Footer`) — Notion two-tier rail: quiet top porcelain group (Digest, Search, Status) → five modules as collapsible section headers, tall calm rows, one Lucide line-icon per module, in-row state badge, hover-only affordances. Workspace/vault picker as a top-left identity popover (current + Starred/Recent + "+ Add folder"). Footer cleanup.
2. **Session pane — the hero** (`app/SessionPane`, `term/TermView`, `components/SessionCards`, `SessionIndicator`) — conversation-rail + work-pane split: prose transcript of one-line **receipts** + bordered cards for substantial events (plans/diffs/checkpoints); **terminal demoted to one tab** in the work pane (xterm stays, mono stays — *in that tab only*); green-check/spinner step lists; paused-for-input banner.
3. **Composer** (`components/SessionComposer`) — quiet host pill summarizing the host (Claude Code/Codex/…), glyph dropdown with one-line descriptions, mode chips, send→stop morph, warm empty state with faculty-seeded suggestion chips.
4. **Module grid + pulse** (`panel/PanelRoot`, `panel/ModuleView` grid, `panel/kit/*`) — Copy.ai card model (5 large icon-led cards, count in the verb, name primary) + a Plane pulse strip (sessions / proposals pending / active generation / guardrail activity) + a 6th ghost/affordance card + per-card "Gen N" chip. Color only on action.
5. **Module / knowledge detail** (`panel/ModuleView` detail, `panel/ModuleDocs`, `panel/schema-fields`) — Linear/Reflect hybrid: centered body (large title + fact text, serif accent for reading) + right **properties rail** (type/source/generation/confidence) + quoted-context backlinks ("Related (N)" showing the connecting sentence). Schema viewer = Fibery type-icon rows.
6. **Generations / versioning** (`panel/ModuleGenerations`, `GenerationsTimeline`, `GenerationDiff`) — right-rail date-grouped history with provenance, explicit "Active generation" badge, generations as **levels**, diff behind a "Highlight changes" toggle (off by default), rollback as append ("make Gen 4 active — this won't delete Gen 5").
7. **Review + NEEDS-YOU** (`modules/ReviewFlow`, `panel/NeedsYou`, `panel/ProposalDetail`, `panel/ProposalRow`) — one-at-a-time card ("3 of 7"), WHAT / WHY (collapsible evidence + "seen in N sessions") / WHAT-HAPPENS (consequence micro-copy under primary), three softened actions, quiet toast + auto-advance, warm zero-state. NEEDS-YOU = counted entry point grouped by module.
8. **Sessions + trace** (`panel/SessionsSection`, `SessionDetail`, `SessionBrief`) — sessions: airy table, recency section headers, status as the only color, faint-red tint on failed rows, slim header sparkline. Trace: narrative timeline of typed-icon cards → span tree on demand → per-span inspector rail (dev-tier density *inside the table only*).
9. **Guardrails / settings / instructions** (`panel/schema-fields` + guardrails/instructions views) — Vanta three-state palette (allow/ask/deny as one token per row), bold-label/muted-description rows in cards, plain-English summary sentence with chips, literal pattern as a small mono chip, "enforced by guardrails gate" note. Instructions editor = calm document, not code editor.
10. **Command palette** (`palette/CommandPalette`) — one blended command-first overlay, grouped by kind (quiet uppercase labels), never-blank open state (recent sessions + suggested actions), two-line rows, kind-icons, right-aligned shortcut hints, footer legend, one-time coach-mark.
11. **Onboarding** (`onboarding/VaultPicker`, `WelcomeOverlay`) — Graphite auto-advancing accordion checklist (active step expanded, completed grey+check, copyable mono CLI inline), progress in words + slim bar, genuine completion moment (digest preview), one optional dev-flavored personalization question.
12. **Empty / educative micro-UX** (woven across the above via `EmptyState`/`CoachMark`) — preview the filled state, icon-row-triplet module explainers, finite relaunchable coach-marks, a persistent collapsed "Your agent: Gen 2 · 4 facts · 1 pending" progression pill.

## Execution model

- **Strategy:** foundation-first, then all surfaces (user-chosen). Build approach: **locked foundation → per-surface subagent build** (subagent-driven-development). I build Layer 1 directly; each Layer-2 surface is a dispatched implementer subagent that *composes* Layer-1 primitives (never re-invents tokens), follows TDD where logic exists, and self-verifies with screenshots; two-stage review (spec then quality) per surface.
- **Verification loop:** run the workbench locally — `cd web && npm run build -w @zuzuu-web/protocol` (once), then `npm run dev` (daemon :7770 + Vite :5173), open `http://localhost:5173/auth?token=dev`. Serve **this repo's own `.zuzuu/` data** (real modules, proposals, guardrails, sessions) so surfaces render with content. Use the Chrome DevTools MCP to navigate + screenshot each surface; check: neutral resting state, mono only on machine data, color only on state, calm density on human surfaces.
- **In-the-loop model (user-chosen):** fully autonomous — build foundation + all surfaces against the brief and self-verification, then present the finished redesign + a screenshot set for end review. (The design-approval gate is *this spec*; execution after approval is autonomous.)
- **Tests:** keep all existing vitest green (`npm run test -w zuzuu-web` for daemon; web package tests where present). Add logic tests for any new pure logic in primitives (e.g. a `level`/progression calc, palette grouping). Run `npm run typecheck` clean.
- **Delivery:** all work on `redesign/workbench`; frequent commits per surface; no version bump and no publish during the build (it's a branch). Final review before any merge to main.

## Testing strategy

- **Unit (vitest):** existing logic tests must stay green; new primitive logic is TDD'd. No pixel-snapshot tests (brittle for a taste-driven redesign).
- **Type:** `npm run typecheck` clean across workspaces.
- **Visual self-verification:** per-surface Chrome-DevTools screenshots against a checklist (the four resting-state checks above) at the default viewport; spot-check light mode tokens compile.
- **Manual end review:** the screenshot set handed to the user.

## Out of scope (YAGNI)

- **Cloud / billing / credits (lane 12)** — deferred; no hosted backend exists to render. The brief preserves the design for when it does.
- **New product features / daemon API changes** — none, unless a surface needs a field already present in the data.
- **A user-facing theme toggle** — light-mode *tokens* are wired, but shipping a toggle UI is optional and not required for acceptance.
- **The CLI, capture, evolve engine, miners** — untouched; this is web-only.
- **Pixel-snapshot test infrastructure** — not introduced.

## Risks & mitigations

- **Visual drift across subagents** → mitigated by building the foundation first and constraining surface agents to *compose* primitives; the brief + cited references anchor taste; per-surface screenshot review.
- **Flipping the default font breaks dense surfaces** (trace table, terminal) → the terminal and code/data explicitly keep mono via `.wc-mono`; the trace table is dev-tier and audited individually.
- **Warm-ramp retune breaks contrast (WCAG-AA)** → text rungs chosen to hold AA on the new backgrounds; verified in build.
- **Token-name value shifts ripple unexpectedly** → keep `--color-ink-*` names stable, shift only values; grep for hard-coded hexes that bypass tokens and route them through tokens.

## Open decisions

None blocking. Defaults taken: dark stays primary; light-mode tokens wired but no toggle UI required; cloud/billing deferred; serif accent adopted at display sizes only.
