# 07 — UI Component Foundation

_The component-foundation decision for the locked Vite + React 19 + TypeScript + Tailwind v4 workbench._

This is pass-② of the workbench design research. Where the Mobbin brief (pass-①) fixed the **visual language** (Notion-calm × Duolingo-progression, premium-not-toylike, color-only-for-state, calm by default) and `05-experience-spec.md` locked the **experience** (two worlds — Work and Brain — over a Project-as-database), this document fixes the **build foundation**: the design-system and primitive layer the workbench is built _on top of_, and what the React-Admin / dashboard-framework lineage teaches us about how internal data-apps are _structured_.

**Cross-references:** the locked experience is [`05-experience-spec.md`](./05-experience-spec.md) (two worlds → grid + views + filter-chips → envelope record side panel → ER graph → audit); the broader library landscape is [`03`](./03-library-landscape.md) (the dependency-shape survey). This doc supersedes nothing — it _grounds_ the build phase.

**The stack is locked and non-negotiable for this analysis:** a LEAN Vite + React 19 + TypeScript + Tailwind v4 SPA, deliberately small (rebuilt 18.1k → 1.7k LOC), with its own small kit today at `web/src/client/panel/kit.tsx`. Constraints: MIT-ish licenses only, bundle discipline (lazy-load heavy stuff), Tailwind v4 + React 19 compatibility REQUIRED, and a strong prior toward **owning a small kit** over a heavy dependency.

---

## Table of contents

1. [Executive summary & recommendation](#1-executive-summary--recommendation)
2. [Master ADOPT / LEARN-FROM / AVOID table](#2-master-adopt--learn-from--avoid-table)
3. [Headless primitives — the layer to build on](#3-headless-primitives--the-layer-to-build-on)
4. [Batteries-included component libraries](#4-batteries-included-component-libraries)
5. [Dashboard & data-app component kits](#5-dashboard--data-app-component-kits)
6. [React-Admin & dashboard frameworks — how internal dashboards are STRUCTURED](#6-react-admin--dashboard-frameworks--how-internal-dashboards-are-structured)
7. [The token / design-system approach](#7-the-token--design-system-approach)
8. [Surface map — what to use where](#8-surface-map--what-to-use-where)
9. [Open questions for the build phase](#9-open-questions-for-the-build-phase)
10. [Sources](#10-sources)

---

## 1. Executive summary & recommendation

**Recommendation: own a small kit. Do not adopt any component library or dashboard kit as a runtime dependency.**

The single clearest finding across every section below: **none of the batteries-included libraries is cleanly addable to a Tailwind v4 + React 19 SPA without friction** — except HeroUI v3, which is built _on_ Tailwind v4 but locks you into its styling decisions and aesthetic. Every other library (MUI, Mantine, Ant Design, Chakra) ships a parallel CSS-variable / CSS-in-JS theming system that fights Tailwind v4 for CSS-layer order, costs 55–120 KB gzipped, and imposes an aesthetic re-theming tax pulling _away_ from Notion-calm. For a kit that is already 1.7k LOC and already owns `kit.tsx`, that is all cost and little gain.

**The foundation is a copy-owned shadcn-style kit:**

- **Generate from the shadcn/ui CLI**, backed by **Radix primitives** by default and **Base UI** (shadcn opt-in since Jan 2026) for the gaps Radix deprioritized (notably Combobox). Both are MIT, both are Tailwind-v4 + React-19 native, both are copy-owned — zero runtime dependency on a UI library at the app level. `shadcn eject` (May 2026) removes the package entirely. This _seeds_ and reconciles the existing `kit.tsx`; it does not replace it wholesale.
- **The only true npm additions** are headless and style-free: **TanStack Table v8** (→ v9 when stable) for the Brain grid, **TanStack Virtual** for large note sets, and **cmdk** for the command palette. None carries a styling layer; none conflicts with Tailwind v4.
- **Lazy-load `react-aria-components` on the Brain table route only** — its `Table` is the most complete headless data-grid primitive in React (ARIA grid semantics, keyboard cell-nav, multi-select, column sort), and its `TagGroup` fits the filter-chips. That ~50 KB gzipped import is worth it on _one_ route, behind a dynamic import, and nowhere else. (If TanStack Table + owned cells covers the grid sufficiently, React Aria stays optional — decide at build time; see Open Questions.)
- **Recharts** is the one heavyweight chart peer (~45 KB gz) and must be lazy-loaded behind a dynamic import; the dashboard stat tiles themselves are pure TSX + Tailwind, zero chart dependency.

**The structural lessons (Section 6) are adopted as in-repo _patterns_, not packages:** React-Admin's `ListContext` pull model, its `ListBase`/`ShowBase` headless-shell split, and its `<Resource>` = route + view-set declaration map directly onto zuzuu's two-world shell. Import the mental model; never the framework (it pulls MUI).

**Aesthetic dial:** use shadcn's **Rhea** style (May 2026 — Luma's rounded foundation at compressed density) for the dense Brain surfaces (grid, side-panel, filter chips, review queue) and **Luma**'s breathing room for the Work world's session cards and stat callouts. Color only for state (green = approved/active, amber = pending/review gate, red = rejected/error).

This keeps the component layer under ~25 KB at the app level, preserves full Tailwind v4 ownership, makes the kit AI-legible (plain React + Tailwind, no proprietary API), and avoids the re-theming tax. **Kobalte (SolidJS) and Headless UI (too narrow) are out. Ariakit and Ark UI are Combobox/complex-widget fallbacks if Base UI's API proves awkward in practice.**

---

## 2. Master ADOPT / LEARN-FROM / AVOID table

| Option | Tailwind v4 | React 19 | License | Bundle (gz) | Verdict for zuzuu |
|---|---|---|---|---|---|
| **shadcn/ui** (CLI + registry; Rhea/Luma styles, Sidebar block, Command) | Native (reference impl) | Native (`React.ComponentProps`, `data-slot`) | MIT | ~0 runtime (copy-owned) + peers | **ADOPT** — the foundation. Seeds & reconciles `kit.tsx`; `eject` removes the package |
| **Radix Primitives** (via shadcn) | Unstyled, you style | Yes (patched late; Feb 2026 unified `radix-ui` pkg) | MIT | ~2–5 KB/component, Dialog ~9 KB | **ADOPT (indirect)** — get it through shadcn. Stable for Dialog/Popover/Tooltip/Menu/Tabs/Select. Velocity slowed post-WorkOS |
| **Base UI** (MUI; via shadcn opt-in) | Headless, any styling | Native (built post-React-19) | MIT | ~+10 KB gz vs Radix (issue #3688) | **ADOPT for gaps** — the Combobox/Autocomplete/multi-select Radix never shipped. Single-primitive-layer pick if you want one |
| **React Aria Components** (Adobe) | Native (`data-*`, `entering:`/`exiting:`) | Yes (arrived later than Base UI) | Apache 2.0 (MIT-compat) | ~165 KB whole; Table adds ~50 KB | **ADOPT selectively (lazy)** — best headless `Table` + `TagGroup`. Brain grid route ONLY, behind dynamic import |
| **TanStack Table v8 / v9** | No style layer | Yes | MIT | v8 ~13–20 KB; v9 ~6–7 KB | **ADOPT** — the grid surface needs it. Headless, no conflict; pair with TanStack Virtual |
| **TanStack Virtual** | No style layer | Yes | MIT | ~3 KB | **ADOPT** — large note sets (>500 rows) |
| **cmdk** | No style layer | Yes | MIT | ~8 KB | **ADOPT** — command palette (Linear/Raycast pattern); shadcn `Command` wraps it |
| **Recharts** (via shadcn chart blocks) | n/a | Yes | MIT | ~45 KB | **ADOPT (lazy only)** — dynamic-import behind chart routes; stat tiles stay pure TSX |
| **Ariakit** | Plus theme upcoming | Yes (no forwardRef legacy) | MIT (core); Plus paid | Smaller than React Aria, ~Radix | **LEARN-FROM / fallback** — cleanest Combobox API; backup if Base UI awkward |
| **Ark UI / Zag.js** | Style-agnostic | Yes | MIT | ~Radix/component | **LEARN-FROM** — FSM-based complex widgets (combobox, datepicker). Study if building custom |
| **Headless UI** (Tailwind Labs) | First-class | Yes | MIT | larger-than-scope (issue #568) | **AVOID** — too narrow (no Table/Command/virtualized Combobox); outgrown fast |
| **Kobalte** | — | — (SolidJS) | MIT | — | **AVOID** — wrong framework |
| **HeroUI v3** (React Aria + TW v4) | **Native (IS Tailwind)** | Yes | MIT | ~18–30 KB est. | **AVOID as foundation / cherry-pick** — only lib where TW v4 is native, but locks styling; aesthetic needs taming. Pull single components if needed |
| **Mantine v9** | Community layer hack (`@layer … mantine …`) | Yes (v9 dedup) | MIT | ~55 KB slice; ecosystem ~130–160 KB | **AVOID as foundation / LEARN-FROM** — dual theming. But **Spotlight** (cmd palette) + `mantine-datatable` are strong targeted pulls |
| **MUI v6/v7** | Layer dance (`enableCssLayer`) | Yes | MIT core / commercial X | ~95 KB slice; DataGrid 90 KB+ | **AVOID** — heaviest, CSS-in-JS specificity war, Material fights calm, X licensing lock-in |
| **Ant Design v6** | Layer config (`StyleProvider`) | Native (v6) | MIT | ~120 KB slice; full 350 KB+ | **AVOID** — largest bundle, enterprise-dense aesthetic furthest from brief |
| **Chakra UI v3** | Parallel CSS-var system | Partial (issue #8519 open) | MIT | ~65 KB slice | **AVOID** — duplicates Tailwind's job worse; React 19 instability in 2026 |
| **PrimeReact v11** | Layer config; `pt` unstyled mode | Yes | MIT | 0 (unstyled) + JS behavior | **LEARN-FROM** — `pt` pass-through pattern; unstyled DataTable as a bridge only |
| **Tremor (`@tremor/react` npm)** | v3-only; v4 needs rewrite | **No (React 18 peer; issue #1072)** | Apache 2.0 | Recharts+HeadlessUI hard deps | **AVOID (npm)** — stale, blocked dep graph |
| **Tremor (new copy-paste, tremor.so)** | TW v4 templates; CLI beta | Radix-based | MIT (blocks) | copy-owned | **LEARN-FROM** — copy KPI-card + BarList JSX patterns when CLI stabilizes |
| **Tailwind Plus / Catalyst** | Native (TW v4.x) | Yes (HeadlessUI v2) | Proprietary ($299/$979) | source (own it) | **LEARN-FROM (OSS) / ADOPT if purchased** — best TW-v4-native styled kit; license blocks OSS shipping |
| **Untitled UI React** | Native (TW v4.3) | Native (19.2) | MIT (free tier) / PRO | copy-owned + React Aria | **LEARN-FROM / CONSIDER** — strong dashboard template coverage; React Aria base |
| **Saas-UI** | None (Chakra) | — | MIT / paid | Chakra+Emotion ~60–80 KB | **AVOID** — Chakra CSS-in-JS, architecture mismatch |
| **Geist (`@vercel/geist`)** | n/a (not a 3rd-party kit) | n/a | — | n/a | **AVOID as kit / LEARN-FROM tokens** — borrow the gray ramp + Geist font as design reference |
| **React-Admin** (marmelab) | MUI skin fights TW; `shadcn-admin-kit` is TW v4 | No official R19; pnpm+ESM friction (#11111) | MIT / enterprise | full ~315 KB; `ra-core` smaller | **LEARN-FROM** — structural gold (ListContext, ListBase/ShowBase, Resource). Never import (pulls MUI) |
| **Refine** (refinedev) | Headless → trivial | Yes (v5, Feb 2026) | MIT | `@refinedev/core` ~126 KB | **LEARN-FROM** — provider injection + `useTable`/`useList` split; "same layout, different context" two-world pattern |
| **shadcn-admin** (satnaing template) | Yes (TW v4) | Yes | MIT | template (no runtime fw) | **ADOPT as pattern-mine** — read its Sidebar shell + cmdk wiring; copy patterns, not a package |
| **Mosaic Lite** (Cruip) | Native (TW v4) | Yes | **GPL** | template | **AVOID** — GPL constraint; MIT alternatives cover it |
| **Tabler** | None (Bootstrap) | wrapper | MIT | — | **AVOID / LEARN-FROM inventory** — Bootstrap vs Tailwind war; use only as a page checklist |
| **Horizon UI** | Tailwind | unconfirmed | MIT | template | **AVOID** — glassmorphism aesthetic, stale (no 2025+) |

---

## 3. Headless primitives — the layer to build on

The core question is _which primitive layer you build on_, not which pre-built kit you install. That choice determines styling freedom, bundle cost, React-19 friction, and maintenance exposure.

### shadcn/ui — the distribution layer (the answer)

Not a library — a CLI-driven code-generation registry. Components land as **editable source in your repo**; you own every line. As of Feb 2026 the `new-york` style uses a unified `radix-ui` package, and the CLI supports a `--base-ui` flag to back components with either Radix or Base UI. 75k+ stars, ~20M monthly npm downloads. The tradeoff is explicit: upstream fixes are not pushed — you port them. The gain: zero black-box abstractions, maximum Tailwind freedom, AI-friendly (just React + Tailwind). **Tailwind v4 + React 19:** full, reference-grade — `@theme inline`, OKLCH tokens, `forwardRef` removed for `React.ComponentProps`, `data-slot` for state-targeted styling; `tailwindcss-animate` → `tw-animate-css`. **Styles:** Luma (rounded, soft elevation, breathable — macOS-Tahoe register, premium-calm) and **Rhea** (Luma's geometry at compressed density — "focused product interfaces"). `shadcn eject` (May 2026) inlines utilities and drops the package. **License:** MIT. **The ADOPT.** Seed the grid, side-panel, command palette, review queue from shadcn then mutate freely. Don't let it become an inescapable dependency — copy-paste is the whole point. [docs](https://ui.shadcn.com/docs/tailwind-v4) · [Rhea changelog](https://ui.shadcn.com/docs/changelog/2026-05-rhea) · [Feb 2026 unified Radix](https://ui.shadcn.com/docs/changelog/2026-02-radix-ui)

### Radix UI Primitives — the incumbent headless layer

~30 unstyled, accessible components (Dialog, Popover, Select, DropdownMenu, Tabs, Tooltip…), now consolidated into one `radix-ui` umbrella (Feb 2026). Maintained by WorkOS; `@radix-ui/react-slot` ~131M weekly downloads. **React 19** compat arrived late (patches over 2024–25 caused real upgrade friction for early movers); the unified package resolves multi-package version conflicts. **Bundle:** Dialog ~9.2 KB gz (~28 KB with cross-package deps); tree-shakes at package level. **Maintenance signal:** velocity on complex components (Combobox especially) slowed post-acquisition — Combobox was scoped out for years. For the 30 patterns it nailed, stable. **License:** MIT. **ADOPT via shadcn** for Dialog/Popover/Tooltip/DropdownMenu/Tabs/Select; do not depend on it for Combobox. [primitives](https://www.radix-ui.com/primitives)

### Base UI — the actively maintained challenger

MUI's headless successor, MIT, built by 7 full-timers (creators of Radix, Floating UI, Material UI), with intentional Radix API compatibility for migration. Stable `@base-ui/react` v1.6.0 (June 2026); Combobox + Autocomplete (Sep 2025), native multi-select, Drawer, NavigationMenu, Toast added 2025–26. **React 19:** built after R19 patterns settled — no `forwardRef` legacy, no ref friction. **Bundle:** slightly larger than Radix — Dialog ~6.4 KB gz (~18 KB total), roughly +10 KB gz delta vs Radix through Next.js bundling (issue #3688); smaller under Vite's tree-shaking. **A11y:** WCAG 2.2, WAI-ARIA APG. **License:** MIT. **ADOPT for Combobox + complex patterns** — the command palette, note search, multi-select. The single-primitive-layer pick if you want one. [base-ui.com](https://www.base-ui.com/) · [bundle issue #3688](https://github.com/mui/base-ui/issues/3688)

### React Aria Components (Adobe) — accessibility-maximum

50+ headless components: Color Picker, Calendar/DatePicker, DnD, **Table with sort/selection**, ComboBox with async loading, **TagGroup**, Meter, ProgressBar. Hooks layer (`react-aria`) separate from components layer (`react-aria-components`). **TW v4 + React 19:** fully supported — `className`, `data-selected`/`data-hovered`, `entering:`/`exiting:` utilities; R19 arrived later than Base UI. **Bundle (the caveat):** whole lib ~165 KB min; single Button ~8.1 KB; a Menu adds ~50 KB gz. Tree-shaking works in Vite with correct PURE annotations; shared utility layer means the 3rd/4th component is much cheaper than the 1st. **Standout:** the `Table` is the most complete headless data-grid primitive in React; `TagGroup` is production-ready for filter-chips; calendar/date pickers uniquely thorough. **License:** Apache 2.0 (MIT-compat). **ADOPT selectively, lazy** — Brain grid route only; dialogs/popovers/menus go to Radix/Base UI. [react-aria](https://react-aria.adobe.com/) · [bundle #5636](https://github.com/adobe/react-spectrum/discussions/5636)

### Ariakit — the lean specialist

MIT unstyled primitives (Diego Haz, since 2017). API between Radix's composition and React Aria's hooks-first. Strong Combobox, Select, Dialog, Popover, Menu, Tabs, Toolbar, Form. No Table/DataGrid. Ariakit Plus = paid Tailwind-styled layer. **Bundle:** smaller than React Aria, ~Radix; a benchmark cited Combobox with 1000 items opening ~56 ms vs 128–2920 ms competitors. **React 19:** no issues (no forwardRef legacy). **LEARN-FROM / Combobox fallback** if Base UI feels over-engineered. [ariakit.com](https://ariakit.com/) · [perf newsletter](https://newsletter.ariakit.com/p/performance-tailwind-v4-and-more)

### Headless UI (Tailwind Labs) — the cautious pick

~16 components (Dialog, Popover, Combobox, Listbox, Menu, Tabs, Switch…), v2.2.10. No Table, no Form, no complex composites. TW v4 first-class; works with Catalyst. Bundle larger-than-scope (discussion #568). **AVOID** — narrow set, basic Combobox; no benefit over shadcn + Radix/Base UI. [headlessui.com](https://headlessui.com/)

### Ark UI / Zag.js — FSM primitives

State-machine-driven (XState/Zag.js), 45+ headless components, cross-framework, style-agnostic, MIT. More predictable complex-component behavior (Combobox, DatePicker) than controlled-state implementations. **LEARN-FROM** — study if building a custom Combobox/datepicker for the filter-chip surface. [ark-ui.com](https://ark-ui.com/)

### Kobalte — not applicable

SolidJS. **AVOID** entirely.

---

## 4. Batteries-included component libraries

The verdict across all six: **own the kit; borrow only the hard behavioral surfaces.** Every batteries library ships a styling system that fights Tailwind v4 for layer order and imposes an aesthetic re-theming tax — except HeroUI, which trades that for styling lock-in.

| Library | Gz page slice | Tailwind v4 | React 19 | License | Aesthetic fit |
|---|---|---|---|---|---|
| MUI v6 | ~95 KB | Layer dance required | Yes | MIT core / commercial X | Fights calm — **AVOID** |
| Mantine v9 | ~55 KB | Community workaround | Yes (v9) | MIT | Neutral; adaptable — **LEARN-FROM (Spotlight)** |
| Ant Design v6 | ~120 KB | Layer config required | Yes (v6) | MIT | Enterprise-dense — **AVOID** |
| Chakra v3 | ~65 KB | Parallel-system conflict | Partial | MIT | Neutral but redundant — **AVOID** |
| HeroUI v3 | ~18–30 KB | **Native (is Tailwind)** | Yes | MIT | Modern, tunable — **cherry-pick** |
| PrimeReact v11 | 0 (unstyled) | Layer config | Yes | MIT | Blank canvas — **LEARN-FROM (`pt`)** |
| Park UI / Ark UI | ~0 (copy-paste) | Style-agnostic | Yes | MIT | Tasteful — **LEARN-FROM** |

**MUI (Material UI) v6/v7** — heaviest here. `@mui/material` ~95 KB gz for one page slice; DataGrid alone 90 KB+ (must lazy-load); full imports approach 300 KB+. TW v4 needs `enableCssLayer: true` + explicit `@layer` ordering (fragile on upgrade). Material aesthetic (ripples, elevation) fights Notion-calm; MUI X licensing locks the grid. **AVOID.** [TW v4 guide](https://mui.com/material-ui/integrations/tailwindcss/tailwindcss-v4/) · [bundle #42958](https://github.com/mui/material-ui/issues/42958)

**Mantine v9 (April 2026)** — 120+ components, CSS-variable based (dropped Emotion in v7). v9 adds R19 style dedup. TW v4 works via community `@layer theme, base, mantine, components, utilities` glue (not officially blessed). ~55 KB slice; ecosystem ~130–160 KB but replaces 6–8 packages. **LEARN-FROM / targeted pull:** **Spotlight** is the best ready-made command palette; `mantine-datatable` is a strong grid option if complexity warrants a dependency. Don't adopt wholesale — the TW v4 story is glue. [mantine.dev](https://mantine.dev/) · [TW v4 #7459](https://github.com/orgs/mantinedev/discussions/7459)

**Ant Design v6 (Nov 2025)** — R19 native, ~62% bundle cut vs v5 (~40 KB tree-shaken) but full import 350 KB+; ConfigProvider can sabotage tree-shaking; icons a separate trap. TW v4 via `StyleProvider` `@layer`. Enterprise-dense aesthetic furthest from the brief. **AVOID.** [v6 migration](https://ant.design/docs/react/migration-v6/)

**Chakra UI v3** — moved to Ark UI primitives + own `createSystem` CSS-var theming (parallel to Tailwind, collides in practice). R19 issue #8519 still open mid-2026 (popover/animation bugs). ~65 KB slice. Duplicates Tailwind's job with worse tooling. **AVOID.** [#8519](https://github.com/chakra-ui/chakra-ui/issues/8519)

**HeroUI v3 (formerly NextUI)** — built _on_ React Aria + Tailwind v4; two packages (`@heroui/react`, `@heroui/styles`), Framer Motion removed (handcrafted CSS). The _only_ major batteries lib where TW v4 is native (no layer conflict — it _is_ Tailwind utilities; `hero.ts` config, CSS-first since 2.8.0). R19 out-of-the-box. Strongest a11y (React Aria). Bundle structurally light (no JS styling runtime). Aesthetic leans sleek-showcase; needs palette restraint for calm. **Cherry-pick** single components (Select/Combobox/Modal/DatePicker) when you need the behavior — don't adopt as foundation (styling lock-in). [heroui.com](https://heroui.com/) · [TW v4 guide](https://beta.heroui.com/docs/guide/tailwind-v4)

**PrimeReact v11** — ~100 components, **unstyled/pass-through (`pt`)** mode reduces it to a headless a11y+behavior layer styled by your Tailwind (zero CSS footprint). TW v4 needs `@layer` preflight config. **LEARN-FROM:** the `pt={{ root: { className: '…' } }}` adapter pattern; the unstyled DataTable as a virtual-scroll bridge if needed. Too large + verbose as a primary dep. [primereact.org/tailwind](https://primereact.org/tailwind/)

**Park UI / Ark UI** — copy-paste on Ark UI's FSM primitives, Panda CSS default + Tailwind variant, MIT, near-zero install. Tasteful, shadcn-adjacent. **LEARN-FROM** — Ark UI's state-machine reliability for Combobox / multi-step review flows. [park-ui.com](https://park-ui.com/)

---

## 5. Dashboard & data-app component kits

**shadcn/ui (blocks + charts + sidebar)** — the dashboard foundation. `dashboard-01` block (sidebar + area chart + data table + section cards), Sidebar variants, cmdk Command. Charts layer Recharts (~45 KB gz, pulled only when added); DataTable guide = TanStack Table + shadcn `<Table>` + column visibility/row selection/server-side sort hooks (URL state via `nuqs` is the community pattern). TW v4 + R19 native, OKLCH tokens, MIT, zero runtime from shadcn itself. The `Sidebar`/`SidebarProvider` (icon-collapse, Cmd+B, three collapsible variants) is the nav-rail. **ADOPT** for nav rail, sidebar, command palette, data table primitive, form controls, section cards, dialog/sheet. [blocks](https://ui.shadcn.com/blocks) · [Sidebar](https://ui.shadcn.com/docs/components/radix/sidebar) · [data table](https://ui.shadcn.com/docs/components/radix/data-table)

**Tremor** — two products: (a) `@tremor/react` npm (v3.18.x, **React 18-only peer, TW v3-only**, blocked dep graph — issue #1072 / discussion #1010) — **hard AVOID**; (b) the new copy-paste "Tremor Raw" at tremor.so (post-Vercel-acquisition, Radix + TW v4 templates, CLI beta) — **LEARN-FROM:** its 23+ KPI-card variants and BarList are the best calm, semantic-color stat-tile reference; copy the JSX into our kit once the v4 CLI stabilizes. [tremor.so](https://www.tremor.so/) · [KPI cards](https://blocks.tremor.so/blocks/kpi-cards) · [Vercel acquires](https://vercel.com/blog/vercel-acquires-tremor)

**Tailwind Plus / Catalyst** — Catalyst (25+ components, source ZIP, HeadlessUI v2 + TW v4.x + R19) and UI Blocks (19 table / 5 stat / 8–9 shell variants). Premium-calm, copy-paste source (no lock-in). **Proprietary** ($299/$979) — blocks OSS shipping. **LEARN-FROM** the stat/table/shell patterns; **ADOPT if purchased** (best TW-v4-native styled kit; clean for a proprietary surface). [UI kit](https://tailwindcss.com/plus/ui-kit) · [UI blocks](https://tailwindcss.com/plus/ui-blocks)

**Untitled UI React** — copy-paste on React Aria v1.16 + TW v4.3 + React 19.2; free tier MIT (base + application UI), PRO adds 250+ dashboard examples. Warmer-than-shadcn, premium-but-calm. **LEARN-FROM / CONSIDER PRO** for dashboard template coverage. [untitledui.com/react](https://www.untitledui.com/react)

**Saas-UI** — Chakra-based, CSS-in-JS runtime (~60–80 KB), no Tailwind. **AVOID** — architecture mismatch. [saas-ui.dev](https://saas-ui.dev/)

**Geist (Vercel)** — `@vercel/geist` is internal tooling, not a consumable kit. **AVOID as kit / LEARN-FROM tokens** — borrow the gray ramp + Geist font for the premium-not-toylike register. [geist](https://vercel.com/geist/introduction)

---

## 6. React-Admin & dashboard frameworks — how internal dashboards are STRUCTURED

This is the load-bearing section: not which kit, but how data-apps are _composed_. **Adopt the structural vocabulary; import none of the frameworks.**

### React-Admin (marmelab) — the reference, studied deeply

Opinionated SPA framework over REST/GraphQL. Two-package split: **`ra-core`** = the headless engine (`useListController`, `useEditController`, `ListContextProvider`, `CoreAdminContext`, `CoreAdminUI`, `ListBase`, `EditBase`, `ShowBase` — no MUI, usable with any UI) and **`ra-ui-materialui`** = the heavy MUI skin. **`shadcn-admin-kit`** (marmelab, MIT, 2025) is the official `ra-core` companion on shadcn/ui + Tailwind (TanStack Router, copies ~114 files into `components/`). The Feb 2026 update widened the UI-agnostic surface (moved `useUpdateController`, `ArrayInputBase`, etc. into `ra-core`). **R19/TW v4:** no official R19 docs; pnpm+ESM friction (#11111); the MUI skin fights Tailwind, but `shadcn-admin-kit` assumes TW v4. **Bundle:** full react-admin ~315 KB gz; `ra-core` much smaller. **LEARN-FROM; AVOID the MUI skin and the framework itself** (overkill — zuzuu has a trivial local SQLite store, not a REST/GraphQL provider to abstract). [Architecture](https://marmelab.com/react-admin/Architecture.html) · [ra-core + custom UI](https://marmelab.com/blog/2023/11/28/using-react-admin-with-your-favorite-ui-library.html) · [shadcn-admin-kit](https://github.com/marmelab/shadcn-admin-kit)

### The structural patterns to mirror in zuzuu's two-world shell

1. **Context-pull for list state (`ListContext`).** The controller (fetch + filter/sort/pagination) lives one level up; grid, filter chips, and pagination all `useListContext()` to read/write — no prop drilling. **→ zuzuu:** a `<NotesListProvider module="knowledge" filters={…}>` exposing `{notes, total, filters, setFilters, sort, setSort}`, consumed by the grid, the filter-chip bar, and the side-panel. Eliminates the drilling problem as Brain surfaces proliferate. (Refine teaches the same via `useTable`/`useList`.)

2. **Headless CRUD shells (`ListBase`/`ShowBase`/`EditBase` split).** Separate the data shell (no chrome) from the chrome shell (title/card/actions) from the iterator (the rows). **→ zuzuu:** `<NotesTableBase>` (data) wraps `<NotesGrid>` (iteration) wraps `<NoteRow>` (cells); the side-panel `<NoteRecord>` is a `ShowBase` analog reading a `RecordContext`, not props. The `<Datagrid>` child-inspection pattern (columns derived declaratively from Field children) maps onto frontmatter=columns.

3. **Resource = route + view-set (`<Resource name list edit show>`).** Declaring a resource auto-registers its nav item. **→ zuzuu:** the Brain world's nav-rail items map to module types (Knowledge, Memory, Actions…); each maps to a `module/:id` route composing list (grid) + side-panel (record/form) + audit — the same concept without react-admin's machinery.

4. **Command palette as a shell-level primitive (Mantine Spotlight + satnaing's template).** Cmd+K is mounted in the _root shell_, not a page feature, searching across notes, modules, and actions.

5. **Two-world shell via layout-slot injection (Refine's provider model).** One `<WorkbenchShell>` reads a `world` prop / route prefix and injects the right `<NavRail>` + `<MainArea>` — "same layout, different context," no separate router trees. Clean Work/Brain separation without duplication.

6. **SWR cache at the daemon→CLI boundary.** React-Admin batches reference lookups (no N+1). The SQLite index is fast (5000 notes: build 157 ms / search 13 ms) but the web daemon → `serve/api.mjs` boundary benefits from a TanStack Query (or lightweight) cache client-side. Keep `serve/api.mjs` the single data-provider path — never let components call `notes/store` directly (React-Admin's data-provider discipline).

### The other frameworks, briefly

- **shadcn-admin (satnaing)** — Vite + shadcn/ui + TanStack Router collection, MIT, R19 + TW v4 confirmed, lean, Notion-adjacent. **ADOPT as a pattern-mine** (read its Sidebar shell + cmdk wiring; copy into `kit.tsx`). Not a package. [repo](https://github.com/satnaing/shadcn-admin)
- **Refine (refinedev)** — fully headless core (~126 KB gz vs react-admin's ~316 KB), provider-injection layout, `useTable`/`useList`, R19 in v5 (Feb 2026). **LEARN-FROM** the provider model and the "different layout per route subtree" two-world pattern. AVOID as a dep (zuzuu isn't a CRUD app). [repo](https://github.com/refinedev/refine) · [vs react-admin](https://refine.dev/blog/react-admin-vs-refine/)
- **Mantine admin** — Spotlight + modals manager. **LEARN-FROM** the Spotlight API shape; implement via cmdk. AVOID as dep (TW v4 Preflight conflict).
- **Tabler** — Bootstrap, 41k stars. **AVOID / LEARN-FROM** the page inventory only. [repo](https://github.com/tabler/tabler)
- **Horizon UI** — glassmorphism, stale. **AVOID.** [repo](https://github.com/horizon-ui/horizon-tailwind-react)
- **Mosaic Lite (Cruip)** — TW v4 + Vite + Radix + Chart.js, but **GPL**. **AVOID** (license); LEARN-FROM the TW-v4/Vite/Radix setup. [repo](https://github.com/cruip/tailwind-dashboard-template)

---

## 7. The token / design-system approach

Adopt shadcn's Tailwind-v4 model: CSS custom properties in `:root` / `.dark`, referenced via `@theme inline`, OKLCH for perceptual uniformity. A single `web/src/client/tokens.css` imported by Tailwind's `@theme` block — no separate token pipeline at this scale.

- **Neutral palette:** one 9-step gray ramp (50–950) + one calm accent (slate-blue/violet, not bright). Semantic tokens: `--color-surface`, `--color-surface-raised`, `--color-border`, `--color-text`, `--color-text-muted`, `--color-accent`, `--color-accent-hover`. Borrow Geist's gray ramp as reference.
- **State color only:** green (approved/active), amber (pending / the review gate), red (rejected/error) — never decorative. This _is_ the Notion-calm brief.
- **Typography:** one stack (Geist or Inter), 5 sizes (xs/sm/base/lg/xl), regular body + medium labels.
- **Density:** Rhea for the dense Brain surfaces (grid, side-panel, filter chips, review queue); Luma's breathing room for Work-world session cards and stat callouts.
- **Shadows:** minimal — one `shadow-sm` for raised surfaces (side panel), nothing heavier.

---

## 8. Surface map — what to use where

Mapping to `05-experience-spec.md`'s two worlds.

| Surface (world) | Recommendation | Rationale |
|---|---|---|
| **Grid / table** — modules as tables, notes as rows (Brain) | **TanStack Table v8** + owned Tailwind cells; **React Aria `Table`** lazy-loaded if ARIA-grid keyboard nav is needed | Headless, no style conflict; React Aria is the only complete headless grid primitive |
| **Filter-chips / TagGroup** (Brain) | **React Aria `TagGroup`** (same lazy route) _or_ owned chips | Shares the lazy import; or trivial to own |
| **Envelope record side-panel / form** (Brain) | **shadcn-seeded** (Radix/Base UI Dialog/Sheet + ScrollArea) + react-hook-form; `RecordContext` (ShowBase analog) | Owned code, TW v4 native, full control |
| **ER graph** (Brain) | lazy-loaded graph lib (decide at build — see Open Q) | Heavy; must be route-split |
| **Audit trail** (Brain) | Pure kit (owned TSX + Tailwind) | Static list — no primitive overhead |
| **Command palette / note search** (root shell) | **cmdk** (shadcn `Command`), or **Base UI / Ariakit Combobox** for async/grouped | Mounted at root; Linear/Raycast pattern |
| **Nav rail / world switch** (shell) | **shadcn `Sidebar`** (collapsible icon-rail) | The dashboard-standard shell primitive |
| **Live agent session + review gate** (Work) | Owned kit + Base UI for complex interactive states | Bespoke approve/reject layout; primitives only for interactive bits |
| **Stat cards / dashboard tiles** | Pure kit (TSX + Tailwind + SVG); copy Tremor/Catalyst KPI _layouts_ | No chart dep on the tile itself |
| **Charts** | **Recharts** via shadcn chart blocks, **lazy dynamic import only** | ~45 KB — never in the base bundle |
| **Dropdowns / context menus / tooltips / dialogs / tabs** | **shadcn-seeded** (Radix) | Stable, light, trivial to style |

---

## 9. Open questions for the build phase

1. **React Aria `Table` vs owned TanStack-Table cells for the Brain grid.** Is the ~50 KB gz (lazy, one route) worth React Aria's ARIA-grid keyboard cell-navigation and multi-select, or does TanStack Table + owned cells + a focus-management hook cover the spec? Decide against the real grid interactions in `05`.
2. **Single primitive layer vs split.** Default to Base UI everywhere (better R19, active Combobox, cleaner TS), or keep Radix for the patterns it nailed + Base UI for gaps? The split adds two peer surfaces; the single-layer simplifies maintenance.
3. **Combobox owner: Base UI vs Ariakit.** If Base UI's Combobox API proves awkward for note search / filter chips in practice, Ariakit is the cleaner fallback — bench both on a real grouped-async search.
4. **ER graph library.** Not covered by any kit here — needs its own evaluation (React Flow / Cytoscape / D3) with the same MIT + lazy-load + bundle discipline. Out of scope for this pass; flag for a dedicated mini-survey.
5. **Client data cache.** TanStack Query at the daemon→`serve/api.mjs` boundary, or a hand-rolled SWR given the zero-dep ethos and the already-fast SQLite index? Weigh the ~13 KB dep against the cache-invalidation code you'd own.
6. **`shadcn eject` timing.** Eject to drop the package immediately (full ownership, matches the existing `kit.tsx` ethos), or keep the CLI installed for ongoing component generation during the build-out? Likely: generate during build, eject before ship.
7. **Reconciling `kit.tsx` with shadcn shapes.** The existing kit is owned and small — map each current component to its shadcn equivalent and decide keep-vs-replace per component, rather than a wholesale swap.
8. **If Tailwind Plus is purchased** (proprietary): Catalyst becomes the highest-quality TW-v4-native styled starting kit for the Work-world side-panel/nav — but it cannot ship in an OSS distribution. Decide per the open-source-vs-proprietary surface split in the tiered-architecture rethink.

---

## 10. Sources

**Headless primitives:** [shadcn TW v4](https://ui.shadcn.com/docs/tailwind-v4) · [shadcn Rhea](https://ui.shadcn.com/docs/changelog/2026-05-rhea) · [shadcn unified Radix](https://ui.shadcn.com/docs/changelog/2026-02-radix-ui) · [shadcn React 19](https://ui.shadcn.com/docs/react-19) · [shadcn Sidebar](https://ui.shadcn.com/docs/components/radix/sidebar) · [shadcn data table](https://ui.shadcn.com/docs/components/radix/data-table) · [shadcn blocks](https://ui.shadcn.com/blocks) · [Radix Primitives](https://www.radix-ui.com/primitives) · [Base UI](https://www.base-ui.com/) · [Base UI bundle #3688](https://github.com/mui/base-ui/issues/3688) · [React Aria](https://react-aria.adobe.com/) · [React Aria bundle #5636](https://github.com/adobe/react-spectrum/discussions/5636) · [Ariakit](https://ariakit.com/) · [Ariakit perf](https://newsletter.ariakit.com/p/performance-tailwind-v4-and-more) · [Headless UI](https://headlessui.com/) · [Ark UI](https://ark-ui.com/) · [PkgPulse shadcn/Base/Radix 2026](https://www.pkgpulse.com/guides/shadcn-ui-vs-base-ui-vs-radix-components-2026) · [GreatFrontend headless 2026](https://www.greatfrontend.com/blog/top-headless-ui-libraries-for-react-in-2026)

**Batteries libraries:** [MUI TW v4](https://mui.com/material-ui/integrations/tailwindcss/tailwindcss-v4/) · [MUI bundle #42958](https://github.com/mui/material-ui/issues/42958) · [Mantine](https://mantine.dev/) · [Mantine R19 #6316](https://github.com/orgs/mantinedev/discussions/6316) · [Mantine TW v4 #7459](https://github.com/orgs/mantinedev/discussions/7459) · [HeroUI](https://heroui.com/) · [HeroUI TW v4](https://beta.heroui.com/docs/guide/tailwind-v4) · [HeroUI vs shadcn](https://www.thesys.dev/blogs/heroui) · [AntD v6 migration](https://ant.design/docs/react/migration-v6/) · [AntD tree-shaking](https://ant.design/docs/blog/tree-shaking/) · [AntD CSS compat](https://ant.design/docs/react/compatible-style/) · [Chakra R19 #8519](https://github.com/chakra-ui/chakra-ui/issues/8519) · [PrimeReact TW](https://primereact.org/tailwind/) · [Park UI](https://park-ui.com/)

**Dashboard kits:** [Tremor](https://www.tremor.so/) · [Tremor KPI](https://blocks.tremor.so/blocks/kpi-cards) · [Vercel acquires Tremor](https://vercel.com/blog/vercel-acquires-tremor) · [Tremor R19 #1072](https://github.com/tremorlabs/tremor-npm/issues/1072) · [Catalyst](https://tailwindcss.com/plus/ui-kit) · [Tailwind Plus blocks](https://tailwindcss.com/plus/ui-blocks) · [Untitled UI React](https://www.untitledui.com/react) · [Saas-UI](https://saas-ui.dev/) · [Geist](https://vercel.com/geist/introduction)

**Frameworks & structure:** [React-Admin Architecture](https://marmelab.com/react-admin/Architecture.html) · [RA Feb 2026](https://marmelab.com/blog/2026/02/26/react-admin-february-2026-update.html) · [RA + custom UI](https://marmelab.com/blog/2023/11/28/using-react-admin-with-your-favorite-ui-library.html) · [shadcn-admin-kit](https://github.com/marmelab/shadcn-admin-kit) · [RA Datagrid](https://marmelab.com/react-admin/Datagrid.html) · [ra-core](https://marmelab.com/ra-core/) · [Refine](https://github.com/refinedev/refine) · [RA vs Refine](https://refine.dev/blog/react-admin-vs-refine/) · [shadcn-admin (satnaing)](https://github.com/satnaing/shadcn-admin) · [Tabler](https://github.com/tabler/tabler) · [Horizon UI](https://github.com/horizon-ui/horizon-tailwind-react) · [Mosaic Lite](https://github.com/cruip/tailwind-dashboard-template)

**Grid / charts:** [TanStack Table v9](https://tanstack.com/blog/tanstack-table-v9-taking-form) · [TanStack column pinning](https://tanstack.com/table/v8/docs/guide/column-pinning) · [cmdk](https://www.npmjs.com/package/cmdk) · [Best React chart libs 2026](https://chartts.com/blog/best-react-chart-libraries-2026)
