# Tiered architecture — OSS core · Pro hosted-VM · Enterprise control-plane · zuzuu-codes

> **Status: live strategy doc, WIP (started 2026-06-22).** Captured *as we talk it
> through*. Mix of decided + open — see the sections at the end.
>
> **⚠️ This is STRATEGY, not active work.** **Pro and Enterprise are DOCUMENTED HERE
> but NOT being built.** The active build is the **open-source tier** (the local CLI +
> daemon workbench). Pro/Enterprise are deferred — this doc exists so the architecture
> is settled when we *do* build them. When a workstream ships it graduates to LOG.md and
> its section here is deleted.

## The products

1. **Open-source** — the core, free. The local CLI (`zz`) + local daemon workbench +
   the filesystem-native zuzuu in your repo's `.zuzuu/`. Single user, your machine.
2. **Pro** — **hosting behind payment.** No local machine required: the whole
   experience runs in a cloud **VM**, browser as the full client. (The premise of the
   already-present `web/cloud/` broker + sandbox skin.) **VM is the source of truth;
   local syncs to it** (Q3).
3. **Enterprise** — an **admin control-plane**: the admin has **visibility over all
   projects, their modules, and their items**, and can **control the modules** across
   projects. (Org-wide oversight + module governance — not a per-module-type feature.)
4. **zuzuu-codes** — an **alternative to Claude Code**, the owned harness built over
   **pi-dev + OpenRouter**, with a **credits top-up** experience for those who want it.
   (This is stage ③ of the product sequence — the owned harness on pi.) A distinct
   surface from the workbench tiers: it's the *agent harness itself*, model-metered.

## The shape: a 2×2 grid + the harness alongside

The workbench tiers are two orthogonal axes, not one ladder:

- **Axis A — where compute runs:** local ⟷ hosted VM (OSS ⟷ Pro).
- **Axis B — who's in control:** solo ⟷ org admin control-plane (OSS/Pro ⟷ Enterprise).

|              | Solo            | Org (admin control-plane)   |
|--------------|-----------------|-----------------------------|
| **Local**    | OSS (free)      | Enterprise over local       |
| **Hosted VM**| Pro (paid)      | Enterprise-managed Pro      |

**zuzuu-codes** sits across all of them — it's the harness you run *inside* any of
these surfaces, metered by model credits, independent of where the zuzuu lives.

## Pricing (Q4/Q5 — decided direction)

- **Hosting (Pro) sits behind payment.** OSS local stays free.
- **zuzuu-codes = credits top-up** for model usage (OpenRouter-backed).
- **Model: base fee + usage-based.** Usage margin is a **% markup over the underlying
  infra** — OpenRouter (inference) and Fly.io (VM compute). So revenue = base
  subscription + pass-through-plus-margin on the two metered resources.

## Enterprise = admin control-plane (Q2 — decided framing)

The admin gets, across **every project** in the org:
- **Visibility** — read access to each project's modules and the items inside them.
- **Control** — the ability to govern modules (create / edit / enable / disable /
  push down) across projects.

This implies a **cloud roll-up**: the control-plane aggregates project zuzuus (their
modules + items) into one admin surface, and pushes module changes back down. It also
naturally carries the **audit log** (who changed which module, when) and the
**fleet observe roll-up** ("how the team uses terminal coding") — both built on v2's
existing gate-event log + transcript-mining signals, **not** a resurrected OTLP layer.

> Enforcement still flows through **guardrails** (the one *enforced* module — the
> PreToolUse gate), but the enterprise feature is the **admin's cross-project control
> over modules generally**, not a per-module-type mechanism. (Earlier five-module-type
> framing deleted — it caused confusion.)

## Decided: Q1 — 100% git-native, everywhere (incl. enterprise)

The zuzuu stays **filesystem + git-native** at every tier. There is **no live "zuzuu
API."** The reframe holds end-to-end:

```
zuzuu     = file/git-native, runs locally wherever it lives; sync = git push/pull
workbench  = daemon (HTTP/WS) over local files (local or VM) — the existing surface
governance = a GIT workflow (PRs across project repos) + a thin read-only roll-up
metering   = zuzuu-codes model proxy (OpenRouter) + credits  (the only true network plane)
```

- **Pro (VM source of truth, local synced):** both the machine and the VM run the same
  daemon+CLI against their *own* `.zuzuu/` files; local↔VM is **git push/pull**.
- **The daemon↔CLI drift is a purely *local* fix** (share `serve/api.mjs` in-process,
  or harden the shell contract) — decoupled from the network entirely.

### Enterprise as a git workflow (the lead-dev-PR analogy)

A senior lead enforcing a coding paradigm across a team **raises a PR to each project's
main branch**; each owner merges, resolving conflicts. Org modules work the same way:

- **An org module registry** (a curated `.zuzuu/`-shaped repo) is the admin's source of
  truth for org-published modules. (Ties into the *marketplace/templates* workstream.)
- **Publish = fan-out PRs** from the registry into each subscribing project's `.zuzuu/`.
- **The project owner merges** — *resolving conflicts = local adaptation*. **The merge
  IS the gate.** Even org modules pass the project's human gate; "the gate is the moat"
  holds all the way up to the org. Enforcement is *publish + strongly-encourage-via-PR*,
  not a remote lock.
- **Updates** = new PRs (org module v2 → PR to projects). A project tracks an org module
  like a vendored upstream dep: pull updates, may diverge.
- **Admin visibility** = the admin is a **collaborator on all projects** (git access) +
  a **read-only roll-up dashboard** that reads every project's `.zuzuu/` into one view.
  The **audit log falls out of git history** for free — every change is an authored,
  timestamped commit/merge.

This makes the "governance plane" *thin*: a tool that, given the registry + the list of
project repos, opens fan-out PRs and reads back state. Likely a **GitHub App** (PRs +
collaborator access + status) + a dashboard — git/GitHub-native, no zuzuu service.

> **Refinement needed (thinking out loud, per Harshit):** see "Still open" Q1a–c.

## Decided

- **Q2** — Enterprise is an **admin control-plane**: cross-project visibility into
  modules + items, and control over modules. Not a per-module-type enforcement feature.
- **Q3** — Pro: **VM is the source of truth; local syncs to it.**
- **Q4** — **Hosting sits behind payment** (OSS local free). **zuzuu-codes** =
  pi-dev + OpenRouter alt-to-Claude-Code with **credits top-up**.
- **Q5** — **base fee + usage-based**, margin = **% over OpenRouter + Fly.io**.
- **Q1** — **100% git-native everywhere**, no live zuzuu API; enterprise = a PR-publish
  git workflow; daemon↔CLI drift is a local fix; the only true network plane is
  zuzuu-codes metering.

## Pro architecture (deferred build — documented 2026-06-22, from 3 research fan-outs)

Decisions: **browser-only** (the workbench already *is* "browser VSCode"), **VM = source
of truth, local mirrors via background `git pull`** (not live file-sync), the git host is
a **pluggable sync hub**.


**The hard part is already built** (daemon hot core, test-pinned): `WEBCODE_HOSTED` mode
(binds `0.0.0.0`, fixed `PORT`/`WEBCODE_ROOT`/`WEBCODE_TOKEN`), Fly-edge-ready auth
(`publicHost` widening, `sha256(token)` cookie survives restarts), and the terminal
(real PTY + indefinite reconnect + session survival + flow control). Plus the zuzuu is
git-native + repo-resident, so "sync to local" = `git pull` the same repo.

**Substrate verdict — own the compute (Fly), git host is the sync hub (not the compute):**
- **Riding a provider for compute is a dead-end.** Codespaces: WebSocket broken in the
  browser path (4+ yr unresolved → our PTY terminal can't work) + no reseller billing +
  TOS forbids third-party-SaaS. Gitpod SaaS shut down Oct 2025. **No provider offers a
  reseller-billing hook** → the "base + % over infra" model needs us to own compute.
  Fly = per-second billing, $0 CPU stopped, Firecracker, raw Machines API.
- **Git host = pluggable hub** (the Coder/DevPod pattern): a thin two-layer abstraction —
  provider-agnostic wire ops (`isomorphic-git`/git CLI) + a per-provider REST adapter
  behind one `IProvider` (`exchangeOAuthCode/ensureRepo/setCollaborator/getCloneUrl`).
  **GitHub App, not OAuth App** (scales, survives a user leaving, least-privilege).
  **GitHub-first behind the seam**; a clean N-provider build is premature.
- **Adopt `devcontainer.json`** — Fly stays the managed substrate, but the same config
  runs in Codespaces/DevPod/Coder (BYO-env) and is the seam for a future
  **enterprise self-hosted Pro via Coder** (`coder_app` proxies arbitrary ports incl. WS).

**Build sequence (when we build it):** (0) brain-sync correctness — `.generations/.store/`
blobs must travel or rollback breaks on the VM; make `init.mjs` `IGNORE_LINES` explicit.
(1) un-stale `web/cloud/` to the folded layout + a Fly VM serving the daemon via
devcontainer. (2) the GitHub-App `IProvider` sync layer + a local `zz sync` background
pull. (3) persistence (Fly volume) + accounts + billing. (4) idle suspend/resume UX.
(Session survival across VM restart is *not* a goal — resume = fresh shell, files+zuzuu
intact via git.)

## Enterprise architecture (deferred build — documented 2026-06-22, from 4 research fan-outs)

**The differentiated thesis (the gap no incumbent owns):** Cursor/Copilot/Cody/Tabnine/
Devin/Replit all instrument the AI's **I/O** (usage analytics, content-exclusion, spend).
**None governs *how the agent's brain is shaped*** — which modules are active, proposed
vs approved, rollback history — because none has a *versioned, human-gated zuzuu*. That
IS zuzuu. Enterprise sells a **category incumbents structurally lack: governance of the
agent's evolving brain.** Plus a **privacy posture stronger than air-gapped Tabnine**:
signal derives from git history in the customer's own repos — no code egress, no
inference endpoint, no vendor telemetry. *"Governance changes are cryptographically-
attributed commits in your repo, not API calls to our SaaS."*

**The control-plane = read git + a thin event plane + identity + dashboard:**
1. **Governance/audit = READ GIT** (zero new instrumentation) via a GitHub App **scoped
   to `.zuzuu/**`** (org-wide `contents:read` gets rejected by security teams), processing
   commit **metadata not raw code** — these two constraints *preserve* the privacy moat.
   Readable today: `log.jsonl`, `proposals/archive/*`, `.generations/<m>/<n>.json`, git
   history (session-as-commit + authorship).
2. **The campaign/burn-down roll-up = the ONE thing git can't give → build it.** "Of N
   repos offered module X: M merged, K pending, J rejected." Emulate Sourcegraph Batch
   Changes; **`multi-gitter` (Apache-2) is a reusable fan-out + status building block.**
3. **A thin supplementary event log** for local-only/non-commit events (gate denials,
   rejects, session open/close) → customer-owned S3/SIEM — covers git's audit gaps (auth
   events → IdP, retention, tamper-evidence, non-commit decisions).
4. **Identity:** SSO/SAML + **SCIM** (auto-deprovision = hard SOC2 gate; WorkOS), RBAC.
5. **Dashboard** (benchmark vs GitHub Copilot Metrics API, all git-derivable): proposals
   generated/approved/rejected by module, gate-trigger frequency, session activity + the
   burn-down.

**Governance workflow (validated vs prior art):** publish = fan-out PRs (Batch Changes /
multi-gitter / Backstage); **the merge is the gate** (the *proven* enterprise pattern —
hard-lock alternatives "trade consent for uniformity, hostile to knowledge modules");
**two strengths** — *suggested* (soft PR) for most modules, *required* (a CI required
status check via **GitHub Org Rulesets**, `Evaluate`→`Active`) for non-negotiable
guardrails. **Publish + verify, never force.**

**Table-stakes to clear:** SSO/SAML+SCIM · audit→SIEM · usage dashboard · no-training ·
policy enforcement (both axes) · **SOC2 Type II** (~$20-35k yr-1) · DPA · pentest.

## Deferred — Enterprise features (revisit later; 2026-06-22)

**Decision: solve enterprise later.** The git-native *shape* is settled (PR-publish
workflow, the merge is the gate, admin = collaborator + roll-up + git-history audit);
the *features* are deferred. Noted requirements + open items to pick up:

- **Admin-as-collaborator provisioning (load-bearing).** Every admin must be a
  **collaborator on each of the members' projects** — that's what grants both the
  publish path (fan-out PRs) and visibility (roll-up). Need: how membership maps to
  project access, how a new project/member auto-grants the admin, revocation, and the
  **member ↔ project ↔ org association model** ("other related details").
- **Q1a — suggested vs required modules.** Soft (publish-via-PR only, dashboard shows
  adoption) vs hard (a compliance *verify* check — "repo carries org-module-X ≥ vN" —
  shown red / failing org CI). Likely start soft; add required-strength when a customer
  needs it. The gate is never overridden either way (publish + verify, not push-lock).
- **Q1b — registry + subscription shape.** One org-module repo or per-team; how
  projects subscribe; who maintains the fan-out list.
- **Q1c — git-host coupling.** GitHub-first (PRs + collaborator + checks) vs
  git-host-agnostic.

## Still open (to design later — NOT being built now)

- The OSS/paid line for the **workbench UI** itself (is the visual surface OSS, or the
  first paid thing independent of hosting?).
- Does the credits model attach only to zuzuu-codes, or also to Pro VM compute?
- **zuzuu-codes** mechanics (pi-dev + OpenRouter wiring, credits/metering) — undesigned.

## What we're actually building now: the open-source tier

Everything above (Pro · Enterprise · zuzuu-codes) is **documented strategy, deferred**.
The current build is the **OSS core**: the local `zz` CLI + the local daemon workbench +
the git-native `.zuzuu/` zuzuu. The one piece of the Pro/Enterprise design that's also an
OSS concern (and worth doing early, since it's small and local): **Phase 0 brain-sync
correctness** — ensure `.generations/.store/` blobs travel in git and make
`src/cli/init.mjs` `IGNORE_LINES` explicit, so the zuzuu round-trips cleanly (a correctness
win for OSS users syncing repos across machines today, independent of ever building Pro).
