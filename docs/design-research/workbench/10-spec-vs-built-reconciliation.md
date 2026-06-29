# Workbench — locked spec vs. what's built (reconciliation)

> **Plane 5 kickoff artifact (2026-06-29).** Reconciles the locked design against the shipped
> `web/src/client`, so "the workbench experience reimagination" starts from the truth: **most of the
> locked design is already built.** Sources: the CRUD-admin reframe [`05`](05-experience-spec.md),
> the taste/screen-journey brief [`09`](09-taste-redesign-direction.md), the shell IA
> [`../../brainstorms/2026-06-25-workbench-shell-requirements.md`](../../brainstorms/2026-06-25-workbench-shell-requirements.md)
> (R1–R10), and a file-level audit of the SPA.

---

## 0. What "the locked spec" actually is (read this first)

The design isn't one document — it's **three layers, and they disagree in one place**:

| Layer | Doc | Status |
|---|---|---|
| **The reframe** — workbench = CRUD-admin over Project-as-database (module=table, note=row, FK=relations); writes → pending proposal | `05` §1, `R10` | **locked, intact** |
| **The taste + screen journey** — MARVIN warm dual-theme, the type/icon/elevation deltas, Projects Home → Overview → in-project, the screen set | `09` | **locked, the target** |
| **The shell IA** — `nav · stage · wing` + ribbon, no modes | `2026-06-25 shell-requirements` R1–R10 | **locked — supersedes `05`'s two-world shell** |

**The one contradiction, resolved:** `05` §2–3 locked a **two-world `Work ⇄ Brain` ⌘K switch**. The
2026-06-25 ideation found that structurally flawed (the gate is the *seam* between the poles, so a
hard mode-switch is the one IA that hides a proposal behind a flip) and replaced it with the
**no-modes Stage+Wings** frame. **The build followed the newer doc.** So when `05` and the build
disagree about the shell, *the build is right and `05` is stale* — not a gap.

→ **Doc-hygiene action:** mark `05` §2 (two worlds) and §3/§4's world-framing **superseded** by the
shell-requirements doc, the way LOG.md supersedes shipped specs. (Listed in §6.)

---

## 1. Verdict in one line

The engine, the shell, the design-system *infrastructure*, and ~11 of the locked surfaces are
**built**. The remaining work is **taste-completion** (two real gaps: the MARVIN display face was
never wired, and grid cells render flat) plus **deferred-by-design surfaces** (audit log, Mission
Control, inline-on-note, slide-over peek, schema-graduation UI). **This is a finishing job, not a
rebuild** — which reframes what "reimagination" can mean (§7).

---

## 2. Foundations / engine — ✅ built

| Target | Built | File |
|---|---|---|
| Proposal-returning **DataProvider** (`getList/One/Many` + `create/update/...` → a `StagedChange`, never a landed row) — the gate as a data-contract | ✅ | `data/provider.ts` |
| **FieldType registry** (`Record<FieldType, FieldConfig>` over the 8 types; drives grid + form + graduation) | ✅ | `data/field-registry.ts` |
| **ListContext** pull-model (server-side filter/sort/paginate via the index) | ✅ | grid + state |
| Copy-owned kit (shadcn/Radix lineage, no batteries lib), Tailwind v4, cmdk, Lucide | ✅ | `ds/kit/`, `palette/` |
| Ported `term/` PTY engine (untouched) | ✅ | `term/` |

This is exactly `05` §8's "spine — write this first." It's done and is the strongest part of the build.

---

## 3. Shell IA (R1–R10) — ✅ built, with the two-world model correctly absent

| Req | Target | State | Notes |
|---|---|---|---|
| **R1** | One fixed `nav · stage · wing` + footer ribbon, no modes | ✅ | `shell/WorkbenchShell.tsx`, `NavTree.tsx`, `Ribbon.tsx` |
| **R2** | One nav tree, sessions + modules as siblings (`●/○` liveness, `▣/◇` types) | ✅ | `shell/NavTree.tsx` |
| **R3** | Stage morphs by selection (session→terminal · module→grid · row→record · graph→ER); DB is home | ✅ | pure `selectActors` morph in `shell/shell-state.ts` |
| **R4** | Wing morphs by context (session→review · note→form · module→schema); retracts when idle | ⚠️ | built, but the wing only mounts at the `xl:` breakpoint (`WorkbenchShell.tsx:254`) |
| **R5** | Gate outside any mode — ribbon (ambient) + queue (catch-all) + inline-on-note | ⚠️ | ribbon ✅ + dedicated queue ✅; **inline-on-note deferred by design** (R5.2 fast-follow) |
| **R6** | Single stage + dots; Mission Control as opt-in roof | ⚠️ | single-stage ✅; **Mission Control deferred by design** (build when concurrency lands) |
| **R7** | Slide-over "peek the brain"; two-up deferred | ✅ | `shell/peek-state.ts` (reducer; opening a peek doesn't change stage selection) + the overlay renderer; **two-up split deferred by design** |
| **R8** | ⌘K = jump-to-node + key actions, not a shell | ✅ | `palette/` (cmdk) |
| **R9** | Reuse the built layers; Notion-calm | ✅ | composes DataProvider/FieldType/ListContext/kit |
| **R10** | Invariants: CRUD-admin not IDE · writes→proposal · terminal-is-transcript · session≡branch | ✅ | upheld throughout |

The **two-world shell + ⌘K world-switch is intentionally absent** — that's R1 superseding `05`, not a missing feature.

---

## 4. Design language (`09` Phase 0 + MARVIN) — infra ✅, soul ⚠️

| Delta | Target (`09`) | State |
|---|---|---|
| Warm **dual-theme** (light + dark) + real toggle | MARVIN Flexoki ramps, light↔dark | ✅ **built** — `index.css`, `state/theme.ts`, `ds/kit/ThemeToggle.tsx` (the strongest spec-aligned area) |
| **Lucide** icon system, retire unicode | `lucide-react`, monoline | ✅ built — `ds/kit/Icon.tsx`; unicode retired except data glyphs (✓, ↑/↓, +/−) |
| 4-level **elevation** by lightness | base/raised/card/overlay | ✅ built |
| Real **type scale** | `09`: `11·12·14·16·20·24·30` (7 steps) | ⚠️ built but **different**: `12·14·18·28·36` (5 steps) — reconcile or accept |
| **Characterful display face** (the MARVIN "soul") | `09`: **Bagel Fat One** logo + **Sigmar** hero + **Space Grotesk** UI + **Space Mono/JetBrains** mono split | ❌ **NOT wired.** The build loads **Alata** (UI) + **Abel** (display) + **Anonymous Pro** (mono, unified) + **Train One** (logo). The locked faces are installed but unused; the CSS comments even name Space Grotesk/Space Mono/JetBrains while loading the others. |
| **Typed grid cells** (pills / link-chips→titles / avatars / mono) | `09` D-grid; Neon/Notion | ❌ **flat text** — columns are schema-aware, but `field-registry` `format()` returns strings; no React cell renderers (`grid-columns.ts`). bool="✓", multi=comma-joined, link=raw id. |

**These two ❌ rows are the heart of why `09` said the workbench "reads premature."** `09`'s #1
structural lever was *type hierarchy + a characterful face*; its #2 was *typed cells*. The build
delivered the warm palette and Lucide, but **substituted thin clean grotesques for the chunky
rounded retro display face** and **left cells flat**. So the MARVIN *soul* is the largest un-realized
piece of the locked taste — not infrastructure, but identity.

---

## 5. Surfaces / screen set (`09` §4b finalized set) — ✅ at or ahead of the floor

| Surface | State | File |
|---|---|---|
| Projects Home (L1, table-with-facets) | ✅ | `shell/projects/ProjectsHome.tsx` |
| Project switcher | ⚠️ single-column dropdown (spec said two-pane — functionally fine) | `shell/switcher/Switcher.tsx` |
| New/Open project | ✅ | `NewProject`, `GlobalSettings` |
| Project Overview (balanced home base) | ✅ | `shell/overview/Overview.tsx` |
| Session (Terminal + **Changes** tab) | ✅ | terminal + `ReviewQueue` as Changes |
| Module (Grid + per-module Graph toggle) | ✅ (cells flat — §4) | `shell/stage/Grid.tsx`, `ModuleGraph.tsx` |
| Note (Record read + Form edit) | ✅ (stage+wing split, not one side-panel) | `shell/stage/Record.tsx`, `shell/wing/Form.tsx` |
| Review Queue (decision-on-item + reject-reason chips + diff) | ✅ | `shell/review/` |
| Schema / Generations + rollback | ✅ (field *editing* deferred) | `shell/wing/Schema.tsx` |
| Whole-brain Graph | ✅ (ahead of `09`'s Phase 3) | `shell/graph/BrainGraph.tsx` |
| Cross-note Search | ✅ (ahead of schedule) | `shell/search/Search.tsx` |
| Per-project Settings + Global settings | ✅ | `shell/settings/`, `GlobalSettings.tsx` |
| Onboarding / auto-prep (git-init→init→enable) | ✅ | `shell/onboarding/Checklist.tsx` |
| **Audit log** (project-wide journal) | ❌ **missing** — closest is per-module generations + provenance chips | — |

Against `09`'s "locked screens" floor, the build is **complete and then some** (Graph + Search
shipped early). The one true missing screen is the **audit log**.

---

## 6. The library divergence (a real decision to ratify)

`09` picked named libraries; the build **hand-rolled every heavy surface** and installed none of them:

| Surface | `09` pick | Built as | Installed? |
|---|---|---|---|
| grid | TanStack Table (+Virtual) | hand-rolled `<table>` | ❌ |
| ER / graph | react-force-graph-2d → sigma | hand-rolled SVG | ❌ |
| diff | react-diff-viewer-continued | hand-rolled `lineDiff` | ❌ |
| body markdown | react-markdown | `whitespace-pre-wrap` | ❌ |
| record form | react-hook-form | hand-rolled | ❌ |

**Ratified (2026-06-29): hand-rolled by default; adopt on demonstrated need.** The framing that
settles it: **"zero runtime deps" is a CLI-_core_ policy, not a web one** — the `web/` package
already ships React, xterm, TanStack Query, zustand, Lucide, and cmdk. So the web ethos is **lean,
not zero**: a library is adopted when it closes a **real capability gap** or a hand-rolled **ceiling
is hit**, never preemptively from the spec. MIT-only, lazy-loaded off the initial bundle.

| `09` pick | Surface | Hand-rolled today | Call | Trigger to adopt |
|---|---|---|---|---|
| **react-markdown** (+remark-gfm) | note **body** | `whitespace-pre-wrap` (raw `# foo`) | **ADOPT (lazy)** | now — note bodies *are* markdown; rendering them raw is a real fidelity gap |
| TanStack Table | grid | plain `<table>` + server-side list | **DEFER** | virtualization for a huge module, or a column-resize/group UX ask |
| react-diff-viewer | review diff | tested `lineDiff` | **DEFER** | reviewers need word-level / syntax-highlighted diff |
| react-force-graph / sigma | ER graph | hand-rolled SVG | **DEFER** | the graph becomes a real surface at scale (already a deferred slice) |
| react-hook-form | record form | controlled inputs + dirty-track | **DEFER** | typed inputs + validation outgrow the hand-rolled form |

So: **one adoption (react-markdown, lazy, for the note body)**; everything else stays hand-rolled with
an explicit trigger written down, so each deferral is a decision, not drift.

### Doc-hygiene actions
1. Mark `05` §2 (two worlds) **superseded** by the shell-requirements doc. *(still open)*
2. ~~Fix `index.css`'s self-contradicting font comments~~ — **done** in slice 1 (the MARVIN type system).
3. Record this ratification (§6) in LOG.md when plane 5's workbench slices land as a milestone.

---

## 7. So what *is* plane 5?

Because the locked design is ~85% built, "workbench experience reimagination" forks into two honestly
different things — **and this is the decision that scopes the plane**:

- **(A) Finish + polish the locked design.** Close the two taste gaps (wire the MARVIN display face;
  build typed grid cells — likely via TanStack Table), build the audit log, decide the library
  question, then pick up the deferred R-units (inline-on-note, Mission Control, slide-over) as their
  triggers land. Bounded, high-confidence, directly fixes "reads premature."
- **(B) Re-pitch the experience.** Treat the built shell as a working prototype and rethink the
  product experience itself (the IA, the gate ceremony, what the workbench is *for*) — a new ideation
  pass, not a finishing pass. Justified only if the current Stage+Wings model is judged wrong in use,
  not just unfinished.

**Recommendation: (A), with the MARVIN display face + typed cells as the first two slices** — they
are the locked design's own unfinished business and the literal cause of the "premature" read. Hold
(B) unless dogfooding says the *shape* is wrong, not just the *finish*.

> Deferred-by-design (do not treat as gaps until their trigger lands): inline-on-note annotations
> (R5.2), Mission Control (R6, real concurrency), the two-up split (R7, demonstrated cross-ref need),
> schema-graduation promote/split UI.
