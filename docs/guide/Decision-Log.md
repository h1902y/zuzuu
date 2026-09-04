# Decision Log

The load-bearing decisions zuzuu has committed to — tech stack, architecture, product. Treat this as the **"don't relitigate without cause"** list: each is recorded with the **decision**, the **why** in a line or two, and its **status/date** where known.

This page is *rationale*, not a feature list. zuzuu's standing wiki rule is **shipped-only for features** — but a decision log records direction too, so where a decision is **design-only / not built**, it says so. Don't read "decided" as "shipped" unless the status says so.

The deeper *why* lives in the repo: [docs/DESIGN.md](https://github.com/h1902y/zuzuu/blob/main/docs/DESIGN.md) (strategy & rationale) and [docs/LOG.md](https://github.com/h1902y/zuzuu/blob/main/docs/LOG.md) (the dated build journal).

---

## Tech stack

**The workbench is a Vite + React SPA over a local daemon (Hono + `ws` + `node-pty`) — not Next.js.**
The workbench is a *local stateful daemon*: it owns real PTYs, a binary-WebSocket terminal (flow-controlled xterm/WebGL), and fs/git/ripgrep, all on `127.0.0.1`. Next.js's SSR / server-component / serverless model fights a persistent stateful process and buys nothing for a token-gated localhost page (no SEO, no SSR benefit). The workbench also ships **bundled inside the CLI as static assets** (`vite build` → `web-app/`), with the CLI core zero-dep and the workbench's deps as `optionalDependencies` — a Vite SPA → static files fits that; Next.js wants its own Node server and a heavier footprint. The greenfield rebuild cut the client **18.1k → 1.7k LOC**. *Right tool per surface.*
**Where Next.js / Vercel does fit: the separate public `zuzuu.codes` site/dashboard** — a different surface (public, SSR/SEO-relevant).
Status: **shipped** (workbench at `web/`, rebuilt greenfield 2026-06-22).

**Zero runtime dependencies for the CLI core.**
`node:test`, `node:sqlite`, hand-rolled OTLP — a brain that installs cleanly anywhere. The workbench's deps ride as `optionalDependencies`, so a failed native build (e.g. `node-pty`) degrades the workbench, never the CLI. Node ≥ 22.
Status: **shipped** (a deliberate, enforced policy — `dependencies` stays empty).

**`node:sqlite` as the index (the keystone bet).**
A lazy, regenerable cache — notes + KV/EAV props + a typed link graph + FTS5 — rebuilt on mtime-staleness. Benchmarked at 5000 notes: build ~157ms / search ~13ms. It's a cache, not a source of truth (the markdown files are), so it can always be thrown away and rebuilt.
Status: **shipped**.

**git is the substrate.**
Session = branch, generation = content-addressed snapshot, rollback = restore. No parallel blob store. Borrows git's own model: content-addressed, write-once, history as movable pointers (see [Inspiration Log](Inspiration-Log) → git's object model).
Status: **shipped**.

**One package, one repo for the workbench.**
The workbench ships *inside* `@zuzuucodes/cli` as `web-app/` (staged at publish), not as a separate published package. `npm i -g @zuzuucodes/cli` is the whole product — CLI + workbench, one install, one version, one OIDC pipeline. There is no `@zuzuucodes/web` npm package.
Status: **shipped** (decided 2026-06-12).

---

## Architecture

**The observe model (Design B) — re-parse the host's own transcript, never drive the agent loop.**
zuzuu *wraps and observes* a host it never drives (the entire.io shape, not a goose/hermes streaming bridge). It can't corrupt a live session, and adding a host = one adapter file + one registry line. Live hooks are a *signal + re-capture trigger*, never a span builder.
Status: **shipped** — observe covers **5 hosts** (Claude Code · Codex · Gemini CLI · OpenCode · pi). **Refined (2026-06-29): observe is the _floor_, not the only mode** — see the ACP drive lane below.

**An opt-in ACP "drive" lane — own the workbench UX + build traces, without owning the loop.**
The absolute reading of "never drive" conflated *don't own the agent loop* (still true) with *don't control the session* (separable). The **Agent Client Protocol (ACP)** lets the workbench drive an ACP-native host (Claude Code, Gemini CLI) over a structured JSON-RPC event stream — tool calls, diffs, plans, thoughts, permission requests — so we can render our own conversation surface (off the host TUI) and build real traces, while the host's own SDK still owns the loop and **rides the user's Claude Code subscription** (not per-token API billing). Observe stays the universal floor for every host; the ACP lane is *additive* and workbench-only. Spec: [`docs/specs/2026-06-29-acp-drive-lane.md`](https://github.com/h1902y/zuzuu/blob/main/docs/specs/2026-06-29-acp-drive-lane.md).
Status: **subscription premise VALIDATED (2026-06-29) — lane in-build.** Spike #1 passed: a hand-written ACP client drove a full prompt turn through `claude-agent-acp@0.52.0` with the provider env key scrubbed, on a confirmed Max/Pro subscription login — no API key, `stopReason: end_turn`, structured events streaming. The decisive "ride the subscription" question is **YES** for the current stack. Spikes 2 (daemon stdio↔WS bridge + structured render) and 3 (gate via `request_permission`) remain before the lane ships. Standing macro risk: Anthropic announced, then *paused* (2026-06-16), splitting Agent-SDK/ACP usage into separate credits — re-verify before depending on it.

**The human gate is the moat.**
Every write to the brain passes through `review` (the human's approve/reject decision); the agent **proposes**, never commits. The loop is **observe → propose → review → evolve**, every write human-gated.
Status: **shipped**.

**The command table is the single source of truth.**
One declarative table (`src/cli/commands.mjs`) drives four consumers: the router, `zz help`, the guardrails write-verb **deny set**, and the daemon's **spawn catalog**. Add or rename a verb once and it flows to all four — an unlisted command can't exist, and the daemon can only shell a command the table knows.
Status: **shipped** (command-registry redesign, 2026-06-28).

**One write boundary — the moat made structural.**
`src/grow/commit.mjs` is the **sole note-writer and sole minter**: it applies a normalized op batch as one all-or-nothing transaction, then mints one generation per touched module. It refuses `actor: 'agent'` up front, so the agent reaches the writer only through `review`. (This closed an earlier two-writers split — exactly what a knowledge-poisoning attacker would exploit.)
Status: **shipped** (2026-06-28).

**Schema-enforced module tables.**
A module is a table, a note is a row. A `module.md` `fields` block (8 field types) validates every note at the write boundary — a schema-violating note is rejected before it lands. Absent `fields` ⇒ schemaless and flexible (full back-compat).
Status: **shipped**.

**The brain is read-open but write-gated.**
The agent **reads** `.zuzuu/` freely (a blanket deny would starve it of its own modules), but the enforced gate **denies the agent's direct writes** to `.zuzuu/` (session worktrees excepted), so the brain changes only through review. Lives as seeded gate rules (`protect-brain-writes` / `-shell`), fail-open.
Status: **shipped**.

**Interactive-mode-first, never headless.**
Two Anthropic-structural reasons: (1) pricing — interactive subscription usage stays in the unchanged pool while `claude -p`/SDK usage is metered separately; (2) surface — hooks / MCP / CLAUDE.md / skills only fully work in interactive mode. Headless wrappers lose exactly what zuzuu uses *and* get metered.
Status: **shipped as a pillar** (see [Inspiration Log](Inspiration-Log) → Claude Code pricing).

**Evolution engine runtime = Cloudflare Workflows only** — the *async* evolution loop, never the hot agent loop.
Running only the evolution loop (not the agent loop) on Workflows dissolves the loop-length risk; `waitForEvent` handles the human gate.
Status: **design-only / not built.**

---

## Product & positioning

**The three-stage product sequence.**
① host-agnostic wrapper (Claude Code · Codex · Gemini CLI, + OpenCode as a peer) → ② **OpenCode as the default bundled host** (`zz host code` — configure + launch, never fork or drive) → ③ an owned harness on **pi** for granular context/model control, gated on the efficiency benchmark. Never an OpenCode fork, never from scratch.
Status: **stage 1 shipped · stage 2 launcher shipped · stage 3 benchmark-gated** (decided 2026-06-10).

**The hidden `.zuzuu/` home — the `.git` model.**
The home is a hidden `.zuzuu/` folder, not a visible `agent/` dir (reversed with cause: clash risk in brownfield repos + un-announced visible folders read as clutter). Transparency comes from **porcelain** — `zz status` / `zz explain` / `zz digest` + plain-text files + the human gate — not from an un-dotted directory.
Status: **shipped** (decided 2026-06-12).

**Positioning: an AI-first directory for any folder-based work; coding is the first vertical.**
`zz init` turns any project folder into an AI-first directory — the user keeps their files and working style; zuzuu adds an external harness so the agent they already run works over that folder more efficiently, human always in control. Coding is the first vertical, not the boundary.
Status: committed direction (decided 2026-06-12).

**Philosophy: enhance, never reinvent.**
Don't reinvent files/folders, file preview, terminals, task formats, or the host's agent loop. The differentiators are open-source, local-native, and the graduation loop; everything else is borrowed, battle-tested practice. (The workbench's middle pane is an **embedded terminal** running the real host CLI — xterm.js, not a custom chat loop.)
Status: a standing principle.

**Org topology = a strict 1:N tree + mirror aliases** (never an arbitrary DAG).
Every node has exactly one parent → the agent canvas stays a clean tree; sharing is handled by mirror *aliases* of the same agent entity, so every delegation edge stays 1:N.
Status: **design** (the agent-org canvas is a future visual surface).

**Knowledge / Memory substrate = off-edge Postgres / Neon; graph (Apache AGE) and vector (pgvector) are earned top rungs**, not a foundational commitment.
The substrate climbs a ladder `md → relational → graph → vector`; the richer tiers are opt-in and benchmark-gated ("AGE is a prove-it").
Status: **design** (today's shipped substrate is the markdown/`node:sqlite` tier).

**The credits / monetization model is a flagged hypothesis — not decided, not built.**
Several variants exist (zuzuu-as-gateway, Zen-reseller, internal-LLM-ops credits, cloud sandboxes, a zuzuu-codes broker). Open-source + local-native stays free; any paid layer is convenience on top. Parked behind the product, deliberately undecided.
Status: **flagged, undecided, unbuilt.**

**Product-experience build order — six workstreams in dependency order; `zuzuu-web` becomes the one workbench.**
Decided 2026-06-12: the experience ships in order — home/onboarding → workbench → module-health UX → marketplace templates → tasks module → benchmark — and there is no separate web surface (`zuzuu-web` evolves *into* the workbench). The deeper rationale is [DESIGN §13](https://github.com/h1902y/zuzuu/blob/main/docs/DESIGN.md#13-product-experience--roadmap--the-six-workstreams-added-2026-06-12).
Status: **partially shipped** (onboarding + the workbench are built; the later workstreams are ahead).

---

## Conventions (hard-won — violating these has bitten us)

- **Real-wire-data rule.** Adapters/integrations are built and verified against output the host *actually produced* — never from docs alone, never against self-invented fixtures (that's circular). Observe real events *before* wiring lifecycle semantics. (Docs lied twice: Claude `Stop` and OpenCode `session.idle` are per-*turn*, not end.)
- **Golden ids in regression tests are pasted from a real run** — never hand-computed.
- **Verify fixes with `node bin/zuzuu.mjs`, never the PATH `zuzuu`** — the global is the *published* version and silently lacks unpushed code.
- **Hooks/plugins must never break the host** — always exit 0, spawn detached, degrade silently. The guardrails gate **fails open**: engine/rule errors emit no decision, never a block.
- **Secrets never land in tracked files** — scan before commit/push; generated host-enablement config is git-ignored.
- **The wiki is generated, not hand-edited.** The user guide's source of truth is `docs/guide/` in the main repo (reviewed in PRs, atomic with the code it documents); a GitHub Action (`publish-wiki.yml`) mirrors it to the `/wiki` tab on every merge to `main`. So the wiki can't drift from the repo — edit `docs/guide/`, never the wiki directly. *(2026-06-28 — superseded the earlier "hand-authored wiki, no automated sync" convention, which drifted after every redesign.)*

---

> Shipped vs designed is marked per entry above. For the implementation map see the repo's [CLAUDE.md](https://github.com/h1902y/zuzuu/blob/main/CLAUDE.md); for the prior art that shaped these calls see the [[Inspiration-Log|Inspiration Log]].

## 02-07-2026 — Two write lanes: the moat is agent-shaped, not human-shaped

Earlier entries phrase the gate as "every write to the Project passes through
review." Phase 1 of the personal-app roadmap made the doctrine precise: the
moat defends against **agent** writes (the knowledge-poisoning threat model) —
it was never meant to make the *human operator* propose to themselves. Now:

- **The agent lane is unchanged and untouchable**: observe → stage → review.
  `commit` refuses `actor:'agent'` in-process; the table-generated execution
  gate denies write verbs at the shell. Forever.
- **The operator lane is direct**: `note create/delete`, `--batch`, `module
  import` land instantly — but still through the ONE writer (`grow/commit.mjs`):
  validated, provenance-logged, minted. Direct ≠ ungoverned.

Rationale: a personal application needs instant human CRUD; the prior blanket
wording over-applied the moat to its own owner. The deeper creed — one writer,
one door, nothing lands unvalidated or unversioned — is unchanged. See
`docs/guide/Two-Lanes.md` and `docs/specs/2026-07-02-personal-app-roadmap.md`.

## 02-07-2026 — The World is a view, not the canvas, not the Project

The note-graph map ("the World") shipped as the workbench's map surface. Two
boundaries recorded so it never drifts: (1) the World is an ADDITION — it does
not replace or claim the unbuilt DESIGN §8 agent-org canvas (hexagons, 1:N
sessions), which remains its own future artifact; (2) the workbench — World
included — stays "a view onto a Project, not the Project." Map-first means the
map is the primary VIEW; the files remain the truth. The raw terminal stays
reachable per the conversational-composer spec ("never hide the terminal so
completely the user can't answer a y/n").

## 02-07-2026 — The envelope floor: write-boundary guarantee, read tolerance unchanged

`title · module · type · status` are never null on a landed note. The guarantee
lives at the ONE write boundary, not at parse: `repo.writeNote` FILLS the floor
(status → `active`; title → the body's first line, else the humanized id — date
ids stay verbatim) before validation, never overwriting a present value. Reads
stay tolerant — legacy/foreign files still parse; `type` remains the only
parse-level requirement. A verbatim `move` preserves bytes exactly.

Consequences, recorded: `zz validate` now SURFACES pre-floor notes (instead of
hiding them); `zz module backfill [--dry-run]` heals history through the same
door (one generation per module, provenance `{backfill: envelope-floor}`,
idempotent — deliberately not a `doctor --fix` flag, since doctor is an
agent-shellable read and a write behind its flag would hole the generated
execution gate); registry content digests are floor-normalized so a landed
subscription never reads as false local-edit drift; a schema declaring `title`
as required is satisfiable by construction now.

## 03-07-2026 — Tool-as-type, MCP-native: no new entity

A `type: action` note **is** a tool; the module it lives in **is** the toolkit;
a module's typed-column `fields` **are** the tool's `inputSchema`. No new
entity was minted to get there — the MCP hierarchy (toolkit/tool/inputSchema)
maps exactly onto the existing note/module/schema one. A tool declares **how**
it runs with a `binding: shell | agent | mcp` field (absent = `shell`, full
back-compat with every existing `run:` action note).

Rationale: adopting MCP's vocabulary instead of inventing a parallel one keeps
the moat's shape — the write boundary and the review gate don't change to
accommodate "tools," because a tool was never a different kind of thing. It
also sets up the north-star direction (§I.6): the daemon already *is* an
MCP-shaped server (Hono, token-auth); a real `tools/list`/`tools/call` surface
is a follow-on, not a redesign.

Status: **shipped** — `binding` + `zz tool list`/`show` (`shell` dispatch
built; `mcp` a clean stub; `agent` honestly returns `needsHost:true`, no
CLI-side ACP client). See `docs/specs/2026-07-02-polish-showcase-experience.md`
§I.6 and [[Tools]].

## 03-07-2026 — Secrets: a declaration, never a value, enforced at the write door

A `type: secret` note names an env var, who may resolve it (`scope`), how
strictly (`actor: operator-only | agent-allowed`), and where its value lives
(`resolves_from: env | secrets-file | fly | oidc`) — never the value itself.
The invariant is enforced, not just documented: the write door (`notes/
validate.mjs`) REFUSES any secret-shaped field on a `type: secret` note,
unconditionally, at every write path (`note create`, `stage`, `review
approve` all funnel through the one `writeNote`).

Rationale: three external systems (GitHub Copilot's branch-gate, GitHub
Environment Protection Rules, MCP's own OAuth-≠-authorization stance)
independently validate the same shape zuzuu already had — a declaration is
data, resolution is a runtime concern, and the dangerous thing (the
credential) is gated at the resource, not the caller. Delegating value
storage to the host (env / `fly secrets` / a keychain export) rather than
inventing a zuzuu-owned vault keeps the surface "borrowed, not invented" and
means there is no encrypted store to build or leak.

Status: **shipped** — declarations, the write-door refusal, scope+actor
gating, and placeholder injection (`ZZ_<NAME>`, the browser-use pattern) are
built; `oidc` resolution is accepted at the write door but honestly refused
locally (a host-side, per-run lane); cross-project secret sharing is
unbuilt. See `docs/specs/2026-07-02-polish-showcase-experience.md` §J.3/§J.5
and [[Secrets]].

## 03-07-2026 — The durable runner: the run is a note, at-least-once, never "exactly-once"

A `type: run` note is the whole state machine — which step is next, attempts,
what it's waiting on. `zz run advance` does ONE thing per call: read the
note, execute exactly one ready step through the same gated `act()` every
other run uses, write the note back. No daemon, no timer, no long-lived
process; a multi-day human wait is just a note sitting at `status: waiting`.

Rationale: an earlier framing considered building a workflow *execution
engine* (durable, concurrent, exactly-once) — that's Temporal's decade-hard
problem, and every adversarial scenario in the break book (a 3-day human
step, a crash mid-run, a retried side effect) attacked exactly that claim.
The inversion that survived: zuzuu is a **control plane** — it owns the
definition, the governance (gate, generations, provenance), and the state
(runs-as-notes); execution stays a short-lived, stateless worker advancing
durable state that already exists (notes + git). Durability comes from the
substrate, not from process supervision — honestly **at-least-once**, never
"exactly-once," with `idempotency_key`s so a downstream system can dedupe if
it wants to.

Status: **shipped** — `zz run start/advance/signal/complete`, generation
pinning (an in-flight run never floats to an edited workflow definition),
retry + saga compensation (stopping honestly at an `irreversible: true`
step). See `docs/specs/2026-07-02-polish-showcase-experience.md`
§I.3/§I.4 and [[Workflows]].

## 03-07-2026 — Triggers as notes: naming an automation adds no new authority

A `type: trigger` note NAMES an automation — `on: {kind, …}` + `run:
<workflow>` + `enabled: bool` — and firing one is exactly `zz run start`
under a name. It is explicitly **not** a scheduler: no unattended cron
auto-fire, no ingress webhooks, no note-change auto-firing locally. A
trigger can be reviewed-in (staged, approved) and still stay inert until a
human runs `zz trigger enable` — the second gate.

Rationale: the safety-floor-first sequencing (§I's gap ladder) put triggers
behind the run safety floor deliberately — an unattended automation with no
timeout, no fail-closed gate, and no blast-radius preview would be an
incident waiting to happen, not a feature. `trigger show`/`fire --dry-run`
compute the CURRENT matches of a `note-change` filter before anything fires
(Apollo's "current matches: N" pattern) — the safety affordance that makes
"automation as data" trustworthy rather than just convenient. A laptop must
not fire triggers unattended; that boundary is honest, not a stopgap.

Status: **shipped, manual-fire only** — `zz trigger list/show/fire/enable/
disable`, the blast-radius preview, the exec-gate that denies an agent
actor. Cron auto-fire and ingress webhooks are hosted-tier, deferred. See
`docs/specs/2026-07-02-polish-showcase-experience.md` §I rung 4 and
[[Workflows]].

## 03-07-2026 — Flow: the third projection, read-only on purpose

`[Table · Map · Flow]` — a `type: workflow` note's `steps:` render as a
topological left→right DAG (dependency order is meaning; never force
physics), with its runs (`type: run` notes) overlaid live via the same
brain-state push the map's ghost nodes already use.

Rationale: "a process is a note" only pays off if the DAG is visible — this
is the moat rendered for process the way the World renders it for data. Read-
only this pass was a deliberate scope cut: no run-control buttons (advance/
signal/complete stay `zz run …`), no canvas editing (a workflow's steps
change through the omnibar/gate, never by dragging a node) — the same
doctrine that keeps the note detail view read-only (§H.1) applied to process.

Status: **shipped, read-only** — the DAG, the run overlay, live updates.
Trigger blast-radius preview inside Flow, ghost edges for a staged workflow
edit, and a Gantt latency timeline are deferred. See
`docs/specs/2026-07-02-polish-showcase-experience.md` §I rung 5 and
[[Flow View|Flow-View]].
