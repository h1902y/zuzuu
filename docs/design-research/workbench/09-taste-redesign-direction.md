# Workbench Taste Redesign — Direction

> Synthesis of three design-research streams (Mobbin: projects layer · Mobbin: in-app shell · web: SaaS maturity + flows), reconciled with the existing lane-13 aesthetic research (`docs/design-research/13-aesthetic-design-language.md` + `tokens-candidates.md`). The shipped workbench has the right **bones** but reads premature; this doc defines the **product flows, screen journey, and component evolution** to fix that — for agreement *before* a rebuild.

---

## 1. Why it reads premature (the diagnosis — all three streams agree)

The bones are right (nav · stage · wing · ribbon + the in-place data model). What's missing is **taste applied consistently**. Six concrete causes:

1. **No type hierarchy.** The scale stops at `meta 11 / ui 12 / body 13` — there are *no* heading/display sizes and weight isn't used as a lever. Every screen is one flat whisper. (Mature tools use 5–6 sizes *and* weight as the primary hierarchy signal — Linear, Geist.)
2. **Untyped, flat tables.** Every cell renders as gray text. Mature data UIs render cells **by type** — pills, avatars, links, monospace — and label column *types* (Neon, Notion, Linear).
3. **Unicode glyphs instead of an icon system.** We ship `▦ ⌂ ◷ ● ⤷`. A single monoline icon set (Lucide/Radix) on every nav/property/command row is the biggest single "this is a product" tell.
4. **One flat plane.** The elevation tokens exist (`ink-950→850`) but surfaces don't use them — no base/raised/overlay rhythm. On dark, hierarchy must come from **lightness steps**, not borders/shadows.
5. **No real projects surface.** The #1 complaint. There is no "all my projects" home — only a bare dropdown popover. For a multi-project product this reads as "a launcher someone bolted on."
6. **No composed states or motion.** Empty states are one muted line; there are no governed headers, no hover/active depth, no transitions, no optimistic feedback.

---

## 2. The design language (the foundation — fix this first, everything inherits it)

### 2.0 The aesthetic soul — MARVIN warm-retro (decided 2026-06-25)

The user set the taste target with the **MARVIN** reference (warm parchment/cream + sage green + dark-brown ink + muted *retro* accents — terracotta, dusty pink, olive/mustard, mint — and a chunky, rounded, looping retro display logotype; nostalgic, tactile, editorial). This **re-pitches the palette and type from the dark-clinical-minimal default** the §1 research assumed (Linear/Vercel/Vapi). The decisions:

- **Warm, retro-analog — not cool/clinical.** Warm neutrals (this matches lane-13's existing "warm charcoal" instinct — we just push it further toward parchment/brown + retro accents).
- **Dual-theme: a warm-LIGHT *and* a warm-DARK ramp** that swap (a real theme toggle). Today's tokens are a single hardcoded dark `@theme` — so Phase 0 now includes **theme-able token infrastructure**.
- **Characterful, but restrained on dense surfaces.** Full personality on the brand, the projects-home headers, empty states, and headings (the rounded display face, the retro palette); **calm + legible** on the data tables, the terminal, and forms (a clean grotesque, quiet color).
- **The structural research (§1, D4–D7) is mode-agnostic and still holds** — type *hierarchy*, typed cells, elevation-by-lightness, icons, density, motion, states. MARVIN changes the *soul* (palette + type personality + warmth + dual-theme), not the *structure*.

**The agreed token set (researched 2026-06-25 — Flexoki-based, MIT/OFL):**

- **Type.** Display: **Bagel Fat One** (logotype, 48px+) + **Sigmar** (hero headings / empty states / onboarding, 32–72px) — OFL, the rounded-retro lineage (the literal "Marvin" face is commercial + actually angular Art-Deco, so we use this lineage instead). UI grotesque: **Space Grotesk** (retro-technical but legible; +0.01em tracking at 12–14px). Mono: a split — **Space Mono** in the terminal (character) + **JetBrains Mono** in dense grids (legibility); tokens `--font-mono-display` / `--font-mono-data`. All Fontsource/Google-Fonts available.
- **Palette — warm dual-theme** (Flexoki ramp + terracotta/sage/dusty-rose/mustard/teal retro accents):

  | Role | Warm LIGHT | Warm DARK |
  |---|---|---|
  | surface-0 (page) | `#FFFCF0` | `#1C1B1A` |
  | surface-1 (card/panel) | `#F2F0E5` | `#282726` |
  | surface-2 (raised/hover) | `#E6E4D9` | `#343331` |
  | surface-3 (active/selected) | `#DAD8CE` | `#403E3C` |
  | border | `#CECDC3` | `#575653` |
  | text-primary | `#100F0F` | `#E6E4D9` |
  | text-secondary | `#6F6E69` | `#878580` |
  | accent (terracotta) | `#BC5215` | `#DA702C` |
  | retro: sage · rose · mustard · teal | `#66800B · #A02F6F · #AD8301 · #24837B` | `#879A39 · #CE5D97 · #D0A215 · #3AA99F` |

  All text tiers pass WCAG AA. Application: **dense surfaces use only the surface ramp + text tiers (no accent fills)**; accents are spot color on headings + module identity (border-left / icon / low-opacity badge), max one accent per surface. The terminal is `#1C1B1A` in **both** themes (a contained dark island in light mode — editorially cleaner than a tan terminal).

### 2.1 The seven structural deltas

Seven deltas. These align with lane-13/`tokens-candidates.md` (warm neutrals, hierarchy-from-lightness, hues-as-chips) — we just never fully *applied* them. **D1–D3 are now re-pitched per §2.0 (warm dual-theme + a characterful display face + retro accents); D4–D7 are unchanged.**

| # | Delta | Concrete target |
|---|---|---|
| **D1** | **A real type scale + weight as the lever** | Sizes `11 · 12 · 14 · 16 · 20 · 24 · 30`; assign each size+weight to *one* role (label/body/title/heading/display). Weight whispers authority (≈510 chrome, ≈590 emphasis) — never stack >2 hierarchy signals. |
| **D2** | **A 4-level dark elevation model** | `base #0E0F12 → raised #15171B → card #1B1E23 → overlay ~#22262C`, each ≥5% lighter than its parent. Hierarchy from **lightness**, hairline borders only where lightness can't separate. (We have the ramp; formalize base/raised/card/overlay and *use* it.) |
| **D3** | **One accent, action-only; opacity-graded text** | Mint accent reserved for active/primary/focus *only*. Text hierarchy via opacity tiers of one ink, not new grays. Module hues demoted to **small identity chips** (icon badge / tag), never fills (lane-13). Status colors reserved for state. |
| **D4** | **An icon system** | Adopt **Lucide** (monoline, 1.5px, tree-shakeable `lucide-react`). 16px in dense rows, 20px primary, on every nav item / property / command / status. Retire the unicode glyphs. |
| **D5** | **4px spacing rhythm + density** | Constrained scale `4/8/12/16/24/32/48`. Target **Linear-density** (rich rows, ~32–36px), opacity to grade importance — not whitespace-heavy consumer cards. |
| **D6** | **Motion + optimistic feedback** | 100–200ms micro-transitions, spring easing for pop-ins (palette/menus), 150–250ms view transitions, optimistic writes with undo toasts. Nothing blocks. |
| **D7** | **Four interaction states + focus-visible** | default · hover (subtle bg) · active/selected (soft-fill) · `:focus-visible` ring (accent, 2px). Never `outline:none` without a replacement. |

---

## 3. The product flows — the navigation model

Three canonical models, with the recommendation:

- **Model A — Dashboard-home:** a `/projects` surface with all projects as cards/rows (Vercel, Supabase, GitHub). Best for overview; costs a step on return.
- **Model B — Sidebar-tree:** projects live in the left rail always (Linear, VS Code). Instant switch; clutters past ~20 without grouping.
- **Model C — Command-palette-first:** ⌘K is primary nav, recents auto-surface (Raycast). Zero clutter; invisible to newcomers.

**Recommendation — A + B + C combined (the Linear pattern):** a real **Projects Home** (table-with-facets) as the launch/overview surface, a **top-left two-pane switcher** for fast in-context switching, and **⌘K** listing Projects + Recents. Respect last-open state on launch (don't force the dashboard); the home is where you *manage* projects, the switcher/⌘K is how you *jump*.

> **This revises a prior decision.** The earlier project-layer work (this session) deliberately chose "in-place `switchTo` + a popover, no separate projects surface." The user's feedback overrides that: a multi-project product needs a real home. Architecture implication to resolve in planning: a projects-home that shows *all* projects' health needs a **cross-project surface** (read `~/.webcode/recents` + each project's `.zuzuu` for counts) — reviving the "hub/launcher" question deferred earlier (browser-hops vs a hub daemon).

---

## 4. The screen journey

```
┌─ PROJECTS HOME ─────────────────────────┐     the launch / manage surface (NEW)
│  ◳ org switcher          ⌘K   + New      │
│  ┌─ table-with-facets ───────────────┐   │
│  │ ● cards-game   2h   18 notes  ◷ 3 │   │  rows: name · path · last-activity
│  │ ● canvas-app   1d   42 notes  ✓   │   │       · #notes · #modules
│  │ ● zuzuu        5m    1 table  ◷ 1 │   │       · ◷ N pending-review (OUR signal)
│  └───────────────────────────────────┘   │       · guardrail status
│  group-by / filter · grid⇄list toggle     │  empty: teaching state + ⌘
└──────────────────────────────────────────┘
                │ click / ⌘K / switcher
                ▼
┌─ PROJECT (the in-project shell, evolved) ─────────────────┐
│  ⌂ Project ▸ Module ▸ Note   [chips]   [Terminal│Grid] ⌘K │  governed stage-header
│ ┌─nav──┐ ┌─ stage ───────────────┐ ┌─ wing ──────────┐   │  (breadcrumb = location
│ │SESSIONS│ │ terminal / schema-aware│ │ record property │   │   + switcher; view tabs;
│ │ ● claude│ │ grid / record detail   │ │ stack / review  │   │   one primary)
│ │TABLES  │ │                        │ │ queue / schema  │   │
│ │ ▦ know..│ │                        │ │                 │   │
│ └────────┘ └────────────────────────┘ └─────────────────┘   │
│  ● live · ◷ 3 pending · press R to review                    │  ambient ribbon (gate)
└──────────────────────────────────────────────────────────────┘
```

**Surfaces, in order:**
1. **Projects Home (NEW)** — table-with-facets; the "see all my projects" answer. Row anatomy = identity (icon + name + path) · freshness · one health signal led by **◷ N pending review** · `···` overflow. Grid⇄list toggle, search, group-by. Two-tier create (name-only modal → path-aware form). Teaching empty state.
2. **Switcher** — top-left two-pane mini-launcher (projects + live search + current ✓ + New). Replaces the popover.
3. **Project Home / enter transition** — lands on a *scaffolded* home with a governed header (breadcrumb + context chips + view tabs + one primary), not a bare terminal. Right inspector rail = the project's modules/generations/guardrail state.
4. **In-project surfaces (evolved Stage+Wings)** — §5.
5. **Review gate** — decision-on-the-item (solid Approve = the only accent, ghost Reject), per-item context, batch-approve + running summary. ⌘K + `R` everywhere.

---

## 4a. Decided screen + navigation architecture (2026-06-25)

Three product calls, decided:
- **Center of gravity: BALANCED** — running agent sessions (work) and curating the brain-database (modules/notes/review) are **both first-class**; nav gives them equal standing and the project home surfaces both.
- **Launch landing: the PROJECTS HOME** — open the app → the table-with-facets of all projects (choose/manage); within a project, resume where you left.
- **Project entry: an OVERVIEW first** — entering a project lands on a scaffolded home base, then you dive into work/curate.

**Two navigation levels:**
- **L1 — Projects (launcher):** Projects Home on launch; top-left switcher + ⌘K to jump.
- **L2 — Inside a project:** the Stage+Wings shell with a **balanced** nav — `⌂ Overview · SESSIONS (work) · TABLES (curate)`. The **review gate is cross-cutting** (ribbon + `R` + ⌘K), never a mode.

**The Project Overview (the balanced home base — new screen):** identity (display-face title + path + enabled/notes) · health (notes · modules · **◷ pending review** · guardrails · last activity) · two balanced columns **SESSIONS ⇄ THE BRAIN** (recent/live sessions + new; modules at a glance + recent changes) · quick actions (Start session · Review N · Open a table). It shows both poles of "balanced," gate front-and-center.

**The journey:**
```
launch ─▶ PROJECTS HOME ─open─▶ PROJECT OVERVIEW ─┬─▶ SESSION (work) ─proposes─┐
   ▲        (manage all)         (home base)      ├─▶ TABLE→NOTE (curate) ─edits─┤
   └─────── ⌘O / switcher ───────────────────────┘                             ▼
                                                          REVIEW QUEUE ─approve─▶ brain evolves
```

**Locked screens:** Projects Home · Switcher/⌘K · New/Open project · Project Overview · Session(Terminal) · Module(Grid) · Note(Record) · Review Queue · Schema/Generations · Onboarding · Settings. *(Graph/relationships deferred.)*

**Locked journeys:** J1 first-run (Projects Home → open folder → onboarding → Overview → session → first proposal → review) · J2 daily (launch → Projects Home → Overview → resume/review/curate) · J3 the loop (session → propose → ribbon → Review → approve → evolve → grid) · J4 curate (Overview → grid → note → edit → pending → review) · J5 switch (⌘O / switcher / Projects Home).

## 4b. Finalized full screen set (revisited 2026-06-25)

Revisiting the flows resolved the layout + added three surfaces. The **complete, finalized** screen inventory + IA placement:

- **Projects Home — table/rows + facets** (DECIDED, not card-grid). Scannable rows: name · path · #notes · #tables · **◷ N review** · guarded · last-activity; group-by/filter facets + a grid⇄list toggle; the brand logotype (Bagel Fat One); path-aware New/Open; teaching empty state.
- **In-project nav (L2), finalized:** `⌂ Overview · SESSIONS · TABLES · Graph · Search · Settings (pinned bottom)`.
  - **Project Overview** — the balanced home base (replaces today's "The database" module-cards home).
  - **Sessions** → Terminal stage **with view tabs `Terminal · Changes`** — the new **"What this session changed"** view (the observe→propose receipts for that session, beyond the raw transcript). Wing = review.
  - **Tables** → Grid stage **with a view toggle `Table · Graph`** (per-module relationships). Wing = schema/generations.
  - **Graph** (NEW nav node) — the **whole-brain relationships** view (ER/graph of all notes + relations across modules).
  - **Search** (NEW) — **cross-note / global search** across the project's notes (⌘K-entry + a dedicated results surface).
  - **Settings** (NEW, per-project) — sections: **Guardrails/rules · Agent/Host (enable/disable) · Project · Appearance (theme)**. (Guardrails remain editable as a table too; Settings is the config home.)
- **Review** stays cross-cutting (ribbon + `R` + ⌘K), not a nav mode.

**Sequencing the finalized set:**
- **Phase 1 (next):** Projects Home (table) + the two-pane switcher + the Project Overview — the launcher + home base.
- **Phase 2:** the in-project component evolution (schema-aware grid, property-stack wing, decision-on-item review, governed stage-header, grouped palette, composed empty states) **+ the per-module Graph toggle + the Session-Changes tab**.
- **Phase 3:** the whole-brain **Graph** surface, **cross-note Search**, and the **per-project Settings** surface.

---

## 5. Component evolution map (current → evolved)

| Surface | Today (premature) | Evolves to (tasteful) | Refs |
|---|---|---|---|
| **Projects** | a dropdown popover | **Projects Home: table-with-facets** + two-pane switcher + ⌘K | Linear projects-table, Vercel switcher |
| **Sidebar nav** | flat list, unicode dots | **captioned zones** (SESSIONS / TABLES), Lucide icons, soft-fill active pill, inline status tags, two-line module rows | Linear, Vapi, Qatalog |
| **Stage header** | a bare `⌘K · crumb` strip | **governed header**: breadcrumb-switcher + context chips + view tabs (Terminal/Grid/Detail) + one primary | GitBook, Render breadcrumb |
| **Grid** | flat gray-text table | **schema-aware grid**: typed cells (pills/avatars/links/mono), type-labeled headers, row hover, dirty-cell tint, sticky Save/Discard, filter chips | Neon, Notion, Linear |
| **Record / form (wing)** | label + plain input | **property stack**: icon + muted label + typed value/ghost-placeholder; type-aware inputs; "+ New field"; autosave toast or sticky commit | Neon, Rox, Dovetail, Fibery |
| **Review queue** | plain cards, equal buttons | **decision-on-the-item**: solid Approve (only accent) + ghost Reject, per-item metadata, batch-approve + summary, status pills | Lemni, Workable, Deel, Braintrust |
| **Command palette** | a flat list | **grouped + annotated**: section headers per verb/module, leading icons, right-aligned shortcut chips (chords), Recents, footer key-legend | Replit, Juicebox, Graphite |
| **Empty states** | one muted line | **composed**: centered glyph + headline + one sentence + one primary (+ dev secondary like "Copy prompt / Docs") | Whop, ElevenLabs, Linear, Supabase |
| **Schema / generations** | a plain list | property-type picker + lineage with active marker + rollback affordance | Notion property menu, Dovetail |

---

## 6. Sequencing (proposed)

A redesign this size phases cleanly because everything inherits the foundation:

- **Phase 0 — Design language** (D1–D7): type scale, elevation usage, Lucide, spacing, motion, states. Invisible alone, but every surface improves the moment it lands. *Do first.*
- **Phase 1 — Projects Home + switcher** (the #1 gap): the new launch surface + two-pane switcher + ⌘K project search. (Resolve the cross-project architecture here.)
- **Phase 2 — In-project component evolution**: the governed header, schema-aware grid, property-stack wing, decision-on-item review, grouped palette, composed empty states.

---

## 7. Decisions (agreed 2026-06-25)

1. **Navigation model — DECIDED: A+B+C.** A real **Projects Home** (table-with-facets) + a top-left two-pane switcher + ⌘K project search. The home is the "see all my projects" surface; the switcher/⌘K are the fast jumps. This **revises** the prior session's "in-place `switchTo` + popover, no separate surface."
2. **Sequencing — DECIDED: foundation-first.** Phase 0 (design language) → Phase 1 (Projects Home + switcher) → Phase 2 (in-project component evolution). Everything inherits the foundation, so it compounds.
2b. **Aesthetic — DECIDED: MARVIN warm-retro, dual-theme, characterful-but-restrained** (see §2.0). Warm-light + warm-dark ramps; a rounded retro display face for brand/headings; calm dense surfaces. Phase 0 grows to include theme-able token infrastructure.
3. **Icons — RECOMMENDED: adopt `lucide-react`** (monoline, tree-shakeable) in `web/`, retiring the unicode glyphs. Lands in Phase 0.
4. **Projects-Home architecture — open for planning.** A cross-project surface must read all projects' health without each daemon running — a read-only registry pass over `~/.webcode/recents` (stat each project's `.zuzuu` for counts/pending) is the likely minimal path; the hub/launcher daemon is the cloud-era upgrade. Resolve in the Phase 1 plan.

---

## References

Projects layer (Mobbin): Linear projects-table + group-by-health, Vercel projects + team-switcher, Sentry metric-cards, Render breadcrumb-nav, ChatGPT/v0 project-home, GitLab/Wrike create, Linear/Adobe/Todoist empty states, Braintrust (closest analog). In-app shell (Mobbin): Vapi (dark Notion-calm), Neon (schema-aware grid + detail), Notion (typed cells), Linear (sidebar/settings), Replit/Juicebox/Graphite (palette), Lemni/Workable/Deel (review), Whop/ElevenLabs (empty), GitBook (governed header). Maturity (web): Linear UI breakdowns, Vercel Geist colors, Radix Colors (12-step), Refactoring UI, Superhuman, Supabase Studio empty-states, Muzli/Uxcel dark-theme guides.
