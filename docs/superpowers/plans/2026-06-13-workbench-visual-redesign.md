# Workbench Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-lay the workbench's token foundation (sans-by-default, warm neutral ramp, demoted module hues, motion vocabulary, extended primitive kit) and then redesign every human-facing surface to the design brief, turning the "VS Code terminal" feel into a calm, premium, Notion-calm × Duolingo-progression product.

**Architecture:** Two layers built in order. **Layer 1 (foundation)** = `web/packages/web/src/index.css` tokens + `src/components/ui/` + `src/panel/kit/` primitives — built directly, the taste lock. **Layer 2 (surfaces)** = each surface restyled to compose Layer-1 primitives, verified by running the workbench against this repo's own `.zuzuu/` data and screenshotting with the Chrome DevTools MCP. No new product features; no daemon API changes; existing vitest + typecheck stay green throughout.

**Tech Stack:** React 19, Tailwind v4 (`@theme` in `index.css`), TypeScript (strict), Vite, vitest, Lucide-style inline stroke icons, xterm.js (terminal, keeps mono), cmdk (palette). Spec: `docs/superpowers/specs/2026-06-13-workbench-visual-redesign-design.md`. Brief: `docs/design-research/00-design-directions.md` + `tokens-candidates.md` + per-surface `NN-*.md`.

---

## Shared conventions (every task assumes these)

**Working dir:** `/Users/hkc/Documents/zuzuu`, branch `redesign/workbench`. Web code under `web/packages/web/src/`.

**Run the workbench for visual verification** (two background processes; daemon serves THIS repo so surfaces have real data):
```bash
cd /Users/hkc/Documents/zuzuu/web
npm run build -w @zuzuu-web/protocol            # once, before first dev run
# daemon (dev token = "dev"), serving the zuzuu repo itself:
npm run dev -w packages/daemon -- --dev --token dev /Users/hkc/Documents/zuzuu &
npm run dev -w @zuzuu-web/web &                 # Vite on :5173, proxies to daemon
# open: http://localhost:5173/auth?token=dev
```
Fallback (built app, prints its own tokened URL): `npm run -w zuzuu-web start -- /Users/hkc/Documents/zuzuu`.

**Screenshot a surface** (Chrome DevTools MCP): `new_page`/`navigate_page` to the surface URL, `take_screenshot`. Per-surface **resting-state checklist** (every surface must pass):
1. ~90% neutral pixels at rest — no decorative color.
2. Monospace appears ONLY on machine data (ids, paths, durations, code, logs, the terminal). Zero mono in nav/labels/buttons/headings/prose.
3. Status/identity color appears only on state or as a small identity marker (icon chip / badge / type tag) — never as a card background or large fill.
4. Calm density (tall rows, real air) on human-facing surfaces; compact dev density only inside genuine data tables (trace tree, sessions table).

**Keep green after every task:**
```bash
cd /Users/hkc/Documents/zuzuu/web
npm run test -w @zuzuu-web/web        # web vitest (logic tests)
npm run typecheck -w @zuzuu-web/web   # tsc --noEmit
```
Both must pass before a task is complete. The daemon package tests (`npm run test -w zuzuu-web`) are not touched by this work but must remain green if a shared type changes.

**Primitive-composition rule (non-negotiable for surface tasks):** surface tasks COMPOSE Layer-1 primitives and tokens. They must not introduce raw hex colors, new font-family declarations, `font-mono` on chrome, or bespoke shadow values. If a surface needs something no primitive provides, add the primitive to Layer 1 first (extend Task 4), then use it.

**Commit cadence:** one commit per task (or per logical step within a large task), present-tense `feat(web): …` / `refactor(web): …` messages.

---

## Phase 0 — Baseline

### Task 0: Capture the "before"

**Files:** none (read-only).

- [ ] **Step 1: Bring the workbench up** using the run commands above (both processes in background). Confirm `http://localhost:5173/auth?token=dev` loads the app against the zuzuu repo.

- [ ] **Step 2: Screenshot the current state** of each major surface (sidebar, session pane, module grid, a module detail, generations, review, sessions, command palette, onboarding/empty). Save to `docs/design-research/shots/before-<surface>.png`.

Run: Chrome DevTools MCP `take_screenshot` per surface.
Expected: a `before-*.png` set exists — the comparison baseline for the end review.

- [ ] **Step 3: Confirm the green baseline.**
Run: `cd web && npm run test -w @zuzuu-web/web && npm run typecheck -w @zuzuu-web/web`
Expected: all tests pass, typecheck clean. Record the test count.

- [ ] **Step 4: Commit** the baseline shots.
```bash
git add docs/design-research/shots
git commit -m "chore(web): capture pre-redesign baseline screenshots"
```

---

## Phase 1 — Foundation (built directly; the taste lock)

### Task 1: Neutral ramp + sans-by-default + light tokens

**Files:**
- Modify: `web/packages/web/src/index.css:7-110` (the `@theme` block, `body`, helpers)

- [ ] **Step 1: Retune the dark ink ramp to warm charcoal.** Replace the `--color-ink-*` values (keep the *names* — components reference them) with the brief's warm 5-step intent. In `@theme`:
```css
--color-ink-950: #0E0F12; /* app field — deepest */
--color-ink-900: #15171B; /* page panels, conversation canvas */
--color-ink-850: #1B1E23; /* cards, tiles, proposal cards */
--color-ink-800: #22262C; /* hover/active row fill (soft) */
--color-ink-700: #2A2E35; /* hairline border (one step off card) */
--color-ink-600: #3A3E45; /* strong border */
--color-ink-500: #6B6862; /* faint text (timestamps, disabled) */
--color-ink-300: #9A9690; /* muted text (labels, descriptions) */
--color-ink-100: #E8E6E3; /* primary text/headings (warm) */
```
Keep the semantic aliases (`--color-app`/`surface`/`elevated`/`hover`/`border`/`border-strong`/`muted`/`subtle`) pointing at these names (no change to the alias lines).

- [ ] **Step 2: Flip the default font to sans.** Change `body`'s `@apply` from `font-mono` to `font-sans`:
```css
body {
  @apply bg-app text-ink-100 font-sans antialiased;
  font-size: var(--text-body);
}
```
Add a machine-data opt-in helper (used by data spans that are NOT already inside xterm/shiki):
```css
/* Machine data only: ids, paths, durations, span ops, log lines, literal patterns. */
.wc-mono { font-family: var(--font-mono); font-feature-settings: normal; }
```

- [ ] **Step 3: Add the warm light-mode token set** (additive; dark stays default). After the `@theme` block, add a `data-theme="light"` override that remaps the same alias tokens to a warm off-white ramp:
```css
:root[data-theme="light"] {
  --color-ink-950: #FBFBFA; /* canvas */
  --color-ink-900: #FFFFFF; /* cards float */
  --color-ink-850: #FFFFFF;
  --color-ink-800: #F2F1EF; /* hover */
  --color-ink-700: #E6E4E1; /* hairline */
  --color-ink-600: #D2CFC9;
  --color-ink-500: #8C887F; /* faint */
  --color-ink-300: #5C584F; /* muted */
  --color-ink-100: #2E2C28; /* primary, warm near-black */
}
```
(No theme-toggle UI ships in this plan — tokens only, so the system is ready.)

- [ ] **Step 4: Remove drop-shadows on dark; soften for light.** Change the two elevation tokens so dark relies on lightness + hairline (set shadows to `none` by default) and light gets a soft diffuse shadow:
```css
--shadow-menu: 0 0 0 1px var(--color-ink-700);
--shadow-dialog: 0 0 0 1px var(--color-ink-700);
```
```css
:root[data-theme="light"] {
  --shadow-menu: 0 4px 16px -6px rgb(0 0 0 / 0.08), 0 1px 3px rgb(0 0 0 / 0.06);
  --shadow-dialog: 0 16px 48px -12px rgb(0 0 0 / 0.12), 0 4px 12px rgb(0 0 0 / 0.08);
}
```

- [ ] **Step 5: Verify build + contrast.** Run dev server; screenshot the app shell. Confirm: surfaces are warm-dark (not cool blue-grey), body text reads as sans, text holds AA contrast (`#E8E6E3` on `#0E0F12` and `#9A9690` on `#15171B` both pass AA). Note: many surfaces will look "wrong" (mono leaking) until later tasks — that is expected; only check ramp + default font here.
Run: `cd web && npm run typecheck -w @zuzuu-web/web`
Expected: clean.

- [ ] **Step 6: Commit.**
```bash
git add web/packages/web/src/index.css
git commit -m "feat(web): warm neutral ramp + sans-by-default + light tokens, shadow-free dark elevation"
```

### Task 2: Module hues retune + full semantic status set + accent rationing

**Files:**
- Modify: `web/packages/web/src/index.css` (`@theme`, the module-hue + status blocks)

- [ ] **Step 1: Retune the five module hues to a shared L/C** so none shouts, and add `*-subtle` tag-background variants:
```css
--color-module-knowledge: oklch(0.70 0.13 250);
--color-module-memory: oklch(0.70 0.13 300);
--color-module-actions: oklch(0.70 0.13 150);
--color-module-instructions: oklch(0.70 0.13 80);
--color-module-guardrails: oklch(0.70 0.13 20);
--color-module-knowledge-subtle: oklch(0.93 0.03 250);
--color-module-memory-subtle: oklch(0.93 0.03 300);
--color-module-actions-subtle: oklch(0.93 0.03 150);
--color-module-instructions-subtle: oklch(0.93 0.03 80);
--color-module-guardrails-subtle: oklch(0.93 0.03 20);
```

- [ ] **Step 2: Complete the semantic-status set** (today only `success`/`pending`). Add `warn`/`error`/`info`/`running` + a faint error row-tint:
```css
--color-success: oklch(0.72 0.13 150);
--color-warn: oklch(0.78 0.13 80);
--color-error: oklch(0.66 0.16 25);
--color-info: oklch(0.70 0.10 250);
--color-running: oklch(0.68 0.15 300);
--color-error-subtle: oklch(0.30 0.06 25); /* faint full-row failed tint (dark) */
```
Keep the existing `--color-success`/`--color-pending`/`--color-status-*` aliases working (map `--color-status-pending` to `--color-warn` if it isn't already, leave `--color-pending` as an alias of `--color-warn`).

- [ ] **Step 3: Ration the brand accent.** Leave `--color-accent`/`--color-accent-dim` defined, but note in a comment that accent = primary action + active nav ONLY. (Actual removal of decorative accent usage happens in the surface tasks and the final sweep, Task 17.) Update the `.prose` link/code vars so prose code no longer borrows the cyan accent — point `--tw-prose-invert-code` at `var(--color-ink-100)` and `--tw-prose-invert-links` at `var(--color-info)`.

- [ ] **Step 4: Verify.** Screenshot the module grid; confirm the five hues read as balanced identity markers (no single one dominating).
Run: `cd web && npm run typecheck -w @zuzuu-web/web`
Expected: clean.

- [ ] **Step 5: Commit.**
```bash
git add web/packages/web/src/index.css
git commit -m "feat(web): balance module hues + complete semantic status set + ration accent in prose"
```

### Task 3: Motion vocabulary

**Files:**
- Modify: `web/packages/web/src/index.css:142-216` (motion block)

- [ ] **Step 1: Add the named transitions from the brief**, keeping the existing keyframes as the implementations and adding aliases + the two new ones (`graduate-celebrate`, `panel-enter`). Append to the motion block:
```css
/* receipt opens to reveal diff/output */
@keyframes wc-receipt-expand { from { opacity: 0; transform: translateY(-2px); } to { opacity: 1; transform: none; } }
.wc-receipt-expand { animation: wc-receipt-expand 180ms ease-out both; }

/* the ONLY expressive motion — inline, non-blocking, rare by design */
@keyframes wc-graduate { 0% { transform: scale(0.96); opacity: 0; } 40% { transform: scale(1.02); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
.wc-graduate { animation: wc-graduate 700ms cubic-bezier(0.2,0.7,0.3,1) both; }

/* detail/inspector rail slides in on selection */
@keyframes wc-panel-enter { from { opacity: 0; transform: translateX(12px); } to { opacity: 1; transform: none; } }
.wc-panel-enter { animation: wc-panel-enter 240ms cubic-bezier(0.2,0.7,0.3,1) both; }

/* quiet toast */
@keyframes wc-toast-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
.wc-toast-in { animation: wc-toast-in 200ms ease-out both; }
```
Keep `wc-slide-in`/`wc-rise-in`/`wc-pop-in`/`wc-pulse-once`/`wc-approve-out`. Add the four new classes to the `prefers-reduced-motion` reset list.

- [ ] **Step 2: Verify** the reduced-motion block lists every animated class.
Run: `cd web && npm run typecheck -w @zuzuu-web/web`
Expected: clean.

- [ ] **Step 3: Commit.**
```bash
git add web/packages/web/src/index.css
git commit -m "feat(web): named motion vocabulary — receipt-expand, graduate, panel-enter, toast"
```

### Task 4: Primitive kit additions

**Files:**
- Modify: `web/packages/web/src/components/ui/primitives.tsx` (add `Receipt`, `PropertyRow`, `StatusPill`, `Count`, `ProgressBar`, `HeroNumber`, `Toast`, `CoachMark`, extend `Button` with a `secondary` variant)
- Modify: `web/packages/web/src/components/ui/index.ts` (export the new primitives)
- Create: `web/packages/web/src/panel/kit/progression.ts` (pure logic) + `web/packages/web/src/panel/kit/progression.test.ts`
- Note: `Rail` = compose the existing `Overlay`/panel container (no new component); `EmptyState` already exists as `panel/kit/TeachingEmpty.tsx` — reuse it, do not duplicate; the module-identity **badge** is the existing `moduleHue()` icon chip — do not add a new primitive; the **generation level ladder** is composed in Task 10 from `ProgressBar` + `StatusPill` + `progression.ts` — there is no standalone `Level` component.

- [ ] **Step 1: Write the failing test for progression logic.** Create `progression.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { genLadderLabel, nextGenRemaining } from "./progression";

describe("progression", () => {
  it("labels the path to the next generation with the concrete requirement", () => {
    expect(genLadderLabel(3, "approved proposals", 4)).toBe("3 more approved proposals → Gen 4");
  });
  it("uses singular when one remains", () => {
    expect(genLadderLabel(1, "approved proposals", 4)).toBe("1 more approved proposal → Gen 4");
  });
  it("celebrates readiness when nothing remains", () => {
    expect(genLadderLabel(0, "approved proposals", 4)).toBe("Ready to mint Gen 4");
  });
  it("computes remaining from a threshold, clamped at zero", () => {
    expect(nextGenRemaining(2, 5)).toBe(3);
    expect(nextGenRemaining(7, 5)).toBe(0);
  });
});
```

- [ ] **Step 2: Run it; verify it fails.**
Run: `cd web && npm run test -w @zuzuu-web/web -- progression`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `progression.ts`:**
```ts
// Pure progression-framing helpers (React-free, unit-tested). Versioning is
// rendered as levels, never a git log: this turns counts into "N more → Gen X".
export function nextGenRemaining(approved: number, threshold: number): number {
  return Math.max(0, threshold - approved);
}

export function genLadderLabel(remaining: number, unit: string, nextGen: number): string {
  if (remaining <= 0) return `Ready to mint Gen ${nextGen}`;
  const noun = remaining === 1 && unit.endsWith("s") ? unit.slice(0, -1) : unit;
  return `${remaining} more ${noun} → Gen ${nextGen}`;
}
```

- [ ] **Step 4: Run the test; verify it passes.**
Run: `cd web && npm run test -w @zuzuu-web/web -- progression`
Expected: PASS (4 tests).

- [ ] **Step 5: Add the presentational primitives** to `primitives.tsx`. Each composes tokens, sans by default, no raw hex:
```tsx
// ── Receipt — a one-line tool/event record, expandable to detail ───────
export function Receipt({
  icon, label, meta, tone = "default", children,
}: {
  icon: string; label: ReactNode; meta?: ReactNode;
  tone?: "default" | "ok" | "warn" | "bad";
  children?: ReactNode; // expanded detail (diff/output); presence shows a chevron
}) {
  const [open, setOpen] = useState(false);
  const dot = tone === "ok" ? "text-success" : tone === "warn" ? "text-warn" : tone === "bad" ? "text-error" : "text-ink-400";
  return (
    <div className="rounded-[var(--radius-ui)] hover:bg-hover">
      <button
        onClick={() => children && setOpen((v) => !v)}
        className="wc-focus flex w-full items-center gap-2 px-2 py-1.5 text-left"
      >
        <svg viewBox="0 0 16 16" className={cx("h-3.5 w-3.5 shrink-0", dot)} fill="none" stroke="currentColor" strokeWidth="1.4">
          <path d={icon} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="min-w-0 flex-1 truncate text-ui text-ink-100">{label}</span>
        {meta && <span className="wc-mono shrink-0 text-meta text-ink-500">{meta}</span>}
        {children && (
          <svg viewBox="0 0 16 16" className={cx("h-3 w-3 shrink-0 text-ink-500 transition-transform", open && "rotate-90")} fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M6 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      {open && children && <div className="wc-receipt-expand px-3 pb-2 pl-9">{children}</div>}
    </div>
  );
}

// ── PropertyRow — label · value, for the detail rail ───────────────────
export function PropertyRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="shrink-0 text-meta text-ink-500">{label}</span>
      <span className="min-w-0 truncate text-right text-ui text-ink-200">{children}</span>
    </div>
  );
}

// ── StatusPill / Count ─────────────────────────────────────────────────
const PILL_TONE: Record<string, string> = {
  ok: "text-success bg-[color-mix(in_oklab,var(--color-success)_14%,transparent)]",
  warn: "text-warn bg-[color-mix(in_oklab,var(--color-warn)_14%,transparent)]",
  bad: "text-error bg-[color-mix(in_oklab,var(--color-error)_14%,transparent)]",
  info: "text-info bg-[color-mix(in_oklab,var(--color-info)_14%,transparent)]",
  neutral: "text-ink-300 bg-hover",
};
export function StatusPill({ tone = "neutral", children }: { tone?: keyof typeof PILL_TONE; children: ReactNode }) {
  return <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-meta font-medium", PILL_TONE[tone])}>{children}</span>;
}
export function Count({ children }: { children: ReactNode }) {
  return <span className="inline-flex min-w-4 items-center justify-center rounded-full bg-hover px-1.5 text-meta text-ink-300">{children}</span>;
}

// ── HeroNumber — the one-large-numeral-per-card treatment ──────────────
export function HeroNumber({ value, unit }: { value: ReactNode; unit?: string }) {
  return (
    <div className="flex items-baseline gap-1">
      <span className="text-[2rem] font-semibold leading-none tracking-tight text-ink-100 tabular-nums">{value}</span>
      {unit && <span className="text-meta text-ink-500">{unit}</span>}
    </div>
  );
}

// ── ProgressBar / Level ────────────────────────────────────────────────
export function ProgressBar({ value, tone = "neutral" }: { value: number; tone?: "neutral" | "ok" | "warn" | "bad" }) {
  const fill = tone === "ok" ? "bg-success" : tone === "warn" ? "bg-warn" : tone === "bad" ? "bg-error" : "bg-ink-500";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-hover">
      <div className={cx("h-full rounded-full transition-[width] duration-500", fill)} style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }} />
    </div>
  );
}

// ── Toast — quiet auto-dismissing confirmation ─────────────────────────
export function Toast({ children }: { children: ReactNode }) {
  return (
    <div className="wc-toast-in fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-[var(--radius-ui)] border border-border bg-elevated px-3 py-2 text-ui text-ink-100 shadow-[var(--shadow-menu)]">
      {children}
    </div>
  );
}
```
Add `useState` to the React import at the top of the file.

- [ ] **Step 6: Extend `Button` with a softened `secondary` variant** (the 3-way approve/secondary/reject uses `primary` + `secondary` + `danger`, where `danger` is already de-emphasized text, never a red slab — verify it stays text-only). Add to `BTN_VARIANT`:
```tsx
secondary: "border border-border text-ink-200 hover:bg-hover hover:text-ink-100",
```
and widen the `ButtonVariant` type to include `"secondary"`.

- [ ] **Step 7: Export the new primitives** from `components/ui/index.ts` (add `Receipt`, `PropertyRow`, `StatusPill`, `Count`, `HeroNumber`, `ProgressBar`, `Toast`).

- [ ] **Step 8: Add a `CoachMark` primitive** (anchored, dismissible, "N of M") to `primitives.tsx`:
```tsx
export function CoachMark({ step, total, children, onDismiss }: { step: number; total: number; children: ReactNode; onDismiss: () => void }) {
  return (
    <div className="wc-pop-in max-w-xs rounded-[var(--radius-ui)] border border-border bg-elevated p-3 shadow-[var(--shadow-menu)]">
      <div className="text-ui text-ink-100">{children}</div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-meta text-ink-500">{step} of {total}</span>
        <Button size="sm" variant="ghost" onClick={onDismiss}>Got it</Button>
      </div>
    </div>
  );
}
```
Export it.

- [ ] **Step 9: Run tests + typecheck.**
Run: `cd web && npm run test -w @zuzuu-web/web && npm run typecheck -w @zuzuu-web/web`
Expected: all green (progression: 4 new tests).

- [ ] **Step 10: Commit.**
```bash
git add web/packages/web/src/components/ui web/packages/web/src/panel/kit/progression.ts web/packages/web/src/panel/kit/progression.test.ts
git commit -m "feat(web): primitive kit — Receipt, PropertyRow, StatusPill, Count, HeroNumber, ProgressBar, Toast, CoachMark, Level logic"
```

---

## Phase 2 — Surfaces (each composes Layer 1; one subagent per task)

> Each surface task: restyle the named files to the brief's current→target row, COMPOSE Layer-1 primitives/tokens, keep that surface's vitest green, pass the resting-state checklist via a Chrome-DevTools screenshot saved to `docs/design-research/shots/after-<surface>.png`, then commit. The brief target + cited references are the design source — read the lane file named in each task.

### Task 5: App shell + sidebar + footer

**Files:**
- Modify: `web/packages/web/src/app/Layout.tsx`, `app/Sidebar.tsx`, `app/Footer.tsx`
- Read for design: `docs/design-research/01-file-tree-workspace-nav.md`

- [ ] **Step 1: Sidebar two-tier rail.** Restructure `Sidebar.tsx` into (a) a quiet top porcelain group (Digest, Search, Status) as sans rows with a leading line-icon, then (b) the five modules as collapsible section headers using `moduleHue()` icon chips, tall calm rows (≥32px), an in-row state badge (`Count`/`StatusPill` — amber only when pending > 0), affordances hidden until row hover. Remove any monospace from labels (apply `wc-sans` / rely on the new sans default). Active item carries the accent spine only.
- [ ] **Step 2: Workspace/vault identity row.** Add a top-left identity row (current workspace name + chevron) that opens the existing `Overlay`/popover with current + a Recent list + "+ Add folder" (wire to the existing `switchVault` in `app/vault.ts` — no new API).
- [ ] **Step 3: Footer cleanup.** Reduce `Footer.tsx` to calm status (connection dot via `StatusDot`, workspace, a quiet shortcut hint); drop dense mono clutter; sans labels.
- [ ] **Step 4: Verify.** `npm run test -w @zuzuu-web/web && npm run typecheck -w @zuzuu-web/web`; screenshot → `after-sidebar.png`; pass the resting-state checklist.
- [ ] **Step 5: Commit** `feat(web): calm two-tier sidebar + workspace popover + footer cleanup`.

### Task 6: Session pane — the hero (receipts + demoted terminal)

**Files:**
- Modify: `web/packages/web/src/app/SessionPane.tsx`, `components/SessionCards.tsx`, `components/SessionIndicator.tsx`, `term/TermView.tsx`
- Read for design: `docs/design-research/02-session-conversation-composer.md`

- [ ] **Step 1: Work-pane split.** Restructure `SessionPane.tsx` so the default surface is a **conversation transcript**, with the xterm terminal moved into a **tab** of a work pane (reuse `components/ui` `Tabs`), demoted from the always-on surface. The terminal keeps mono and xterm styling — only inside its tab.
- [ ] **Step 2: Receipts.** Render each tool/command/edit/guardrail event in the transcript as a `<Receipt>` (leading glyph + sans label like "Edited store.mjs" / "Ran npm test" / "Guardrail: blocked rm -rf", machine detail as the mono `meta` chip, expandable to the diff/output). Substantial events (plans, diffs, checkpoints) become bordered `Card`s. Use the existing command-block/session-cards data (`lib/session-cards.ts`) as the event source — no new data shape.
- [ ] **Step 3: Step lists + paused banner.** Render multi-step agent activity as a green-check/`Spinner` checklist; show a calm "paused — waiting for your input" banner when the session awaits input (`SessionIndicator`).
- [ ] **Step 4: Verify.** Keep `session-cards.test.ts` green; `npm run test -w @zuzuu-web/web && npm run typecheck -w @zuzuu-web/web`; screenshot → `after-session.png`. Checklist: the resting transcript is sans prose with one-line receipts, mono only inside expanded detail + the terminal tab.
- [ ] **Step 5: Commit** `feat(web): session-as-conversation receipts; terminal demoted to a work-pane tab`.

### Task 7: Composer (host-picker pill)

**Files:**
- Modify: `web/packages/web/src/components/SessionComposer.tsx`
- Read for design: `docs/design-research/02-session-conversation-composer.md`

- [ ] **Step 1: Host pill + picker.** Replace the plain prompt chrome with a quiet host pill summarizing the selected host (icon + name), opening a glyph dropdown of hosts with one-line descriptions (data from `modules/host-launch.ts`). Mode chips sit beneath the input. Send button uses the accent; morphs to a stop control while running.
- [ ] **Step 2: Warm empty state.** When the composer is empty/first-run, show a greeting + 2-3 faculty-seeded suggestion chips (sans).
- [ ] **Step 3: Verify.** Keep `host-launch.test.ts` green; test + typecheck; screenshot → `after-composer.png`.
- [ ] **Step 4: Commit** `feat(web): composer host-picker pill, mode chips, send→stop morph, warm empty state`.

### Task 8: Module grid + pulse

**Files:**
- Modify: `web/packages/web/src/panel/PanelRoot.tsx`, `panel/ModuleView.tsx` (grid view), `panel/kit/ModuleTile.tsx`, `panel/kit/MetricChip.tsx`, `panel/kit/Section.tsx`
- Read for design: `docs/design-research/03-entity-cards-overview-dashboard.md`

- [ ] **Step 1: Card model.** Restyle `ModuleTile` to the Copy.ai model — large `moduleHue()` icon chip, module name as primary (sans, `text-title`), one-line description, the count embedded in the verb/secondary line (not a giant stat), `cardStatus()` driving color (amber dot only when pending). Add a per-card "Gen N" `StatusPill` (neutral). Cap radius ≤10px, ~20-24px padding, no card-background hue.
- [ ] **Step 2: Pulse strip.** Add a Plane-style pulse strip above the grid using `MetricChip`/`HeroNumber`: sessions, proposals pending, active generation, guardrail activity — compact stat tiles, color only on the actionable one (pending).
- [ ] **Step 3: Ghost card.** Add a 6th ghost/affordance card (dashed hairline, "+ add module / explore") to fill the 3-col rhythm.
- [ ] **Step 4: Verify.** Keep `kit.test.ts` green; test + typecheck; screenshot → `after-grid.png`. Checklist: grid reads as living capabilities, ~90% neutral.
- [ ] **Step 5: Commit** `feat(web): module grid as calm card model + pulse strip + ghost card`.

### Task 9: Module / knowledge detail

**Files:**
- Modify: `web/packages/web/src/panel/ModuleView.tsx` (detail view), `panel/ModuleDocs.tsx`, `panel/schema-fields.ts` (+ its viewer), `panel/kit/ItemRow.tsx`
- Read for design: `docs/design-research/04-hierarchy-relationships-graph.md`

- [ ] **Step 1: Body + properties rail.** Lay the detail as a centered reading body (large sans title; the fact/prose body may use the serif display accent at display size) capped to a ~640-720px measure, with a right **`Rail`** of `PropertyRow`s (type / source / generation / confidence — enums as colored pills only). Type/source/ids render in the mono `meta` slot, not the body.
- [ ] **Step 2: Quoted-context backlinks.** At the body bottom, render "Related (N)" as rows showing the connecting *sentence* (Reflect model), not bare titles, using existing item relations data.
- [ ] **Step 3: Schema viewer.** Restyle the `schema-fields` viewer to Fibery type-icon rows (a type glyph per field + label + value), not a key/value JSON dump.
- [ ] **Step 4: Verify.** Keep `schema-fields.test.ts` + `kit.test.ts` green; test + typecheck; screenshot → `after-detail.png`.
- [ ] **Step 5: Commit** `feat(web): module detail — reading body + properties rail + quoted backlinks + typed schema rows`.

### Task 10: Generations / versioning

**Files:**
- Modify: `web/packages/web/src/panel/ModuleGenerations.tsx`, `panel/GenerationsTimeline.tsx`, `panel/GenerationDiff.tsx`
- Read for design: `docs/design-research/05-versioning-lineage-time-travel.md`

- [ ] **Step 1: History as levels.** Render generations as an ordinal **`Level` ladder** (Gen 1 → 2 → 3) with an explicit "Active generation" `StatusPill`, date-grouped two-tier rows with provenance ("minted from proposal #12 · you · 2h ago"), using `progression.ts` (`genLadderLabel`) to show "N more approved proposals → Gen X" toward the next level.
- [ ] **Step 2: Diff off by default.** Put `GenerationDiff` behind a "Highlight changes" toggle (`Segmented`/checkbox), off by default.
- [ ] **Step 3: Append-safe rollback.** Reframe rollback as "make Gen 4 active" with the reassuring line "This won't delete Gen 5", confirmed via a quiet `Toast` (`graduate`/`toast` motion), never the word "revert".
- [ ] **Step 4: Verify.** test + typecheck; screenshot → `after-generations.png`. Checklist: reads as progression, not a git log.
- [ ] **Step 5: Commit** `feat(web): generations as a level ladder with append-safe rollback`.

### Task 11: Review + NEEDS-YOU ceremony

**Files:**
- Modify: `web/packages/web/src/modules/ReviewFlow.tsx`, `panel/NeedsYou.tsx`, `panel/ProposalDetail.tsx`, `panel/ProposalRow.tsx`
- Read for design: `docs/design-research/07-review-approval-triage.md`

- [ ] **Step 1: One-at-a-time card.** Restyle `ReviewFlow` to a single centered card with a "3 of 7" counter, structured WHAT / WHY (collapsible evidence + a "seen in N sessions" `StatusPill`) / WHAT-HAPPENS (consequence micro-copy under the primary button, e.g. "Approve — mints Gen N+1"). Three softened `Button`s (primary Approve / secondary "Not yet" / danger-text Reject).
- [ ] **Step 2: Finish ceremony.** On approve: quiet `Toast` + `graduate` motion + auto-advance; end the queue on a warm `TeachingEmpty` ("All caught up — you taught the agent N things today").
- [ ] **Step 3: NEEDS-YOU entry.** Restyle `NeedsYou` as a counted entry point grouped by module (count chips, amber only when pending).
- [ ] **Step 4: Verify.** Keep `review-queue.test.ts` + `proposal-evidence.test.ts` green; test + typecheck; screenshot → `after-review.png`.
- [ ] **Step 5: Commit** `feat(web): review as a finishable one-at-a-time ceremony + counted NEEDS-YOU`.

### Task 12: Sessions + trace

**Files:**
- Modify: `web/packages/web/src/panel/SessionsSection.tsx`, `panel/SessionDetail.tsx`, `panel/SessionBrief.tsx`
- Read for design: `docs/design-research/09-status-observability-trace.md`

- [ ] **Step 1: Sessions list.** Airy table with recency section headers, status as the only color, a faint `--color-error-subtle` tint on failed rows, a slim header sparkline/counts strip. This is a **data table → dev-tier compact density is allowed here**, but labels/headers stay sans; ids/durations are mono.
- [ ] **Step 2: Trace detail.** Render the trace as a narrative timeline of typed-icon `Receipt`/`Card` rows → span tree on demand → a per-span inspector `Rail` (`PropertyRow`s, mono values). Summary-first KPI header (`HeroNumber`s). Waterfall is a secondary toggle, not the default.
- [ ] **Step 3: Verify.** test + typecheck; screenshot → `after-sessions.png`.
- [ ] **Step 4: Commit** `feat(web): calm sessions table + narrative trace with span inspector rail`.

### Task 13: Guardrails / settings / instructions

**Files:**
- Modify: `web/packages/web/src/panel/ModuleView.tsx` (guardrails and instructions are modules — their items render through ModuleView's item/detail rendering), `panel/schema-fields.ts` + its viewer (rule/field rendering), `panel/sections.ts` (grouping). Note: there is no dedicated `Guardrails.tsx`/`Settings.tsx` — the guardrails module's `rule` items and the instructions module's `steering`/`amendment` items both flow through ModuleView; this task specializes their rendering.
- Read for design: `docs/design-research/10-settings-rules-policy.md`

- [ ] **Step 1: Three-state policy rows.** Render guardrail rules with the Vanta three-state palette — one color token per row (green=allow / amber=ask / rose=deny via `StatusPill`), bold sans label + muted description, the literal pattern as a small `wc-mono` chip, an "enforced by the guardrails gate" locked note.
- [ ] **Step 2: Plain-English summary.** Above the rule list, render a plain-English "When … then …" summary sentence with the variables as chips.
- [ ] **Step 3: Instructions editor.** Render the instructions/steering artifact as a calm document (sans, reading measure), not a code editor.
- [ ] **Step 4: Verify.** Keep `schema-fields.test.ts` green; test + typecheck; screenshot → `after-guardrails.png`.
- [ ] **Step 5: Commit** `feat(web): three-state guardrail rows + plain-English summary + calm instructions`.

### Task 14: Command palette

**Files:**
- Modify: `web/packages/web/src/palette/CommandPalette.tsx`; `index.css` `[cmdk-group-heading]` already styled
- Read for design: `docs/design-research/11-command-palette-quick-actions.md`

- [ ] **Step 1: Blended command-first overlay.** One overlay, grouped by kind (quiet uppercase labels), two-line rows (sans primary + muted description), a leading kind-icon (module hue for module rows), right-aligned shortcut hints (`Kbd`), a persistent footer legend (↑↓ navigate · ↵ run · esc close).
- [ ] **Step 2: Never-blank open state.** On open with empty query, show Recent sessions + Suggested actions.
- [ ] **Step 3: One-time coach-mark.** Show a dismissible `CoachMark` teaching a chord on first open (persist dismissal in localStorage).
- [ ] **Step 4: Verify.** test + typecheck; screenshot → `after-palette.png`.
- [ ] **Step 5: Commit** `feat(web): command palette — grouped never-blank overlay + footer legend + coach-mark`.

### Task 15: Onboarding

**Files:**
- Modify: `web/packages/web/src/onboarding/VaultPicker.tsx`, `onboarding/WelcomeOverlay.tsx`
- Read for design: `docs/design-research/08-onboarding-provisioning.md`

- [ ] **Step 1: Auto-advancing accordion checklist.** Restyle `WelcomeOverlay` to a Graphite-style checklist: active step expanded, completed steps grey + check, copyable CLI shown as a `wc-mono` chip inline, progress in words + a slim `ProgressBar`.
- [ ] **Step 2: Completion moment.** End on a genuine completion moment (a digest preview card) + one optional dev-flavored personalization question. `VaultPicker` gets a warm, calm restyle (cards, not a bare list).
- [ ] **Step 3: Verify.** Keep `vault-picker-logic.test.ts` green; test + typecheck; screenshot → `after-onboarding.png`.
- [ ] **Step 4: Commit** `feat(web): onboarding accordion checklist + completion moment + calm vault picker`.

### Task 16: Empty / educative micro-UX

**Files:**
- Modify: `web/packages/web/src/panel/kit/TeachingEmpty.tsx` (extend to "preview the filled state"), and apply across surfaces (sidebar/grid/sessions/review empties); add the progression pill to `app/Footer.tsx` or the shell
- Read for design: `docs/design-research/14-empty-states-educative.md`

- [ ] **Step 1: Preview-the-filled-state empties.** Extend `TeachingEmpty` to optionally render a faint preview of the populated surface above the warm second-person headline + one CTA. Apply to the empty sessions / knowledge / proposals states.
- [ ] **Step 2: Icon-row-triplet explainers.** Where a surface introduces a new noun (modules, generations, proposals), add a 3-icon benefit-triplet explainer (composed from existing icons).
- [ ] **Step 3: Ambient progression pill.** Add a persistent collapsed "Your agent: Gen N · M facts · K pending" pill to the shell (footer or sidebar foot), driven by existing overview data.
- [ ] **Step 4: Verify.** test + typecheck; screenshot the empties → `after-empty.png`.
- [ ] **Step 5: Commit** `feat(web): preview-filled empties + noun explainers + ambient progression pill`.

---

## Phase 3 — Final sweep & review

### Task 17: Mono-audit, accent-rationing, contrast, full green

**Files:** any flagged by the audit (across `web/packages/web/src/`)

- [ ] **Step 1: Mono leak audit.** Grep for residual `font-mono` on chrome:
```bash
cd /Users/hkc/Documents/zuzuu/web/packages/web/src
grep -rn "font-mono\|wc-mono" --include=*.tsx . | grep -vi "term\|shiki\|prose\|Kbd\|meta\|id\|path\|duration\|pattern"
```
Review each hit; remove mono from any chrome/label/heading/button. Mono is allowed only on machine data (ids/paths/durations/ops/logs/code/terminal/literal patterns).
- [ ] **Step 2: Accent + raw-hex audit.** Grep for raw hex and stray accent usage in surfaces:
```bash
grep -rn "#[0-9a-fA-F]\{6\}\|text-accent\|bg-accent" --include=*.tsx .
```
Route raw hex through tokens; confirm accent appears only on primary actions + active nav.
- [ ] **Step 3: Contrast spot-check.** On 3-4 representative surfaces, confirm body/muted text holds WCAG-AA on its background (use the Chrome DevTools accessibility/contrast check or `lighthouse_audit` for a quick a11y pass).
- [ ] **Step 4: Full green.**
Run: `cd /Users/hkc/Documents/zuzuu/web && npm run test -w @zuzuu-web/web && npm run typecheck -w @zuzuu-web/web && npm run test -w zuzuu-web`
Expected: all suites pass, typecheck clean.
- [ ] **Step 5: Commit** `refactor(web): mono/accent/contrast final sweep`.

### Task 18: End review package

**Files:** none (assembly).

- [ ] **Step 1: Assemble before/after.** Confirm a matching `before-*.png` and `after-*.png` exist for each major surface in `docs/design-research/shots/`.
- [ ] **Step 2: Append a LOG entry.** Add a `docs/LOG.md` entry summarizing the redesign (foundation + surfaces shipped, what changed, test count), per the build-journal discipline.
- [ ] **Step 3: Commit** `docs: log the workbench visual redesign`.
- [ ] **Step 4: Present to the user.** Send the after-screenshot set (SendUserFile) with a short summary of the biggest visual moves and the before/after deltas. Do NOT merge to main or publish — await the user's review.

---

## Notes for the executor

- **Do not** run `git push`, bump `web-app`/package versions, or publish — this is a branch build; the user reviews before any merge.
- **Each surface task is independent** and composes the same locked foundation — if a surface needs a primitive that doesn't exist, extend Task 4's kit first, then use it (don't hand-roll a styled div).
- **Verify with the running dev workbench**, never assume; the resting-state checklist is the gate.
- The daemon serves THIS repo (`/Users/hkc/Documents/zuzuu`) so every surface has real `.zuzuu/` data (modules, 3 proposals, 3 guardrails, sessions) to render — empty states still need testing by viewing a module with no items.
