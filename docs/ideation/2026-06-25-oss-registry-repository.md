# Ideation — the central zuzuu **registry repository** (and does it belong at the OSS tier?)

> **Status: ideation artifact (2026-06-25).** Ranked candidate directions, not a plan. Produced by a
> 4-frame `ce-ideate` fan-out (first-principles forms · prior-art analogies · workbench unlocks ·
> tier-threading) + synthesis. The chosen direction routes to `ce-brainstorm` next.
> _Format note: written as markdown (not the ce-ideate HTML default) to fit this repo's all-markdown
> doc canon and the downstream `ce-brainstorm`/`ce-plan` flow._

## The question

1. **Which tier did we discuss the "central repo that controls all of an org's zuzuu projects" in?**
2. **Should that concept also exist at the open-source (free, local, solo) tier** — as a standalone repo that
   is the registry of all projects, binds them with org-wide things, and is consumed by the workbench?

## The answer to (1): the **Enterprise** tier

It lives in **`docs/specs/2026-06-22-tiered-architecture.md`** under _Enterprise = admin control-plane_, as **two
git-native artifacts**:

- **The org module registry** — _"a curated `.zuzuu/`-shaped repo [that] is the admin's source of truth for
  org-published modules."_ Publish = **fan-out PRs** into each subscribing project's `.zuzuu/`; the project owner
  merges (**"the merge IS the gate"**); a project tracks an org module like a vendored upstream dep.
- **The roll-up** — a read-only dashboard reading every project's `.zuzuu/` into one admin view; the audit log
  falls out of git history.

And the glossary (`docs/learn/glossary.md`) **fences the boundary**: _"There is **no master/aggregate Project** —
each repo carries its own. Cross-project aggregation … is a **roll-up** + an **org module registry**, **never 'the
brain', never one big Project.**"_

## The answer to (2): **yes — but as the *same artifact at a smaller scale*, not a master brain**

The instinct is right, and there's already proof of the need: the just-built **Projects Home** reads
`/api/projects/list` — a **local, ephemeral** pass over `~/.webcode` recents. The workbench *already wants* a
cross-project index; today it's machine-local throwaway state, not a durable, git-native, shareable artifact.

All four ideation frames **converged independently** on the same shape and the same hard line:

> The OSS registry is a **thin binding manifest + shareable module library** — a `.zuzuu/`-shaped git repo that
> **registers** projects (pointer-list + derived roll-up) and **binds** shared modules (gate-respecting pull/PR).
> It is emphatically **not** a Project that *aggregates* its members. It threads up to Enterprise by **adding
> collaborators + a dashboard + required-status enforcement** — an access-control event, **not a port**.

Two invariants every surviving idea obeys (both frames stated them unprompted):

1. **The registry is a binding manifest + a library of *publishable* module definitions — never an aggregation of
   subscriber runtime notes.** The instant it grows its own loop/generations/gate-over-itself, it's the forbidden
   "master Project."
2. **The daemon never mutates N repos directly.** Every cross-project write is **N proposals through N gates**
   (a PR per subscriber, each landing through that project's own human review). This is the moat, identical at
   every tier.

---

## Ranked survivors

### S1 — The registry **is** a `.zuzuu/`-shaped git repo (`role: registry`) · _the spine_
Same `project.md` / `module.md` / note envelopes / generations as any Project, distinguished only by a
`role: registry` key. The workbench points its existing `getRoot()` at it and gets the cross-project Home + the
shared-module library "for free" (same parser, index, gate). **Why it wins:** zero new substrate; one artifact at
both scales. **Strongest objection:** highest gravitational pull toward the forbidden master brain — survives
**only** if `role: registry` is enforced in code to hold *project refs + publishable module defs*, never copied
subscriber notes/logs.

### S2 — The `source:` **vendor pin** · _the load-bearing continuity primitive_
A subscribed module gains frontmatter `source: { registry: <url>, module: <id>, generation: <hash>, mode:
suggested|required }`, reusing the existing content-addressed per-module generation hash. `zz check` gains one
integrity check: "vendored module drifted from its pinned upstream." **Why it wins:** makes "tracks an org module
like a vendored upstream dep" *literally true* at both scales — OSS pins to your registry, Enterprise to the org's,
same field. `mode` is the suggested-vs-required seam. **Objection:** `required` is inert at OSS (nothing to enforce
against) — ship it as a documented Enterprise-gated stub, with `suggested` the only OSS-active value.

### S3 — Fan-out = **N proposals through N gates** · _the moat-preserving form of publish_
`publish` opens a PR/proposal per subscriber (drop the module's notes into its `.zuzuu/`, title
`chore(zuzuu): publish <module>@<gen>`); the owner merges. **Why it wins:** the gate primitive (a human merges a
PR) is tier-invariant; only auth + the subscriber list change. **Objection:** this is also the **cannibalization
edge** (see Risk R1) — a too-good fan-out engine *is* most of the Enterprise value.

### S4 — Bind by **remote + stable handle**, never by path · _portability_
Each entry binds a project by its **git remote URL + a stable slug** (DNS-style indirection), not `~/dev/foo`.
**Unlocks "Portable Home":** clone the registry on a new machine → your whole project list is there before you've
cloned a single project repo; move/rename a repo → edit one line. **Objection:** needs a "locate-or-clone"
resolution step per project on a fresh machine, and local-only (no-remote) projects can't port — the bind-by-remote
distinction is load-bearing, not optional.

### S5 — The registry is a **derived/curated index**, not the authority · _Backstage inversion_
Truth stays in each project's `project.md`; the registry's project list is a curated pointer-list **seeded by
discovery** (the existing `~/.webcode` recents scan becomes *input*, re-read on each fan-out). The roll-up *view*
(explicitly blessed by the glossary) renders in the workbench. **Objection:** a curated list drifts (a project
moves, a pointer rots) — needs the existing `check` integrity pass over registry pointers.

### S6 — Groups / workspaces / tags as **committed metadata**
Named groups ("client-work", "OSS", "experiments") as frontmatter on project entries; Projects Home sections/filters
by group, health rolls up per group — the *same* on every machine because it's committed. **Objection:** survives
**only** while the registry stays a binding manifest (pure metadata on pointers); the moment groups gain modules/a
loop, it's the master Project again.

### S7 — One `zz registry` verb family; the **subscriber-resolver is the only tier seam**
`init · add · publish · subscribe · sync` — frozen across tiers. The *only* tier-dependent input is
`resolveSubscribers(tier)`: OSS reads your own repo URLs from a `subscribers.md` note; Enterprise reads org
membership via a GitHub App token. **Why it wins:** Enterprise ships **no new CLI** — just a wider scope resolver +
a dashboard. **Objection:** "same verbs unchanged" quietly leans on that resolver seam — make it explicit, don't
pretend there's no delta.

### S8 — Migration = **`gh repo transfer` + grant collaborators**, not an export/import
Solo→org is mechanical: the solo registry repo *is* the org registry — transfer it into the org, add collaborators,
install the GitHub App, flip the subscriber resolver. Full git history (the audit log) + accumulated house-style
modules carry over intact — a real switching incentive *into* the paid tier. **Objection:** a URL change breaks
every downstream `source:` pin → needs a **URL-stable registry identity** (a registry-id note decoupled from the
remote URL) for migration to be truly seamless.

---

## Demoted (the registry makes these durable/shareable — it doesn't *first-enable* them)

- **Cross-project review inbox** — one queue of every pending proposal across projects. You can already iterate
  `~/.webcode` recents for this; the registry only makes the project *set* stable/shareable. A durable cross-project
  *view*, not a registry-unlocked feature.
- **Cross-project search** (the *search* half only) — fan-out query over each project's existing FTS index, merge
  results; **no new durable index**. (The cross-project *meta-graph* is cut — gold-plating at solo scale.)
- **Registry-as-default-open** — a backing-store swap behind the *existing* Projects Home + a **fallback ladder**
  (registry if present → local recents → empty-state scaffold), not a new screen.

## Rejected outright (with reason)

- **Home-root `.zuzuu/` inheritance** (child projects resolve shared modules upward, `.editorconfig`-style) —
  **breaks two invariants at once:** org content reaches a project *without passing its gate* ("the merge IS the
  gate"), and a project stops being self-contained ("each repo carries its own"). The seductive-but-wrong idea.
- **npm/cargo-style central index + resolver** — imports a forbidden network plane *and* a non-gated automatic
  resolver.
- **Nx/Turborepo/Terraform "governing workspace root"** — literally the forbidden "one big Project that governs
  many."
- **A new dedicated registry file format** — a rewrite seam between tiers; breaks "everything is an envelope."
- **Publish via direct push / force-sync** — deletes the gate; without the PR-merge there's no continuity, just a
  config-management tool.
- **A master project that aggregates subscriber runtime state for the dashboard** — the direct violation of
  "no master/aggregate Project"; the dashboard must read each `.zuzuu/` independently (collaborator-on-all).

---

## The two strategic risks worth resolving in `ce-brainstorm`

**R1 — Cannibalization.** A polished `multi-gitter`-grade OSS fan-out engine *is* most of the Enterprise core given
away free, shrinking the paid delta to "a dashboard." **Mitigation:** a deliberate **OSS fan-out ceiling**
(sequential, no concurrency/retry/rollback, no required-status, no GitHub-App auth). The paid delta must be
**reliable fan-out at 50+ repos + cross-boundary enforcement + SSO/SCIM**, *not* "a dashboard."

**R2 — Does a solo dev actually want publish-fan-out to their *own* repos?** For most solo users, pushing a
house-style module to 3 side projects by hand is ceremony. **The sharpest insight of the whole fan-out:** the OSS
registry's real value is **pull-first** — *(a)* a **portable, durable project Home** (S4/S5) + *(b)* a **personal
shared-module library you `subscribe` from** (S2). **Publish/fan-out (S3) is a verb that only earns its keep when a
second human appears** — so OSS *pre-installs* it (forward-compat) but doesn't headline it. This cleanly resolves the
OSS-vs-Enterprise tension: **build the registry at OSS as Home + library (pull); the governance/fan-out half is
pre-wired but Enterprise-activated.**

## Recommended next step

Route **the pull-first OSS registry** (S1 spine + S2 pin + S4 portability + S5 derived-index + S6 groups, with S3/S7/S8
as the pre-wired-but-Enterprise-activated continuity layer) to **`ce-brainstorm`** to pin down: the exact on-disk
envelope shape of a `role: registry` repo; the `source:` frontmatter contract + the `check` drift rule; the
bind-by-remote resolution + fallback ladder behind the existing Projects Home; and the explicit free/paid cut line
(R1) — so the OSS build is forward-compatible with the Enterprise org-registry without giving the moat away.
