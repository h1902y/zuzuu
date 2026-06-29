# zuzuu studio — design system

Editorial-brutalist ("The Bottom Line"): warm paper, ink, one vibrant orange accent, sharp corners, blueprint grids, monospace metadata. Build with the components below; for your own layout glue, use the utility vocabulary here.

## Setup — no wrapper needed

Brand tokens are defined at `:root` in `styles.css`, so components are styled the moment the stylesheet loads. There is **no theme provider** to wrap. Components render React from `window.ZuzuuDS.*`. Fonts (Space Grotesk, Inter, JetBrains Mono, Silkscreen) load via a Google Fonts `@import` in `styles.css`.

## Styling idiom — Tailwind utilities over brand tokens

Style your own layout with Tailwind classes bound to these tokens (don't hardcode hex):

| Role | Classes |
|---|---|
| Surfaces | `bg-background` (paper), `bg-card`, `bg-secondary` (dark ink panel) |
| Text | `text-foreground`, `text-muted-foreground`, `text-primary` (orange), `text-secondary-foreground` |
| Accent | `bg-primary` / `text-primary-foreground` (orange), `border-primary` |
| Lines | `border-border` |
| Radius | `rounded-sm` (sharp — the system is intentionally un-rounded) |

Type roles: `font-display` (Space Grotesk — headings), `font-sans` (Inter — body), `font-mono` (JetBrains Mono — labels/overlines, usually `uppercase tracking-[0.15em]`), `font-pixel` (Silkscreen — the wordmark only), `font-editorial` (Fraunces serif — an editorial register for gravitas; use sparingly for long-form or premium headlines).

## Registers

- **Dark:** wrap any element in **`.tbl-dark`** to flip to the deep-ink theme (ink surface, paper text, orange accent). Components restyle automatically via tokens — use it for heroes, CTAs, or a whole dark page. Don't add `.tbl-bevel` inside it (the bevel highlight is for light surfaces).
- **Functional secondary (teal):** `Badge` takes `tone="orange"|"teal"`; `Tag` takes `tone="default"|"teal"|"accent"`. Use teal for status/active/coding. Orange stays the single brand accent — never introduce a third hue.

Brand effect classes (in `styles.css`): `tbl-pad` (page horizontal rhythm), `tbl-hero` (paper→orange gradient), `tbl-grid` / `tbl-ticks` / `tbl-tickhover` (blueprint + corner/hover ticks), `tbl-stagger` (sequential child reveal), `tbl-blink`, `tbl-marquee`, `tbl-focus` (keyboard focus ring).

## Components

`Button` (variant: primary/ink/outline), `Badge`, `Overline` (§-marked mono label), `Wordmark`, `GridCell`, `Section` + `SectionHeading`, `Marquee`, `StatStrip`, `Hero`, `Statement`, `CardGrid`, `FeatureCard`, `StepCard`, `InkCTA`. Each has its API in `<Name>.d.ts` and usage in `<Name>.prompt.md` — read those before composing.

## Idiomatic snippet

```jsx
<Section className="tbl-hero tbl-ticks border-b border-border">
  <Hero
    badge="AI-native delivery"
    title="Websites and e-commerce stores, built like infrastructure."
    subtitle="One short supporting sentence."
    actions={[{ label: "Start a project", href: "#", variant: "primary" }]}
    stats={[{ value: "Build", label: "Storefronts" }]}
  />
</Section>
```

Keep one orange accent per view; lead with type and the blueprint grid, not shadows.

# ZuzuuDS (zuzuu-studio@0.1.0)

This design system is the published zuzuu-studio React library, bundled as a single
browser global. All 16 components are the real upstream code.

## Where things are

- `_ds_bundle.js` — the whole-DS bundle at the project root; loads every component to `window.ZuzuuDS`. First line is a `/* @ds-bundle: … */` metadata header.
- `styles.css` — the single stylesheet entry: it `@import`s the tokens, fonts, and component styles (`_ds_bundle.css`). Link this one file.
- `components/<group>/<Name>/<Name>.prompt.md` (example JSX + variants), `<Name>.d.ts` (types), `<Name>.html` (variant grid).
- `tokens/*.css` — CSS custom properties, names verbatim from upstream.
- `fonts/` — `@font-face` files + `fonts.css` (when the package ships fonts).

For a specific component, `read_file("components/<group>/<Name>/<Name>.prompt.md")`.

## Loading

Add these two lines to your page once (React must be on the page first):

```html
<link rel="stylesheet" href="styles.css">
<script src="_ds_bundle.js"></script>
```

Components are then available at `window.ZuzuuDS.*`. Mount into a dedicated child node (e.g. `<div id="ds-root">`), not the host page's own React root, so the two trees don't collide:

```jsx
const { Badge } = window.ZuzuuDS;
ReactDOM.createRoot(document.getElementById('ds-root')).render(<Badge />);
```

## Tokens

105 CSS custom properties from zuzuu-studio. Names are
preserved verbatim from upstream. They are declared inside `_ds_bundle.css` (this DS ships one compiled stylesheet rather than separate token files).

- **color** (29): `--text-xs`, `--text-xs--line-height`, `--text-sm`, …
- **spacing** (5): `--tw-space-y-reverse`, `--tw-inset-shadow`, `--tw-inset-shadow-alpha`, …
- **typography** (6): `--font-weight-medium`, `--font-weight-bold`, `--default-font-family`, …
- **radius** (1): `--radius`
- **shadow** (7): `--tw-shadow`, `--tw-ring-shadow`, `--tw-shadow-alpha`, …
- **other** (57): `--spacing`, `--container-xl`, `--container-3xl`, …

## Components

### landing
- `Badge`
- `Button`
- `CardGrid`
- `FeatureCard`
- `GridCell`
- `Hero`
- `InkCTA`
- `Marquee`
- `Overline`
- `Section`
- `SectionHeading`
- `Statement`
- `StatStrip`
- `StepCard`
- `Tag`
- `Wordmark`
