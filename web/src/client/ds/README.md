# The workbench design system

The DS lives **in code**: the **tokens** are the Tailwind v4 `@theme` block in
[`../index.css`](../index.css); the **primitives** + **kit** are here in `ds/`. Everything
composes from tokens — **zero inline styles, no arbitrary values** (a screen is built from
primitives + kit, never raw utilities with magic numbers). Copy-owned (shadcn/Radix pattern),
MIT-only, heavy libraries lazy-loaded off the initial bundle.

---

## 1. Fonts

A **duotype + mono split**; weight is the hierarchy lever.

| Token | Face | Role |
|---|---|---|
| `--font-sans` | **Elms Sans** (variable 100–900, +italic) | UI · body · **headings** (weight carries hierarchy) |
| `--font-display` | = Elms Sans | headings (the variant exists so a distinct heading face could slot in later) |
| `--font-logo` | **Train One** | the **brand/hero** face only — logotype, hero identity, empty states |
| `--font-mono-display` | **Space Mono** | the terminal (coder character) |
| `--font-mono-data` | **JetBrains Mono** (variable) | dense grids · ids (legibility) |

- **Weight:** `--font-weight-chrome: 510` · `--font-weight-emphasis: 590`. Never stack >2 hierarchy signals (size · weight · case · tone).
- **Scale:** `meta 12 · sm/ui 14 · body 16 · base 20 · lg 24 · xl 30 · 2xl 36`. Dense workhorse stays at 12/14.
- **Tracking:** +0.01em on small UI; reset on `.xterm`.
- **Heading vs hero:** in-content titles use `font="display"` (Elms Sans, legible); brand/hero/empty moments opt into `font="logo"` (Train One).
- All self-hosted via `@fontsource` (no CDN — works offline).

## 2. Spacing — a 4px rhythm, owned by the layout primitives

| step | none · xs · sm · md · lg · xl |
|---|---|
| gap/pad (px) | `0 · 4 · 8 · 12 · 16 · 24` |

- **Radius:** `sm 4 · ui 6 · lg 10`. **Bar height:** 34px.
- Spacing is **only** expressed through `Stack`/`Inline`/`Box`/`Grid` variants — never an inline `p-*`/`gap-*` with a magic number.
- **Density:** Linear-ish (rich rows ~32–36px); grade importance with weight/tone, not whitespace.

## 3. Colors — warm dual-theme (Flexoki-based)

Everything derives from one **ink ramp**, swapped per theme; semantic aliases auto-follow it.

| Group | Tokens |
|---|---|
| ink ramp | `ink-950 → ink-100` (9 steps) |
| semantic aliases | `app · surface · elevated · hover · border · muted · subtle · selected · focus` |
| accent (fixed both themes) | coral `#f25c54` + `accent-dim` |
| status (state only) | `success · warning · danger` (cooler crimson ≠ accent) · `info` |
| module hues (identity chips only) | knowledge · memory · actions · instructions · guardrails |
| overlay | `--color-scrim` · `--shadow-overlay` |

**Rules:** color = **state**; dense surfaces use the ramp + text tiers only; **accent rationed** to primary/active/focus; module hues are small identity chips, never fills. Light + dark ship with a real toggle (`state/theme.ts`, pre-paint, no flash).

## 4. Components

**Primitives** (`primitives/`, recipe-driven, zero-inline): `Text` · `Stack` · `Inline` · `Box` · `Grid`.
`Text` vocab: `size` · `tone` (default/muted/subtle/accent/danger) · `weight` (normal/medium/semibold) · `font` (sans/display/logo/mono/data) · `truncate` · `interactive`.

**Kit (built)** (`kit/`): `Button` · `Icon` (Lucide) · `Chip` (module + status tones) · `Cell` (typed value) · `Markdown` (lazy) · `Dialog` · `Toaster` · `EmptyState` · `Loading`/`Empty` · `ThemeToggle` · `Brand` · `AppHeader` · `AppFooter` · `ListCard` · `EmojiPicker` · `Stepper`.

**Kit (roadmap):**
- **Form controls** — `Input · Textarea · Select · Checkbox/Switch · NumberInput · DatePicker · Combobox` → these back the **FieldType registry's input renderer** (the registry's third part: cell · field-config · **input**) and the record edit form.
- **Overlays** — `Popover · Tooltip · DropdownMenu` (copy-owned over Radix/Base UI).
- **Display** — `Badge` · `Tag` · `Avatar` · `Card` · `Skeleton` · `Tabs` (promote the stage's hand-rolled tab strip).

## 5. Conventions

- **Zero inline styles / no arbitrary values** — compose primitives + kit; spacing/type/color are tokens. Guards the Notion-calm consistency.
- **Copy-owned, MIT-only.** No batteries UI lib (fights Tailwind v4 + the warm aesthetic). Heavy libs (`react-markdown`, future `react-table`/diff/graph) lazy-load in their own chunk.
- **The FieldType registry is the data joint** — one `Map<FieldType, FieldConfig>` drives the grid **cell**, the record **input**, and schema graduation. See [`../data/field-registry.ts`](../data/field-registry.ts).
- **Lean, not zero-dep** — that's the CLI core's rule; `web/` adopts a library when it closes a real gap (see the library ratification in `docs/design-research/workbench/10-spec-vs-built-reconciliation.md` §6).
