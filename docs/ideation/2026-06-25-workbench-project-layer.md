---
date: 2026-06-25
topic: workbench-project-layer
focus: Onboarding + project-switching — the "Project layer" above the Stage+Wings shell
mode: repo-grounded
---

# Ideation: The Workbench Project Layer (Onboarding + Switching)

The Stage+Wings shell (`web/src/client/shell/*`) navigates *within* one Project. Pointing the
daemon at a folder and hitting the dead-end `no modules yet — run zz init` empty state exposed
two surfaces the shell spec never covered — both *above* the in-Project shell:

1. **Onboarding** — turning an un-initialized folder into a working Project.
2. **Switching** — moving between Projects (the workbench is bolted to one daemon root).

This doc ranks IA directions for both and names the one real architecture fork, to route the
winners into `ce-brainstorm`. It sits above [the shell-IA ideation](2026-06-25-workbench-shell-ia.md)
(which settled the in-Project frame) — these are the Project layer that wraps it.

## Grounding Context

**Codebase context (direct inspection):**

- **The daemon is one-workspace-per-daemon by design.** `root` is realpath-resolved once at boot
  (`web/src/server/cli.ts:126–135`) and threaded into `createDaemon({root})`; every surface
  (sessions, the `safe-path` jail, the `zz` CLI shelling) is rooted at it. Re-rooting a live
  daemon would fight that whole design — *not* a real option.
- **The multi-Project primitives already exist in `~/.webcode/`:**
  - `config.json` → `recent: string[]` — a deduped, most-recent-first, capped-10 recents list
    (`web/src/server/config.ts`); `addRecent(root)` already fires on every launch (`cli.ts:154`).
  - `instances/<sha16(root)>.json` → each *running* daemon's `{root, port, pid, token, version}`,
    written on listen, removed on clean shutdown (`web/src/server/instance-file.ts`). The CLI
    already computes this path to discover/reuse a running daemon.
  - `instances/<sha16>.token` → a stable per-workspace token surviving restarts.
  - There is prior art for the heavier path: `web/cloud/broker` already spawns/proxies
    per-workspace daemons (`BROKER_BACKEND=local|fly`).
- **`zz init` is idempotent and minimal** (`src/cli/init.mjs` → `initHome`): plants `project.md`
  + the guardrails floor (`module.md` + seed rules + `items/`/`staged/`) + the gitignore; content
  modules grow on demand. `writeOnce` skips anything that exists, and it **never `git init`s** —
  so "is this a git repo?" is a real precondition (session ≡ git branch).
- **`zz enable` is idempotent** (`src/cli/enable.mjs`): writes the `#zz-hook` block into
  `.claude/settings.json`, host auto-detected, never clobbering user hooks.
- **The daemon exposes neither init, enable, nor observe.** `/api/zuzuu/*` (`zuzuu-write.ts`) has
  only staged approve/reject + module enable/disable/new. So **onboarding needs new daemon routes**
  that shell `zz init`/`zz enable`/`observe` — the empty state cannot be copy-only.
- The shell home (`selected === null`) renders the `Overview` stage; the nav root is the
  `⌂ the database` button (`web/src/client/shell/{WorkbenchShell,NavTree}.tsx`). The footer
  `Ribbon` is the always-on ambient gate.

**External context (named prior art — `evidence-external-patterns.md`):**

- The switcher lives in exactly one of three loci: **top-left name-as-button** (Notion, Slack,
  Linear), a **launch/welcome screen** (TablePlus, GitHub Desktop), or **command palette only**
  (VS Code `Cmd+R` / Open Recent). Single-project-per-window tools keep switching light by
  auto-restoring last session + treating **"open a new window" as the unit of switching**.
- GitHub Desktop's **"this directory isn't a Git repository — initialize here?"** inline detection
  is the exact precedent for the `init` gate.
- First-run splits into two poles: **Vercel** engineers the empty state away (the first deploy IS
  onboarding, "no welcome modal, no checklist"), vs the dominant **persistent-but-collapsible
  checklist** (Stripe/Zendesk/Tandem) that checks off real actions and quietly vanishes at 100%.
- **No external tool introduces "the product watches and proposes" as a first-run concept** — the
  strongest inference is that **the first proposal card itself is the introduction**.

## Topic Axes

- **Empty-state onboarding** — the un-initialized → working journey, its form and narration.
- **Switcher placement** — where the project picker lives and how "currently open" reads.
- **Daemon / runtime architecture** — how switching maps onto one-daemon-per-root.
- **The Project-home surface** — what `⌂ the database` becomes; the seat both features share.

## Ranked Ideas

1. [The Project-home envelope unifies switch + onboard + home](#1-the-project-home-envelope-unifies-switch--onboard--home)
2. [Onboarding: the in-canvas setup checklist that fades to receipts](#2-onboarding-the-in-canvas-setup-checklist-that-fades-to-receipts)
3. [Switching: top-left brand-name popover + ⌘O accelerator](#3-switching-top-left-brand-name-popover--o-accelerator)
4. [Architecture: browser-hops to per-daemon + a launcher route](#4-architecture-browser-hops-to-per-daemon--a-launcher-route)
5. [The init gate: inline "not a Project yet → Initialize" detection](#5-the-init-gate-inline-not-a-project-yet--initialize-detection)
6. [The first proposal IS the onboarding payoff](#6-the-first-proposal-is-the-onboarding-payoff)

### 1. The Project-home envelope unifies switch + onboard + home

**Description:** Treat the home surface (`⌂ the database`) as the **Project's own `project.md`
manifest envelope** — which it literally already is ("everything is an envelope"). That one surface
absorbs all three jobs by state, not by adding features:
- its **title is the switcher** (click `⌂ <project name>` → the recents popover);
- its **empty/under-initialized state is the onboarding stepper** (idea #2);
- its **steady-state body is the module-cards home** already built.

So onboarding and switching aren't bolted-on surfaces — they're the *empty-state* and the
*title-affordance* of the Project's home envelope. This is the north star the other survivors serve.

```
┌─────────────────────────────────────────────┐
│ ⌂ cards-game  ▾   ← title = switcher popover │
│ ───────────────────────────────────────────  │
│  state = un-initialized → setup stepper (#2) │
│  state = steady         → module cards (home)│
└─────────────────────────────────────────────┘
        footer ribbon = the always-on gate
```

**Axis:** The Project-home surface.
**Basis:** `direct:` `project.md` is a real `type: project` envelope minted by `initHome`
(`src/cli/init.mjs`); the home stage + nav root already exist (`WorkbenchShell.tsx`, `NavTree.tsx`).
`reasoned:` one surface with three states beats three surfaces — it keeps the "no modes" law the
shell-IA ideation locked, and gives switching/onboarding a principled home instead of new chrome.
**Rationale:** The biggest risk in adding a "Project layer" is bolting two new top-level surfaces
onto a shell whose whole thesis is *one frame, no modes*. Anchoring both to the home envelope keeps
the frame intact and gives `ce-brainstorm` a single object to specify.
**Downsides:** Overloading one surface with three states risks a muddy spec if the state machine
isn't crisp; needs the daemon to surface Project identity + health (a small read route).
**Confidence:** 78%
**Complexity:** Medium

### 2. Onboarding: the in-canvas setup checklist that fades to receipts

**Description:** When the Project is un/under-initialized, the home stage renders a calm vertical
checklist of the **real setup verbs as buttons**, each with a one-line "why", advancing as actions
actually complete and collapsing to a ✓ receipt — then the whole checklist fades and the home
becomes the module-cards view. The rungs map to existing CLI verbs (each behind a new daemon route):

```
This folder isn't a zuzuu Project yet — let's plant one.
  ① Initialize        [ Initialize ]   zz init  → .zuzuu/ + the guardrails floor
  ② Enable your agent [ Enable ]       zz enable → wire Claude Code's lifecycle hooks
  ③ Start a session                    a session is a git branch; zuzuu watches it
  ④ Review your first proposal         the gate — nothing is written without your yes
```

Reachable as a transient `⚑ Set up this Project` node in the nav tree (consistent with the
"sessions and modules are siblings" law — onboarding is just-another-selectable-node), and the
**ribbon carries the steady-state nudges** afterward (`○ hooks off · press E to enable`). Notion-calm:
monochrome, copy specific to the step, no modal takeover.

**Axis:** Empty-state onboarding.
**Basis:** `external:` the Stripe/Zendesk/Tandem "persistent collapsible checklist that checks off
real actions and vanishes at 100%", paired with Linear's monochrome inline empty-state. `direct:`
the rungs are real idempotent verbs (`initHome`, `enable.mjs`) — re-running is safe, so the checklist
can reflect true state, not a fake wizard.
**Rationale:** The verbs already exist and are idempotent; the missing piece is purely the calm
surface + the routes to fire them. A checklist that *is* the real actions (not a tour) fits the
"receipts not logs" ethos.
**Downsides:** Needs 3 new daemon routes (init/enable/observe) + a host-detection read for ②; the
git precondition (idea #5) must precede ①.
**Confidence:** 80%
**Complexity:** Medium

### 3. Switching: top-left brand-name popover + ⌘O accelerator

**Description:** Make `⌂ <project name>` (top-left, where `⌂ the database` is now) the click target →
a popover listing recent Projects (read from `config.json.recent` + `instances/`), each with a
running/idle dot, last-active, and pending/live badges, plus **"Open a folder…"**. `⌘O` opens the
same picker from the keyboard (and it can fold into the existing `⌘K` palette as a verb). "Currently
open" needs no badge — it's the name in the title, exactly as VS Code/DB-tools do it.

**Axis:** Switcher placement.
**Basis:** `external:` the top-left-name-as-button locus (Notion/Slack/Linear) + VS Code's
keyboard-first Open Recent; single-project tools indicate "current" by the title alone.
`direct:` the recents + running-instance data already exist in `~/.webcode/` — the picker is a thin
read over files already maintained.
**Rationale:** The most discoverable spot, and it reuses data the daemon already writes. Pairing the
visible affordance with `⌘O` serves both newcomers and the keyboard-driven steady-state user.
**Downsides:** Needs a small read endpoint that lists recents + running instances (cross-Project —
the files are global in `~/.webcode/`, so any daemon can serve it); the popover must reconcile
"recent but not running" vs "running" states (ties to idea #4).
**Confidence:** 76%
**Complexity:** Low–Medium

### 4. Architecture: browser-hops to per-daemon + a launcher route

**Description:** The fork switching forces. Recommended minimal path: **keep one daemon per Project**
and make "switch" navigate the browser to the target's URL. Picking a **running** Project →
`window.location` to its `:port/?token=` (read from its instance file). Picking an **idle** recent →
call a small **launcher route** on the current daemon that runs `zz web <root> --no-open` (or
`createDaemon`), waits for its instance file, and returns the new URL. Each Project stays fully
isolated (own PTYs, own `safe-path` jail, own token) — no shared mutable root.

```
 Switch (browser-hops, minimal)          Switch (hub/broker, cloud-forward)
 ┌────────┐  hop URL   ┌────────┐         ┌──────────────┐  proxy   ┌────────┐
 │ daemon │ ─────────▶ │ daemon │         │ browser ─▶ hub│ ───────▶ │ daemon │
 │ projA  │            │ projB  │         │  (stable :port)│         │ projB  │
 └────────┘            └────────┘         └──────────────┘          └────────┘
 + launcher route spawns idle ones        one URL; hub spawns/proxies (= cloud/broker, local)
```

**Axis:** Daemon / runtime architecture.
**Basis:** `direct:` the daemon is rooted-at-boot and the instance/recents files already key by
workspace (`cli.ts`, `instance-file.ts`); `cloud/broker` already does spawn-and-proxy. `external:`
"open a new window is the unit of switching" (VS Code/DB tools/git GUIs).
**Rationale:** Browser-hops reuses the entire existing architecture and ships now; the hub/broker is
the same shape as the already-built cloud broker and is the natural seat for the future tiered
roll-up / org-registry — so this is a *sequencing* decision (hops now, hub when cloud lands), not an
either/or. **This is the key fork to resolve in `ce-brainstorm`.**
**Downsides:** Browser-hops means a full page load on switch (acceptable — it's a context switch) and
a token-bearing URL hop; the launcher route spawns processes, so it needs the same care as `zz web`
(singleton reuse via the instance file). Hub/broker is a real new always-on component.
**Confidence:** 72%
**Complexity:** Medium (hops) / High (hub)

### 5. The init gate: inline "not a Project yet → Initialize" detection

**Description:** The very first rung of #2, called out because it's the literal dead-end today and has
a clean precedent. When the daemon's root has no `.zuzuu/` (or isn't a git repo), the home reads a
single calm diagnostic sentence + one contextual CTA — GitHub-Desktop style — rather than the
CLI instruction `run zz init`. Two-stage when needed: "This folder isn't a git repository yet"
→ (git init, user-confirmed) → "Plant a zuzuu Project here" → `zz init`.

**Axis:** Empty-state onboarding.
**Basis:** `external:` GitHub Desktop's "this directory does not appear to be a Git repository —
create one here?" inline detection. `direct:` `initHome` never `git init`s and skips existing files,
so the git precondition is real and init is safe to surface as a button.
**Rationale:** It's the smallest, highest-leverage fix — it turns the one screen every new user hits
from a dead-end into the first rung. Worth landing even if the fuller checklist (#2) comes later.
**Downsides:** The git-init sub-step is a real filesystem mutation — must be explicit/confirmed, not
silent (the gate philosophy).
**Confidence:** 82%
**Complexity:** Low

### 6. The first proposal IS the onboarding payoff

**Description:** A framing constraint on #2's rung ④, not a separate surface. Since no external tool
teaches "observe → propose", **don't explain the loop in a wizard step — let the first real proposal
card arriving in the ribbon be the aha.** The checklist's last rung is therefore "do real work in a
session", and onboarding *completes* when the first proposal lands and the user makes the first
yes/no at the gate. The setup steps stay visible and explicit (never hidden), but the *teaching* is
by doing.

**Axis:** Empty-state onboarding.
**Basis:** `external:` Vercel's "the first deploy IS the onboarding" + the absence of any
observe/propose first-run prior art → "show the proposal, don't explain the loop". `reasoned:` the
gate is the product's whole moat; experiencing one approval teaches more than any copy.
**Rationale:** Aligns the onboarding payoff with the product's core magic and the human-gate
philosophy — and explicitly rejects the tempting anti-pattern of *secretly* running init+enable to
"get to value faster" (that would violate the no-surprise-writes law).
**Downsides:** Time-to-aha depends on the user actually starting a session + the observer producing
a proposal — the gap between "set up" and "first proposal" must itself feel calm, not empty.
**Confidence:** 70%
**Complexity:** Low (framing) — rides on the review queue already planned for the shell.

## Rejection Summary

| # | Idea | Reason Rejected |
|---|------|-----------------|
| 1 | Full-screen "plant the Project" takeover splash | Reintroduces a mode/route the shell-IA ideation deliberately dissolved; heavier than an in-canvas empty state (#2) for no gain. |
| 2 | Secretly run init+enable under "Start a session" | Violates the gate/transparency law (no surprise filesystem writes); the aha (#6) doesn't require hiding the setup. |
| 3 | Ribbon-only onboarding (the footer carries the whole flow) | Too thin for a brand-new user who needs the *why* of each step; absorbed instead as the steady-state nudge layer of #2. |
| 4 | A "PROJECTS" section inside the in-Project nav tree | Category error — that tree is scoped to one Project's contents; cross-Project navigation belongs at the title/home altitude (#1, #3), not mixed into sessions/tables. |
| 5 | One daemon with a swappable/mutable root | Fights the entire rooted design — the `safe-path` jail, session worktrees, the per-workspace token + instance model all assume a fixed root; high risk, no payoff over browser-hops (#4). |
| 6 | Notion-style survey-driven personalization (role/use-case Q&A) | Wrong genre for a local dev tool over a git repo — there's nothing to personalize; the Project's shape comes from observed work, not a signup survey. |
