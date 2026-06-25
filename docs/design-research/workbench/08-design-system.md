# 08 — The Workbench Design System

*An elegant, minimal, token-driven design system from which the entire zuzuu workbench is composed — coupled to the data provider so components are data-aware, with close to zero inline styling. Almost a drag-and-drop builder, but code-first.*

> **Status:** grounding spec (research synthesis). Feeds the LEAN Vite + React 19 + TypeScript + Tailwind v4 SPA build.
> **Cross-references:** [`05-experience-spec`](./05-experience-spec.md) (Work/Brain worlds, the review gate), [`06-data-layer`](./06-data-layer.md) (DataProvider over the gated `zz` CLI, `Map<FieldType, FieldConfig>` registry, pending-proposal writes), [`07-ui-foundation`](./07-ui-foundation.md) (copy-owned shadcn/Radix + Base UI kit, headless-only deps, WorkbenchShell + ListContext pull-model), [`tokens-candidates.md`](../tokens-candidates.md) (Notion-calm visual language: warm-neutral ramp + 5 module hues, duotype, calm motion, color-only-for-state).

---

## Table of contents

1. [Executive summary](#1-executive-summary)
2. [The layered architecture](#2-the-layered-architecture)
3. [The recommended stack](#3-the-recommended-stack)
4. [Layer 0 — token architecture](#4-layer-0--token-architecture)
5. [Layer 1 — layout primitives](#5-layer-1--layout-primitives)
6. [Layer 2 — recipe components (the kit)](#6-layer-2--recipe-components-the-kit)
7. [Layer 3 — data-bound resource components](#7-layer-3--data-bound-resource-components)
8. [The primitive + component catalog](#8-the-primitive--component-catalog)
9. [Zero inline styling — how we enforce it](#9-zero-inline-styling--how-we-enforce-it)
10. [Design principles](#10-design-principles)
11. [Open questions for the build](#11-open-questions-for-the-build)

---

## 1. Executive summary

The workbench is a CRUD-to-app admin over a **Project-as-database** (modules = tables, notes = rows, frontmatter = columns, relations = graph). To build it lean and keep it elegant, we want a **design system that *is* the workbench's component library** — not a separate theming concern bolted on. The whole SPA should assemble from a small, layered, token-driven kit with **close to zero inline styling**, and the kit's data-bound components should be **wired to the DataProvider** so a view is declared, not hand-built.

The synthesis lands on **four layers fed from one token source**:

```
tokens  →  primitives  →  recipe components  →  data-bound resource components
```

- **Two token tiers + one bridge** (no component tokens). Raw OKLCH values (private) → semantic aliases (`:root` / `.dark`) → `@theme inline` bridge to Tailwind utilities. The Adobe Spectrum 18 MB lesson is decisive: component-level tokens only pay off at four-framework scale. zuzuu has one framework, one team — components wire straight to the semantic layer.
- **Five layout primitives** (Box / Stack / Inline / Grid / Text) own *all* spacing and arrangement; nothing else writes layout CSS. (Braid / Atlassian: components never declare outer whitespace.)
- **`tailwind-variants` slot recipes** own *all* visual variation. One `tv()` per multi-part component family; CVA only for single-element atoms. This is the single allowed styling surface.
- **The `FieldType → FieldConfig` registry is the load-bearing joint** between the design system and the data layer. One registry entry drives the grid cell, the side-panel form input, *and* schema graduation — add a field type, every surface updates atomically. (React-Admin's `RecordContext` + `source` pull model, implemented in ~200 lines over Radix + react-hook-form — pattern adopted, dependency not imported.)
- **Writes resolve to a pending proposal** (the review gate, per 06). Components call `mutate`/`propose` against context and never know whether it became a direct write or a queued proposal — the gate is invisible to the component.

The enforcement spine — the thing that makes "near-zero inline styling" *mechanical* rather than cultural — is the pairing of **Tailwind v4's `@theme { --*: initial }` reset** (no token ⇒ no utility class) with **TypeScript prop types that omit `className`** (no prop ⇒ no override vector). The `tv()` slot factory sits between them as the only styling surface; ESLint and a stylelint token guard are defense in depth.

**Headline:** *Layout primitives own all spacing, recipes own all visual variation, the registry owns all field rendering, and nothing else writes CSS.*

---

## 2. The layered architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│ LAYER 3 — DATA-BOUND RESOURCE COMPONENTS                                   │
│   Grid · RecordPanel · Field · ListContext · RecordContext · ERGraph      │
│   AuditLog · ProposalCard · ReviewGate                                     │
│   ── pull data from DataContext; render via the FieldType registry ──      │
│   ── writes resolve to a *pending proposal* (06 review gate) ──            │
└───────────────────────────────▲────────────────────────────────────────────┘
                                 │  consumes (composition only, no CSS)
┌───────────────────────────────┴────────────────────────────────────────────┐
│ LAYER 2 — RECIPE COMPONENTS  (the copy-owned shadcn/Radix + Base UI kit)    │
│   Button · Badge · Card · Dialog · Input · Select · Command(cmdk) ·         │
│   Tooltip · Separator · Skeleton · Tabs · Popover                          │
│   ── styled ONLY via tailwind-variants tv() slot recipes / cva atoms ──     │
└───────────────────────────────▲────────────────────────────────────────────┘
                                 │  composes
┌───────────────────────────────┴────────────────────────────────────────────┐
│ LAYER 1 — LAYOUT PRIMITIVES   (5 thin, token-typed wrappers)                │
│   Box · Stack · Inline · Grid · Text                                        │
│   ── own ALL spacing + arrangement; props map to token scales only ──       │
└───────────────────────────────▲────────────────────────────────────────────┘
                                 │  reads (utilities only, never raw var())
┌───────────────────────────────┴────────────────────────────────────────────┐
│ LAYER 0 — TOKENS                                                            │
│   primitives.css (private OKLCH) → semantic.css (:root/.dark aliases)       │
│        → @theme inline bridge → Tailwind utilities (bg-* text-* p-* …)      │
└──────────────────────────────────────────────────────────────────────────┘
                                 ▲
                                 │  the data-aware JOIN
        ┌────────────────────────┴───────────────────────────┐
        │  FieldType → FieldConfig REGISTRY (one Map)         │
        │  { Cell, Input, schema, colorToken } per field type │
        │  couples Layer 0 (colorToken) ⇄ Layer 3 (Cell/Input)│
        │  ⇄ DataProvider (schema graduation)                 │
        └─────────────────────────────────────────────────────┘
```

**Invariants (each layer has exactly one job):**

- **L0** generates utility classes. No component imports raw `var(--zz-sand-4)`; that is the same error as a hex literal.
- **L1** assembles spacing/arrangement classes. The *only* place flex/grid/gap/padding strings are written outside a recipe.
- **L2** assembles visual variation via `tv()`/`cva`. The *only* place color/border/radius/state strings are written.
- **L3** *composes* L1 + L2 and binds them to data. It writes **no** Tailwind classes directly — it arranges components and reads the registry.
- The **registry** is the one object that belongs to both the design system (it carries `colorToken`) and the data layer (it carries `schema` + `Cell`/`Input`). It is the join.

---

## 3. The recommended stack

| Concern | Choice | Why (and what we rejected) |
|---|---|---|
| Token engine | **Tailwind v4 `@theme` / `@theme inline`** | Tokens are *utility-generating*. `--color-module-knowledge` → `bg-module-knowledge` automatically. `@theme inline` forces static resolution when a token references another var (else font/var indirection silently breaks). |
| Token tiers | **Two tiers (primitive private → semantic public) + bridge** | Spectrum's 210k-token / 18 MB component-token blowup documents the failure mode; Fowler/W3C recommend starting at two and adding a third only on a forcing function. zuzuu has none. |
| Variant API | **`tailwind-variants` (tv) for multi-part; `cva` for atoms** | tv adds **slots** + compound slots + built-in `twMerge` conflict resolution — mandatory for Card/Dialog/DataGrid where parent+child styles must stay coherent and typed in one declaration. CVA lacks slots; using it forces manual class merging that leaks inline. |
| Component kit | **Copy-owned shadcn/ui CLI over Radix + Base UI** (per 07) | We own the source; only headless deps ride along. `data-slot` attributes give stable selectors; `forwardRef` dropped. No batteries library (MUI/Chakra) — double runtime + conflicting token systems. |
| Headless deps | **TanStack Table, cmdk** (per 07) | Grid behavior + command palette without styling opinions. |
| Data coupling | **DataProvider + `Map<FieldType, FieldConfig>`** (per 06) | The registry drives grid columns, form inputs, and schema graduation from one source. Writes → pending proposals (the gate). |
| Pull model | **`ListContext` / `RecordContext`** (React-Admin pattern, in-repo) | Fields read the record from context via a `source` path; parents never thread values down. ~200 lines, no `ra-*` import. |
| Theming | **`data-theme` / `data-density` on root + `:root`/`.dark` remap** | Components consume tokens, never branch on theme. Density is a token, not a prop threaded everywhere. |
| Rejected | **Panda CSS, Vanilla Extract, Stitches, Chakra style-props** | Panda fights Tailwind v4's `@theme` (parallel pipeline, no proportional gain — its own docs advise against it on shadcn). VE/`.css.ts` is a second language in a TS+Tailwind repo. Stitches is unmaintained. Chakra `gap={4}` scatters token consumption and kills static analysis. |

---

## 4. Layer 0 — token architecture

Two CSS files in human time; the `@theme inline` bridge is mechanical, not a third design layer.

### 4.1 Primitives — `tokens/primitives.css` (private, never used in components)

```css
:root {
  /* warm-neutral ramp (12 steps, OKLCH) — Notion-calm */
  --zz-sand-1:  oklch(0.99 0.005 80);
  --zz-sand-2:  oklch(0.97 0.007 80);
  --zz-sand-4:  oklch(0.93 0.010 80);
  /* … through --zz-sand-12 */

  /* 5 module identity hues (one per module kind) */
  --zz-hue-knowledge:    oklch(0.65 0.14 250);  /* cool blue */
  --zz-hue-memory:       oklch(0.65 0.14 160);  /* teal */
  --zz-hue-actions:      oklch(0.65 0.14 300);  /* violet */
  --zz-hue-instructions: oklch(0.65 0.14  40);  /* amber */
  --zz-hue-guardrails:   oklch(0.60 0.18  25);  /* coral/red */

  --zz-space-1: .25rem; --zz-space-2: .5rem; --zz-space-3: .75rem;
  --zz-space-4: 1rem;   --zz-space-6: 1.5rem; --zz-space-8: 2rem;
  --zz-radius-sm: 4px;  --zz-radius-md: 6px;  --zz-radius-lg: 10px;
  --zz-duration-fast: 120ms; --zz-duration-medium: 220ms;
  --zz-ease-out: cubic-bezier(.16, 1, .3, 1);
}
```

### 4.2 Semantic — `tokens/semantic.css` (public; the only tokens components reference)

```css
:root {
  --background: var(--zz-sand-1);  --surface: var(--zz-sand-2);
  --surface-raised: var(--zz-sand-3);
  --foreground: var(--zz-sand-12); --foreground-muted: var(--zz-sand-10);
  --border: var(--zz-sand-4);      --border-strong: var(--zz-sand-6);

  /* color ONLY carries state (per tokens-candidates.md) */
  --state-pending:  var(--zz-hue-instructions);     /* amber — proposal queued */
  --state-approved: oklch(0.62 0.14 145);           /* green — generation minted */
  --state-rejected: var(--zz-hue-guardrails);       /* red — guardrail deny */

  --focus-ring: var(--zz-hue-knowledge);
  --primary: var(--zz-sand-12); --primary-foreground: var(--zz-sand-1);
}
.dark {
  --background: var(--zz-sand-12); --surface: oklch(0.18 0.006 80);
  --foreground: var(--zz-sand-1);  --foreground-muted: var(--zz-sand-3);
  --border: var(--zz-sand-9);
}
```

### 4.3 Bridge — `tokens/theme.css` (mechanical; after this, no raw `var()` in JSX)

```css
@theme inline {
  --color-background: var(--background); --color-surface: var(--surface);
  --color-surface-raised: var(--surface-raised);
  --color-foreground: var(--foreground);
  --color-foreground-muted: var(--foreground-muted);
  --color-border: var(--border); --color-border-strong: var(--border-strong);
  --color-state-pending: var(--state-pending);
  --color-state-approved: var(--state-approved);
  --color-state-rejected: var(--state-rejected);

  /* module hues → bg-module-knowledge, text-module-memory, … */
  --color-module-knowledge:    var(--zz-hue-knowledge);
  --color-module-memory:       var(--zz-hue-memory);
  --color-module-actions:      var(--zz-hue-actions);
  --color-module-instructions: var(--zz-hue-instructions);
  --color-module-guardrails:   var(--zz-hue-guardrails);

  --spacing-1: var(--zz-space-1); /* …through 8 */
  --radius-sm: var(--zz-radius-sm); --radius-md: var(--zz-radius-md);
  --radius-lg: var(--zz-radius-lg);
  --duration-fast: var(--zz-duration-fast);
  --ease-out: var(--zz-ease-out);
}
```

**Dark/density discipline:** dark mode never touches `@theme` — it remaps the `:root` aliases (or raw vars) and the bridge cascades automatically, single-pass. Density (`compact`/`normal`/`relaxed`) is a `data-density` attribute remapping a spacing token, never a prop threaded through components.

**Dynamic class caveat:** `bg-${colorToken}` constructed at runtime defeats Tailwind's static scanner. Keep dynamic construction *only* inside the registry render functions, and add a `safelist` pattern for `bg-module-*`, `text-module-*`, `border-state-*` (or hold a static class map alongside the registry).

---

## 5. Layer 1 — layout primitives

Five thin wrappers. Narrow, token-typed props only — no Chakra-style escape props. They are (with L2 recipes) two of the only files where Tailwind class strings are assembled.

```tsx
// Box — the escape hatch: token-bound padding + background, polymorphic `as`
const padMap = { xs:'p-1', sm:'p-2', md:'p-3', lg:'p-4', xl:'p-6' } as const;
export function Box({ p, bg, as:Tag='div', className, children }: BoxProps) {
  return <Tag className={cn(p && padMap[p], bg && `bg-${bg}`, className)}>{children}</Tag>;
}

// Stack — vertical gap; Inline — horizontal gap + wrap
const gapMap = { xs:'gap-1', sm:'gap-2', md:'gap-3', lg:'gap-4', xl:'gap-6' } as const;
export function Stack({ gap='md', align='start', children }: StackProps) {
  return <div className={cn('flex flex-col', gapMap[gap], `items-${align}`)}>{children}</div>;
}

// Grid — named layouts for the Work/Brain shells (05)
const layouts = {
  'sidebar-main':'grid grid-cols-[220px_1fr]', 'two-col':'grid grid-cols-2',
  'three-col':'grid grid-cols-3',  // Work world: session | gate | inspector
} as const;

// Text — the typography primitive (duotype: sans default, mono for data)
const text = cva('', { variants: { variant: {
  heading:'text-xl font-semibold text-foreground tracking-tight',
  label:'text-xs font-medium text-foreground-muted uppercase tracking-wide',
  body:'text-sm text-foreground', caption:'text-xs text-foreground-muted',
  mono:'text-xs font-mono text-foreground-muted',
}}, defaultVariants:{ variant:'body' }});
```

**The discipline these enforce:** no component above L1 writes `className="flex gap-3 p-2 text-sm text-gray-500"`. Every arrangement is a Stack / Inline / Grid; every token consumption is a prop value.

---

## 6. Layer 2 — recipe components (the kit)

`tailwind-variants` slot recipe per multi-element family; `cva` for atoms. The recipe is the canonical style spec — there is no `className` escape and no `style` prop.

```tsx
// Card slot recipe — NoteCard, ModuleCard, ProposalCard derive from it
export const card = tv({
  slots: {
    root:'rounded-md border border-border bg-surface-raised overflow-hidden',
    header:'flex items-center gap-2 px-3 py-2 border-b border-border',
    body:'p-3', footer:'px-3 py-2 border-t border-border flex items-center gap-2',
  },
  variants: {
    module: {                                   // data-aware accent (5 hues)
      knowledge:{ root:'border-l-2 border-l-module-knowledge' },
      memory:{ root:'border-l-2 border-l-module-memory' },
      guardrails:{ root:'border-l-2 border-l-module-guardrails' },
    },
    intent: {                                   // color ONLY for state
      default:{}, pending:{ root:'border-state-pending/40 bg-state-pending/5' },
      approved:{ root:'border-state-approved/40 bg-state-approved/5' },
      rejected:{ root:'border-state-rejected/40 bg-state-rejected/5' },
    },
  },
  defaultVariants:{ intent:'default' },
});
// const { root, header, body } = card({ module: note.kind, intent: proposal && 'pending' });
```

Use `cva` (not tv) for single-element atoms — Button, Badge, StatusPip, Dot, Separator — where there is no second DOM element to coordinate.

---

## 7. Layer 3 — data-bound resource components

These never manage their own data. They pull from context and render through the registry; writes resolve to a pending proposal (06).

```tsx
// The pull model (React-Admin pattern, ~200 LOC over Radix + react-hook-form)
const RecordContext = createContext<{ record: Note|null; resource: string } | null>(null);
export const useRecordContext = () => useContext(RecordContext)!;        // fields pull
export function useListContext(resource: string) { /* DataProvider.getList → react-query */ }

// The registry — one Map, three consumers (grid cell · form input · schema graduation)
export const fieldRegistry = new Map<FieldType, FieldConfig>([
  ['text',     { Cell:TextCell,     Input:TextInput,     colorToken:'foreground',       schema:{ type:'string' } }],
  ['status',   { Cell:StatusBadge,  Input:StatusSelect,  colorToken:'state-pending',    schema:{ type:'string' } }],
  ['relation', { Cell:RelationChip, Input:RelationPicker,colorToken:'module-knowledge', schema:{ type:'string', format:'relation' } }],
  ['module',   { Cell:ModuleBadge,  Input:ModuleSelect,  colorToken:'module-knowledge', schema:{ type:'string' } }],
  // add a field type ⇒ add one entry ⇒ every surface updates
]);

// Grid — columns generated from schema, no hand-written ColumnDef
function buildColumns(schema: FieldMeta[]): ColumnDef<Note>[] {
  return schema.map(({ key, type, label }) => {
    const { Cell } = fieldRegistry.get(type)!;
    return { accessorKey:key, header:label,
      cell:({ row }) => (
        <RecordContext.Provider value={{ record: row.original, resource }}>
          <Cell value={row.getValue(key)} record={row.original} />
        </RecordContext.Provider>) };
  });
}
export function Grid({ resource }: { resource: string }) {
  const { data } = useListContext(resource);
  const schema  = useResourceSchema(resource);    // from the module.md manifest
  return <DataTable data={data} columns={buildColumns(schema)} />;  // TanStack Table
}

// RecordPanel — the envelope side-panel: same registry, Input side
export function RecordPanel({ resource }: { resource: string }) {
  const schema = useResourceSchema(resource);
  return <Stack gap="md">{schema.map(({ key, type, label }) => {
    const { Input } = fieldRegistry.get(type)!;
    return <Input key={key} source={key} label={label} />;   // writes → propose()
  })}</Stack>;
}
```

**A whole Brain view is a declaration** — the "builder feel" without the drag-drop:

```tsx
<ListContext resource="knowledge"><Grid resource="knowledge" /></ListContext>
```

**Write path:** `RecordPanel` inputs call `mutate`/`propose` on the DataContext. Per 06 the DataProvider resolves writes to a *pending proposal* (the review gate, the moat). The component is agnostic — it surfaces a pending-intent badge (`intent="pending"` on the Card) and never knows whether a write was direct or queued.

---

## 8. The primitive + component catalog

The minimal set a lean workbench needs. Anything not here is composed from these, not added.

### Layer 1 — primitives (5)
`Box` · `Stack` · `Inline` · `Grid` · `Text`

### Layer 2 — recipe components (~12)

| Component | Slots / variants | Notes |
|---|---|---|
| `Button` | `root`,`icon` · intent(default/primary/ghost/danger), size | cva |
| `Badge` | `root` · intent (5 module hues + 3 state) | cva; `data-module` selector for hues |
| `Card` | `root`,`header`,`body`,`footer` · module, intent | tv slots |
| `Dialog` | `overlay`,`content`,`header`,`footer` · size | Radix Dialog |
| `Input` | `root`,`label`,`hint`,`error` · state | react-hook-form |
| `Select` | `trigger`,`content`,`item` | Radix/Base UI |
| `Command` | `root`,`input`,`list`,`item`,`group` | cmdk |
| `Tabs` | `list`,`trigger`,`content` | Work/Brain world switch |
| `Popover` | `trigger`,`content` | relation pickers |
| `Tooltip` | `trigger`,`content` | |
| `Separator` | `root` · orientation | cva |
| `Skeleton` | `root` · shape(line/block/circle) | calm loading |

### Layer 3 — data-bound resource components (the builder kit)

| Component | Binds to | Drives |
|---|---|---|
| `ListContext` / `RecordContext` | DataProvider pull model | context for children |
| `Grid` | `getList(resource)` + schema | TanStack Table; registry `Cell` per column |
| `RecordPanel` | `getOne` + schema | envelope side-panel; registry `Input` per field |
| `Field` | `RecordContext` + `source` | single registry-driven cell (escape hatch) |
| `ProposalCard` | proposal queue | the review gate item (intent=pending) |
| `ReviewGate` | `review` verb | approve/reject decision surface (05) |
| `ERGraph` | relation graph | nodes derive accent from registry `colorToken` |
| `AuditLog` | the append-only log | mutation + run journal view |
| `WorkbenchShell` | routing/layout | Work + Brain worlds; sets `data-theme`/`data-density` |

---

## 9. Zero inline styling — how we enforce it

Mechanical, defense-in-depth — not cultural. Ship the first two; the rest reinforce.

**① The closed-token reset (CSS layer can't generate arbitrary utilities).**
```css
@theme { --*: initial; /* then declare ONLY zuzuu tokens */ }
```
After this, `bg-blue-500` literally stops compiling. The token *is* the constraint.

**② Closed prop types (TS layer can't accept arbitrary classes).** Resource + recipe components omit `className` from their prop type entirely. No prop ⇒ no override vector. A legitimate one-off becomes a *named variant* (e.g. `elevation:'overlay'`), added in one PR — auditable.
```ts
type GridCellProps = { value: unknown; fieldType: FieldType; density?: Density };  // no className
```

**③ The single styling surface.** `tv()`/`cva` recipes (L2) + the five primitives (L1) are the *only* files that assemble Tailwind class strings. L3 and surfaces compose components — zero class strings.

**④ ESLint guardrails.**
```js
// ban the style= attribute (allow only on motion primitives via allowedFor)
'react/forbid-component-props': ['error', { forbid: ['style'] }],
// ban arbitrary Tailwind values — no pl-[17px], no bg-[#abc] (v4 has no JS-config plugin)
'no-restricted-syntax': ['error', {
  selector: "Literal[value=/\\[(?!var\\(--)[^\\]]+\\]/]",
  message: 'Arbitrary Tailwind values are forbidden. Use a @theme token or a tv() slot variant.',
}],
```

**⑤ Stylelint token guard (force through the semantic layer).** A `no-base-design-tokens`-style rule flags any `var(--zz-sand-*` / `var(--zz-hue-*` / `var(--zz-space-*` in component CSS — primitives are consumed only by `semantic.css`. (Firefox / Atlassian precedent.)

**⑥ The sprawl test (before adding anything).** New variant? Can it be a `data-*` attribute consumed by an existing token? New token? Can it derive from an existing semantic token via `calc()` / OKLCH lightness shift? The system stays minimal when tokens *compose* rather than proliferate.

---

## 10. Design principles

1. **Two token tiers, never three.** Primitive (private OKLCH) → semantic (public `:root`/`.dark`) → `@theme inline` bridge. Component tokens are a scaling tax that only pays off at four-framework scale (Spectrum). The unit of composition is a semantic utility class.
2. **Primitives own all spacing; recipes own all visual variation; nothing else writes CSS.** Five layout primitives and the `tv()`/`cva` recipes are the only files that assemble class strings.
3. **The FieldType registry is the single source of truth for how a frontmatter key looks and behaves everywhere** — grid cell, side-panel input, schema graduation, ER node. Add a type, every surface updates atomically.
4. **Components pull data; they are never handed it.** Fields read the record from `RecordContext` via a `source` path. Layout introspects `source`/`label`; values flow up into context, never down as props.
5. **Every write is a proposal.** The DataProvider resolves mutations to a pending proposal (the gate, per 06). Components are gate-agnostic — they request a change and surface pending state; the human decides.
6. **Color carries state, never decoration.** Warm-neutral ramp for everything; the 5 module hues for identity accents; pending/approved/rejected the only state colors. Notion-calm (per tokens-candidates.md).
7. **Module hue is a `data-module` attribute, not five class variants.** One CSS rule per slot resolves all five hues — no variant proliferation.
8. **Theme and density are tokens, not props.** Set `data-theme`/`data-density` on the shell root; components consume tokens and never branch.
9. **No `className`, no `style`, no arbitrary values.** Enforced by closed prop types + the `@theme` reset + lint. The escape hatch is a named variant, added deliberately and audited.
10. **Compose, don't reinvent.** Copy-owned shadcn/Radix + Base UI; headless-only deps (TanStack Table, cmdk); React-Admin/Refine/Puck/Builder *patterns* adopted in-repo, their runtimes never imported.

---

## 11. Open questions for the build

1. **Module hue: `data-module` attribute selectors vs. tv variant maps?** Principle 7 prefers the attribute (one rule, five hues). But `border-l-module-knowledge` as a tv variant is more discoverable and type-checked. Decide one convention and hold it — mixing both reintroduces the sprawl we're avoiding.
2. **Safelist vs. static class map for dynamic `colorToken`?** The registry's `bg-${colorToken}` defeats the static scanner. Safelist patterns are terse but coarse; a static map is exhaustive but verbose. Likely: static map for the closed module/state set, safelist only if user-defined hues become a feature.
3. **Density: ship `compact/normal/relaxed` now, or defer until felt?** Primer only added density tokens under real pressure. The grid (Brain world) is the likely forcing function — but premature density tokens thread complexity everywhere. Recommend deferring until the grid proves it.
4. **`RecordContext.Provider` per cell — performance at scale?** Wrapping every TanStack cell in a provider is clean but allocates per row. For large note-tables, consider a single row-level provider or reading `row.original` directly in the column factory.
5. **Where does the schema live, and how does graduation write `colorToken`?** The registry maps `FieldType → renderers + schema`; the resource's *field list* lives in the `module.md` manifest. Confirm graduation (06) writes back only the `schema` half and never couples the manifest to a UI color token.
6. **`Field` escape-hatch `source` path semantics.** Lodash dot-notation (`author.name`) implies nested frontmatter. zuzuu notes are mostly flat — confirm whether nested sources are needed before importing path-resolution complexity.
7. **Base UI vs. Radix per component.** 07 allows both. Pick per-component on a documented basis (e.g. Base UI where its API is cleaner) so the kit doesn't accumulate two idioms for the same primitive.
8. **Proposal/pending visual language.** Principle 6 reserves amber for pending — but a grid row mid-proposal, a side-panel field with a queued edit, and a ProposalCard are three different surfaces. Define the *one* pending treatment (border + tint + optional italic) and apply it uniformly via the `intent` variant.
9. **Motion budget.** Calm motion is locked (tokens-candidates.md) but unspecified per-component. Define the 2–3 allowed transitions (panel slide, fade-in, state-color crossfade) as tokens so motion can't proliferate either.
