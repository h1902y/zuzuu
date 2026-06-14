# Token Candidates

> Concrete token candidates for the zuzuu redesign, distilled from the 14 lanes (lane 13 is the primary source; lanes 03/05/06/09/10/12 supply usage rules). Values are *intent + starting point*, not final — tune in build. OKLCH where the research suggested it. Read alongside `00-design-directions.md`.

---

## Color

### Neutrals — the single biggest "premium" signal

Dark mode is zuzuu's **primary** mode (it's a coding surface). The rule from lane 13: **warm the neutral, build hierarchy from lightness steps, not borders or drop-shadows, and never use pure `#000`/`#FFF` or cool Tailwind grays** (they read "unfinished"). Each surface level is one notch lighter than its parent (the Starling/Betterment/Modal move).

**Dark ramp (warm charcoal, 5 steps):**
| Token | Value (start) | Intent / usage |
| --- | --- | --- |
| `bg.base` | `#0E0F12` | App field — the deepest surface |
| `bg.raised` | `#15171B` | Page panels, the conversation canvas |
| `bg.card` | `#1B1E23` | Cards, faculty tiles, proposal cards |
| `bg.hover` | `#22262C` | Hover/active row fill (soft, never a hard border) |
| `border.subtle` | one step off `bg.card` | Hairline 1px delineation where lightness alone isn't enough |
| `text.primary` | `~#E8E6E3` (warm) | Body, headings |
| `text.muted` | `~#9A9690` | Labels, secondary metadata, descriptions |
| `text.faint` | `~#6B6862` | Timestamps, disabled, faint hints |

**Light ramp (warm off-white):**
| Token | Value (start) | Intent / usage |
| --- | --- | --- |
| `canvas` | `#FBFBFA` | Page background (Notion's warmed near-white) |
| `card` | `#FFFFFF` | Cards float on the canvas |
| `text.primary` | `#2E2C28` | Warm near-black, never `#000` |
| Light elevation | soft diffuse shadow, large blur, ~4–8% black | Gentle floating-card feel — never hard or dark (Steep model). On **dark**, use lightness steps + hairline borders, **no** drop-shadows (they read cheap). |

### The five per-module hues (validated, but demoted to *identity*)

Lane 13's verdict: **KEEP the per-module hues, but they live only as small markers** — icon chips, faculty badges, the active spine, chart series, proposal-type tags. **Never** card backgrounds or large fills (every calm-premium reference is ~90% neutral). Tune all five to a **shared OKLCH lightness/chroma so no single faculty shouts** (lane 13: `L ≈ 0.70 / C ≈ 0.13`). Each hue also gets a `*.subtle` variant (high L, low C) for tag/pill backgrounds.

| Faculty | Hue | Token (intent) | `*.subtle` (tag bg) |
| --- | --- | --- | --- |
| Knowledge | blue | `module.knowledge` ≈ `oklch(0.70 0.13 250)` | high-L / low-C blue |
| Memory | violet | `module.memory` ≈ `oklch(0.70 0.13 300)` | high-L / low-C violet |
| Actions | green | `module.actions` ≈ `oklch(0.70 0.13 150)` | high-L / low-C green |
| Instructions | amber | `module.instructions` ≈ `oklch(0.70 0.13 80)` | high-L / low-C amber |
| Guardrails | rose | `module.guardrails` ≈ `oklch(0.70 0.13 20)` | high-L / low-C rose |

> Carry the hue as a **circular/rounded tinted chip on the faculty's icon/badge** (Revolut/Betterment/Vapi pattern). A distinct mark for Guardrails so "enforced" reads visually (lane 01).

### Semantic status colors (separate, reserved)

Kept entirely distinct from the module hues — these mean *run/health state*, consistent across every observability and billing surface (lanes 09, 12, 10):

| Token | Hue | Usage |
| --- | --- | --- |
| `status.success` | green | Completed sessions, "allow", healthy meters, done steps, valid fields |
| `status.warn` | amber | In-progress / "ask" / a meter nearing its limit / selected-row |
| `status.error` | rose/red | Crashed sessions (+ **faint full-row tint**), "deny", limit-reached, validation errors |
| `status.info` | blue/gray | Neutral info, running (some refs use purple for "running") |
| `status.running` | violet/purple | Live/active runs (Cursor/n8n convention) |

> Note the deliberate overlap: Knowledge-blue and `status.info`-blue, Actions-green and `status.success`-green, Guardrails-rose and `status.error`-red share a family. This is *fine and intentional* — context disambiguates (a hue on an icon chip = identity; the same family on a pill/row-tint = state) — but keep the exact tokens distinct so they can diverge if they ever conflict.

### One brand accent

zuzuu's own accent color, reserved for **the primary action + active nav only** (Ghost/Substack discipline). Not one of the five module hues. Appears on: the send button, the primary CTA in any flow, the active sidebar item's spine. Lane 13: an accent can carry emotional weight (Starling's glowing ring) precisely *because* it's the only saturated thing on a neutral field.

### The rationing rule

> **Default = no color (calm). Color earns its place by signaling something actionable.** A faculty card with nothing pending shows no color; an amber "3 pending" dot appears only when review is needed; a usage bar is neutral/green until it nears the limit, then warms. Module hues = identity markers only; status colors = state only; brand accent = primary action only. (Lanes 03, 09, 10, 12, 13.)

---

## Type

### Family pairing — duotype VALIDATED, boundary enforced

- **Geist Sans** — all product chrome and prose: nav, labels, buttons, headings, descriptions, the conversation transcript. Squarely in the premium grotesque/geometric-sans lane the references validate. Body ≈ 13–14px.
- **JetBrains Mono** — **machine-produced data ONLY**: ids, paths, durations, span ops, log lines, code blocks, diffs, the literal guardrail pattern chip. **Codified rule: mono is forbidden in product chrome.** The moment it leaks into nav/labels/buttons/prose/headings, zuzuu reads as a terminal. (Lanes 02, 09, 13.)
- **Serif display accent (NEW — lane 13's idea, adopt at display sizes only):** a serif for *reading/reflection* surfaces — digest intros, knowledge-fact rendering, proposal rationale — to import the Medium/Ghost calm-writing warmth. **Display/quote sizes only, never the UI font.** This is the cheapest way to inject the Notion-calm the brief wants on the surfaces that are about reading.

### Scale & weights

- **Weights (tight range, per lane 13):** regular `400` body · medium `500` labels & active-nav · semibold `600` headings. Resist a wider range.
- **One-hero-number-per-card:** the *only* large type jump. Faculty counts, generation numbers, streak counts, wallet balance, KPI values get the big numeral (≈28–48px); everything else stays in the body/label ramp. (Lanes 03, 06, 12, 13 — Steep `73.37K`, Starling `£34.14`.)
- **Two-tier rows everywhere:** medium primary label + smaller muted secondary (timestamp/author/description). The workhorse pattern across nav, history, sessions, palette, settings.
- **Numerals as the loudest element** in any progression context — never adjectives. The number *is* the celebration (lane 06).

---

## Spacing, radius, elevation

### Density scale

zuzuu sits **one notch calmer than Linear** — between dev-tool tier and calm-app tier (lane 13). The decisive rule that resolves the cross-lane tension:

- **Calm-tier (generous)** for everything human-facing: faculty grid, digest, onboarding, knowledge detail, settings, review, composer, empty states. Tall rows, real air between groups, ~20–24px card padding, content capped to a ~640–720px reading measure. (Lanes 01, 03, 13.)
- **Dev-tier (compact)** *only* inside genuine data tables: the trace span tree, the sessions table, the span inspector, raw logs. ~28–32px rows, column discipline. (Lanes 09, 13.)

A starting spacing step: `4 · 8 · 12 · 16 · 24 · 32 · 48` (px).

### Radius set

Lane 13: medium-soft, and **resist going rounder than ~12px** (Tiimo's ~16px pastel cards mark where premium tips into toy).
| Token | Value | Usage |
| --- | --- | --- |
| `radius.card` | `~10px` | Cards, tiles, proposal cards, panels |
| `radius.control` | `~8px` | Buttons, inputs, segmented controls |
| `radius.pill` | full-round | Status chips, host pill, faculty badges, mode chips |

### Elevation

- **Dark mode:** elevation-by-lightness (the ramp above) + hairline `border.subtle` where needed. **No drop-shadows** (cheap on dark).
- **Light mode:** soft, diffuse, low-opacity shadows (large blur, ~4–8% black) for a gentle float. Never hard or dark.
- **Selection** is a soft tinted-fill row (`bg.hover`), never a hard border.

---

## Motion vocabulary

Named transitions with intent, suggested duration/easing, and where they fire. The rule (lane 13): **celebrate the rare, calm the common** — expressive motion is a reward, never a default.

| Name | Intent | Duration / easing | Where used |
| --- | --- | --- | --- |
| `receipt.expand` | A one-line tool receipt opens to reveal its diff/output | ~180ms ease-out | Session pane (lane 02); trace span expand (lane 09) |
| `graduate.celebrate` | The *only* expressive motion: a proposal graduates / generation mints / streak milestone. Abstract glyph + sparse sparkle scatter, **inline & non-blocking** (a card in the activity stream, never a full-screen takeover) | ~700ms one-shot, rare by design | Review finish, generation mint, faculty graduation (lanes 06, 13) |
| `status.pulse` / `progress.fill` | Live "is it running?" signal + eased continuous fill for faculty-health rings/bars | continuous, smooth ease | Streaming session, provisioning stages, health meters (lanes 02, 08, 12, 13) |
| `toast.enter` / `toast.exit` | Quiet confirmation that arrives and auto-dismisses (approve, save, rollback) | ~200ms ease-out slide+fade, auto-dismiss | Review approve, settings save, rollback success (lanes 05, 07, 10, 13) |
| `panel.enter` | Detail/drawer/inspector rail slides in on selection | ~240ms | Trace span inspector, properties rail, slide-over detail (lanes 04, 09, 13) |
| `nav.active` / `card.hover` | Fast color/weight/border shift, **no movement** | ~120ms | Active nav item, card hover, hover-revealed affordances (lanes 01, 13) |
| `timetravel.scrub` | Dragging the checkpoint scrubber previews past states in place | follows pointer | Checkpoint time-travel (Pitch scrubber, lane 05) |

**Avoid:** per-action confetti (celebration inflation reads toy — Tangerine), full-screen takeovers that block the terminal, and any motion that interrupts work for a common event.

---

## Progression & gamification patterns

The honest mechanics worth borrowing, and the childish ones to avoid (lane 06 is the source; lanes 03/05/14 reinforce).

### Borrow (the mechanic, in a grown-up costume)

- **Generations-as-levels.** An ordinal ladder (Gen 1 → 2 → 3), rendered as a Mimo/Alan **restrained vertical path**: thin connector, small rounded-square nodes, one accent-ringed "current" node, lots of whitespace. The next node is "locked" with a **concrete** requirement ("3 more approved proposals to mint Gen 4" — Withings-style, never a vague "keep going").
- **Learned-counts as the loudest element.** "Gen 3 added 12 facts · 2 actions · 1 guardrail" rendered as **numerals against named faculties**. Pair with a "to next generation" horizon. The number is the celebration (Runna/Ahead model).
- **Streaks of clean sessions** — a flame + "8 clean sessions" or a small calendar. Framed as **recognition, never threat**: no "Don't lose your record!", no streak-freezes, no loss-aversion guilt (developers read it as a dark pattern).
- **Graduation moment** = the **Brilliant register**: a small abstract glyph (not a mascot), a factual sentence-case headline ("Knowledge graduated → Gen 3"), the concrete thing learned as text, a sparse sparkle scatter at most — **inline and non-blocking** (beehiiv model), anchored to the faculty node that changed.
- **Badges/milestones** = Me+/Runna-style **monochrome or single-accent medallions on neutral cards**, with the date and the concrete threshold. Locked ones ghosted with the requirement readable (Withings blur).
- **Progress dashboards** in the Stripe/Substack idiom: a single bold trend line or sparkline per faculty, big before→after counters. Intrinsically motivating *and* genuinely useful (it's real observability data).
- **Ambient progression pill** (lane 14): a persistent collapsed "Your agent: Gen 2 · 4 facts · 1 pending" — always-on evidence of growth without owning the screen.

### Avoid (the costume that makes a serious tool feel like a toy)

- **Cartoon mascots / googly-eyed characters** (Duolingo owl, Finch blob). The Mimo robot is the absolute ceiling, and even that should be optional, never load-bearing.
- **Full-screen confetti takeovers** — block work, read toy-like. Confetti, if ever, is a sparse brief non-blocking top layer.
- **Exclamation-heavy congratulatory copy** ("Perfect! Take a bow!"). Use factual sentence-case; let numbers carry the feeling.
- **Saturated primary palettes + chunky rounded display type** — stay Notion-calm / Brilliant: near-monochrome, one restrained accent, numerals as emphasis.
- **Coercive loss-aversion** — streak-loss warnings, streak-repair purchases, "don't break your chain" guilt.
- **Gems / coins / fake currency** — a meaningless points economy cheapens the tool. zuzuu's currency is the *real* artifacts: facts learned, actions graduated, generations minted.

> **The synthesis:** keep the dopamine *structure* (levels, counts, streaks, graduation), dress it in the *Brilliant + Me+ + Stripe* costume. zuzuu's advantage: its XP is genuine, so it can lean on facts for motivation and skip every artificial sweetener.
