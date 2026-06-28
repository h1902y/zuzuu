# Requirements — the OSS pull-first zuzuu **registry**

> **Status: requirements (2026-06-25), ready for `ce-plan`.** Produced by `ce-brainstorm` from the ideation
> `docs/ideation/2026-06-25-oss-registry-repository.md`. The registry's *place* in the tier strategy is locked
> (see `docs/specs/2026-06-22-tiered-architecture.md`); this doc specifies the **OSS, pull-first** artifact and
> the seams that keep it forward-compatible with the deferred Enterprise org-registry.

## Outcome

A solo developer gets a **durable, git-native, portable index of all their zuzuu projects** plus a **personal
library of shared modules they can pull into any project** — replacing today's ephemeral `~/.webcode` recents pass
(`web/src/server/projects-routes.ts`, `project-health.ts`) with a real, committable, machine-portable artifact the
workbench consumes. It is built so the Enterprise org-registry is *the same artifact at a larger scale* (add
collaborators + a dashboard + enforcement), never a rewrite.

## Locked premise (from ideation — do not relitigate)

- The registry is a **`.zuzuu/`-shaped git repo** marked `role: registry`. Same envelope/module/project substrate;
  the workbench points its root at it for free. It is a **binding manifest + a library of publishable module
  definitions + project refs** — **never an aggregation of subscriber runtime notes**. The instant it grows its own
  observe→propose loop, generations over aggregated content, or a gate-over-itself, it has become the forbidden
  master Project (`docs/learn/glossary.md`: *"no master/aggregate Project … never the brain"*).
- **The daemon never mutates N repos directly.** Every cross-project write is **N proposals through N gates** — the
  human review gate is the moat, all the way up.
- **OSS value is pull-first**, both halves in v1: (a) a portable project **Home** (bind-by-remote), (b) a personal
  shared-module **library** you `subscribe` from (the `source:` vendor pin + `zz check` drift).

## Decisions resolved in this brainstorm

| # | Decision | Choice |
|---|----------|--------|
| D1 | v1 scope | **Both halves** — portable Home **and** module library. |
| D2 | Cardinality | **Single personal registry** per user in v1; the `source:` pin always carries a stable registry **identity**, so multiple-registries / community-taps / the Enterprise org-registry are a non-foreclosed extension. |
| D3 | Project membership | **Automatic tracking**, reconciled (D3a/D3b below) so it doesn't violate the curated-shareable invariant. |
| D3a | Auto-track churn | Opening a project **auto-adds it to the registry's working tree**; commits are **batched on `zz registry sync`** (or an explicit snapshot), **never per-open** — no git-history spam. |
| D3b | Auto-track noise | Each entry carries **`tracked: auto \| pinned`** + optional group tags; the curated/shareable view filters to pinned+grouped, auto entries stay available — no throwaway repos polluting the shared index. |
| D4 | Naming | Keep **"registry"** as the user-facing product term (the org-registry already uses it). The colliding *code* identifiers — the **capability registry** (`src/serve/dispatch.mjs`) and the **host-adapter registry** (`src/hosts/registry.mjs`) — get a qualified name; a `ce-plan` concern, not a product change. |
| D5 | `source:` pin shape | Pins by `{ registry, module, generation: <n>, sha: <commit>, mode: suggested\|required }`. The integer `n` is the human handle; the git commit SHA (`zz-gen: <module>/<n>`) is the exact pin. `required` ships **inert** (Enterprise-gated); **`suggested` is the only OSS-active mode**. |
| D6 | Bind-by-remote + local fallback | Entries bind by `git remote get-url origin` + a stable handle. A project with **no remote** is still auto-tracked but bound by **path + flagged non-portable** — it doesn't travel when the registry is cloned elsewhere. |
| D7 | Approach | **Extend the existing substrate** — no new framework. Reuse `src/notes`, a new façade method on `src/serve/api.mjs`, a `case 'registry'` in the flat CLI switch (`src/cli/index.mjs`), and the just-built `web/` Projects layer (no new top-level mode). |

## The registry artifact — on-disk shape

A normal git repo whose `.zuzuu/` is `role: registry`. Everything is an envelope (markdown + frontmatter); the
substrate already tolerates new types/keys round-trip-exact (`src/notes/note.mjs` — only `type` is required, unknown
keys preserved, `id` = filename stem). Three kinds of content:

1. **`project.md` (`role: registry`)** — the manifest marking this repo a registry. Carries the **registry identity**
   (a generated, stable id — see *Registry identity* below) so `source:` pins survive a future remote/URL change.
   *Surfacing `role` from `readProject` (`src/notes/project.mjs`) is a one-line edit; the key already survives on disk.*

2. **Project-ref notes** (one per tracked project) — a new envelope `type` (e.g. `type: project-ref`). Frontmatter
   contract:
   - `remote` — `git remote get-url origin` (the portable bind), or absent for local-only.
   - `path` — last-seen local path (machine-local hint; the only bind for local-only projects).
   - `handle` — a stable slug (decoupled from path *and* remote) used for grouping + cross-references.
   - `tracked` — `auto | pinned` (D3b).
   - `groups` — list of group/workspace tags (D8, committed metadata).
   - `health` — the denormalized stamp `{ modules, notes, pending, guarded, lastActivityMs }`, exactly
     `readProjectHealth`'s shape (`web/src/server/project-health.ts`), captured at sync-time and **stamped with
     capture-time** so the workbench can badge staleness.

3. **The shared-module library** — ordinary `module.md` + note envelopes (knowledge/instructions/guardrails kinds),
   authored to be **vendored into other projects**, version-pinned by the existing per-module generations.

> **The registry has no loop of its own.** No `observe`/`propose`/`review` over the registry's own content; no
> generations of aggregated subscriber data. `query` + `check` (the universal read verbs) work on it; that is all.

### Registry identity

A generated, stable identifier written into the registry's `project.md` at `zz registry init` (e.g. a random slug or
uuid), **independent of the git remote URL**. `source:` pins reference this identity, not the URL — so transferring
the registry repo (the future solo→org migration) does not break downstream pins. The local resolver maps
`identity → current clone location` (a small local mapping, e.g. under `~/.zuzuu/`).

## Contracts

### The `source:` vendor pin (on a subscribed module in a *consuming* project)

When `zz subscribe` vendors a registry module into a project, the project's copy of that module carries a `source:`
frontmatter block:

```
source:
  registry: <registry-identity>
  module: <module-id>
  generation: <n>          # human handle
  sha: <commit-sha>        # exact pin (zz-gen: <module>/<n>)
  mode: suggested          # 'required' is inert in OSS (Enterprise-gated)
```

- **Read by** `zz check` and `zz subscribe`/`sync`.
- **Drift rule:** the module has *drifted* when the project's vendored content no longer matches the pinned
  `sha`/`generation` from the registry (the upstream advanced, or the local copy was edited). `zz check` reports drift
  as an integrity finding (alongside its existing broken-links/orphans/stale checks).
- **Updates never auto-apply.** Pulling a newer upstream generation lands as a **normal local proposal** through the
  project's own human gate — `subscribe`/`sync` stage it; `review` lands it; `evolve` mints the project's own
  generation. (The merge IS the gate, even for your own shared module.)

### Project-ref note

See *on-disk shape #2*. Created/updated by auto-tracking (D3) and `zz registry add`. The workbench renders it as a
Projects Home row; the daemon **reads** it but never edits another project through it.

## Journeys + receipts

1. **`zz registry init`** → scaffolds a `role: registry` repo (a git citizen; zuzuu never `git init`s — the user
   inits/clones the repo) with `project.md` (identity minted). Receipt: *"registry <identity> ready."*
2. **Auto-track (passive)** → opening any project (CLI or daemon) appends/updates its `project-ref` in the registry
   working tree as `tracked: auto`. No commit. Receipt: silent (surfaced as an "uncommitted changes" hint in the
   workbench).
3. **`zz registry sync`** → batches the working-tree changes (refresh each ref's `health` stamp via `readProjectHealth`,
   re-resolve remotes) and **commits** them. Receipt: *"synced N projects (M new)."*
4. **`zz subscribe <module>`** (single-registry: no registry arg in v1) → vendors the library module into the *current*
   project as a **staged proposal** with its `source:` pin. Receipt: *"staged <module>@<n> for review."* → `zz review`
   lands it through the gate.
5. **`zz check`** (in a consuming project) → reports any drifted `source:`-pinned modules. Receipt: *"<module>: drifted
   from <registry>/<module>@<n>."*
6. **Update a subscribed module** → `zz sync` (or re-`subscribe`) detects a newer upstream generation and stages the
   update as a proposal; the project owner reviews. Never a silent overwrite.
7. **Portable Home on a new machine** → clone the registry repo → open the workbench → the full project list renders
   from the committed `project-ref`s (remote-bound projects offer "locate or clone"; local-only refs show as
   non-portable/absent).

## Workbench consumption (reuse the just-built Projects layer)

- **Projects Home reads the registry** when one is configured, via the **fallback ladder**: registry if present →
  local `~/.webcode` recents if not → empty-state scaffold ("create your registry"). No new top-level mode — this is a
  data-source swap behind the existing Projects Home (`web/src/client/shell/projects/`).
- **Groups (D8)** render as sections/filters in Projects Home + the switcher (committed, so identical on every
  machine).
- **Auto vs pinned**: auto-tracked rows are visible but visually secondary; a one-click "pin"/"group" promotes them.
  An "uncommitted changes — N projects tracked since last sync" affordance triggers `zz registry sync`.
- **Module-library surface**: a view of the registry's shareable modules; "Subscribe to this project" opens the
  vendoring as a **proposal** (lands through that project's gate). Bind-by-remote "locate or clone" resolves a project
  not present locally.
- **Staleness**: the denormalized `health` stamp renders with a capture-time badge; live health still comes from the
  per-project read when the project is open.

## CLI surface + the resolver seam

A new `case 'registry'` in the flat verb switch (`src/cli/index.mjs`), sub-routing like `case 'module'`, with free
`--json` via the existing `emit()`; the veneer owns no logic — it calls a new façade method on `src/serve/api.mjs`.
Zero-dep CLI core preserved.

- **OSS-active:** `zz registry init`, `zz registry add <path>`, `zz registry sync`, `zz subscribe <module>`,
  `zz check` (drift extension), `zz registry status`.
- **Pre-wired but inert (Enterprise-gated):** `zz registry publish <module>` (fan-out) and the
  `resolveSubscribers(tier)` **seam** — in OSS it resolves to *your own repos only*; Enterprise swaps **scope + auth**
  (org membership via a GitHub App) without changing the verbs. The fan-out engine ships **sequential, no
  concurrency/retry/rollback, no required-status** (the deliberate OSS ceiling — see *Free/paid cut*).

## Free/paid cut + OSS non-goals (the cannibalization guard, R1)

**OSS-free:** the registry repo shape; auto-track + `sync`; the portable Home + bind-by-remote + fallback ladder;
groups; the module library + `subscribe` + the `source:` pin + `suggested` mode + `zz check` drift.

**Deferred to Enterprise (out of scope here, pre-wired only):** the read-only roll-up **dashboard** across many
projects; **`required`-mode** enforcement (GitHub Org Rulesets required-status); the **GitHub App** cross-collaborator
auth + bot identity; **SSO/SAML + SCIM**; **reliable at-scale fan-out** (concurrency, partial-failure recovery, drift
reconciliation across 50+ repos). The OSS fan-out ceiling is intentional so the Enterprise delta stays "reliable
cross-boundary governance," not "a dashboard."

**OSS non-goals (name them so planning doesn't drift):** no live zuzuu API/service; no cross-project *write* without
N gates; no cross-project *aggregate index/graph* (search may fan-out-query per project, but no durable meta-index);
no team/multi-human governance (membership, who-can-edit-shared-modules) — that is the Enterprise layer; the registry
never grows its own loop/generations/gate.

## Enterprise upgrade story (continuity — for context, not built here)

The OSS registry *is* the Enterprise org-registry at solo scale. Becoming an org registry is an **access-control
event, not a port**: transfer the repo into the org, add collaborators, install the GitHub App, and flip
`resolveSubscribers` from "my repos" to "org membership." Because pins reference the **registry identity** (not the
URL), they survive the transfer. `publish` (already pre-wired) activates with org scope; `required` mode lights up via
Org Rulesets; the dashboard + SSO/SCIM are the paid additions. Full git history carries the audit log for free.

## Hard invariants preserved

Everything is an envelope (type-distinguished markdown+frontmatter) · the human review gate is the moat (every write,
including subscribed-module updates, lands through it) · 100% git-native, no live zuzuu API · session ≡ git branch
(unaffected) · zero runtime deps in the CLI core · reuse `src/notes` / `src/serve` / `web/` · **NO master/aggregate
Project** — a roll-up/derived index is blessed; an aggregate brain is forbidden.

## Success criteria

1. A user can `zz registry init`, open three projects, `zz registry sync`, and Projects Home renders all three from the
   committed registry (not from `~/.webcode`).
2. Cloning the registry on a second machine reproduces the project list; remote-bound projects offer locate/clone;
   local-only projects show as non-portable.
3. `zz subscribe <module>` stages a `source:`-pinned proposal; `zz review` lands it; the vendored module carries the
   pin.
4. Editing the vendored copy (or advancing the upstream) makes `zz check` report drift; `zz sync` stages the update as
   a proposal (never an auto-overwrite).
5. The registry repo, inspected by hand, contains only `project-ref`s + a module library + a `role: registry`
   `project.md` — **no aggregated subscriber notes, no loop artifacts**.
6. `resolveSubscribers` is a single seam; `publish` exists but is inert/sequential in OSS. The zero-dep CLI core and the
   full `web/` test suite stay green.

## Dependencies / assumptions

- Generations are addressed by integer `n` + git commit SHA (`zz-gen: <module>/<n>`), **not a content hash** (verified
  in `src/notes/generation.mjs`) — the pin uses both.
- `readProjectHealth` reads from cold disk without a running daemon (verified) — the registry reuses it for the `health`
  stamp.
- The daemon root is settable (`args.dir`/`WEBCODE_ROOT`) so it can point at a registry repo (verified).
- A registry is a real git repo the user creates/clones; zuzuu never `git init`s it (consistent with `src/notes/store.mjs`).

## Outstanding questions (for `ce-plan` to resolve at implementation time)

- Where the **identity→clone-location** mapping lives (`~/.zuzuu/registry.json`? a per-machine config?) and how the
  CLI/daemon discover "which registry am I using."
- Exact `project-ref` filename scheme (by `handle`? by slugified remote?) and dedupe rule when the same project is
  opened from two paths.
- Whether auto-track writes happen in the CLI path, the daemon path, or both (and the debounce for the daemon).
- The precise drift comparison (compare working-tree content vs the pinned SHA's tree, or a recorded content digest at
  subscribe-time) given generations are git-commit-backed.

## Handoff

Route to **`ce-plan`** to design the build: the `project-ref` + `source:` envelope additions, the `registry` façade
method + CLI sub-router, the auto-track + `sync` mechanics, the `zz check` drift extension, and the Projects Home
data-source swap + fallback ladder — with `publish`/`resolveSubscribers` as the pre-wired-inert Enterprise seam.
