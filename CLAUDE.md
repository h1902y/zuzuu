# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

**A working early-stage build + its canonical design.** The host coding-agent (Claude Code / Codex / Gemini CLI / OpenCode / pi) supplies the **brain**; this project gives it evolving **modules** — Knowledge (semantic), Memory (episodic), Actions (procedural), Instructions (directive), Guardrails (protective, enforced) — that **graduate** across versioned generations, grown from the observability **trace** of real use, human-gated. We **wrap, serve, observe, evolve** a host we never drive. (Terminology: these five were called **faculties** until the `faculty → module` rename — code, CLI, README, and DESIGN now say **module**; `faculty` survives only as *intentional history* — the `commands/migrations/` shims, DESIGN.md's terminology notes, and LOG.md's append-only journal entries — not as drift to fix.)

**The v2 rebuild is now the product (rungs 1–8 shipped on `rebuild/kernel`, 2026-06-21).** The filesystem-native **zu / module / project** model the redesign specs described is built and the v1 substrate is **deleted** — ~13k → ~3.8k lines. One coherent stack: `zuzuu/{kernel,capabilities,pipelines,hosts,cli,sessions}` + `api.mjs`. **Everything is an envelope** (markdown + frontmatter, distinguished by `type`): a *zu* (one fact, optionally runnable) and a *module* manifest are the same shape. The five capability **verbs** — `query · act · enhance · review · check` — are CLI verbs over envelopes, dispatched through one registry. The loop is **observe → enhance → propose → review → write + snapshot**, every write **human-gated** (the gate is the moat). Built + verified: the kernel (the envelope parser, the `node:sqlite` graph index, the capability registry, content-addressed generations/checkpoints), the loop (propose/review/enhance), **observe** (host-agnostic transcript mining → routed proposals, Design B — re-parse, never drive), the **CLI veneer** (`bin/zuzuu.mjs` → `cli/` → `api`), session management (session = git branch; worktrees, manifest, restore — the safety-critical `sessions/` engine, characterization-tested), the live **hook** (lifecycle + the enforced `PreToolUse` gate), and host **enablement**. The published binary runs the whole loop end to end. Check `docs/LOG.md` for the build journal and `docs/learn/` for the educative walk (lessons 02–08 cover the rebuild).

**Dropped, not ported:** the v1 OTLP/trace observability layer — v2's observe mines transcripts directly into proposals, so traces were never needed. **Still design-only / not built:** the *async* evolution service (Cloudflare Workflows); the cloud session waves (E container-per-worktree, F Fly local↔cloud sync, G portable/L7, H sharing) are infra-gated. Don't claim unbuilt parts work; don't treat shipped parts as absent — `docs/LOG.md` is the source of truth.

Naming: the project is **zuzuu** (current name; a return to the original concept) — was **motorsandsensors / mns** in the v0 phase (no `mns` alias remains — all backward-compat was removed). The **command is `zz`** (and `zuzuu`); the npm package is **`@zuzuucodes/cli`** (unscoped `zuzuu` is blocked by npm as too-similar to `zuul`; the `@zuzuucodes` org holds it). Repo: `~/Documents/zuzuu` → `github.com/h1902y/zuzuu`. Releases auto-publish from `main` via OIDC trusted publishing (`.github/workflows/publish.yml`, version-bump-driven).

## Commands

```bash
npm test                                   # full hermetic suite (node:test, zero deps)
node --test tests/unit/kernel-item.test.mjs   # a single test file
node tests/playground/run.mjs 5            # the observe playground (mines real transcripts; skips if none)
node bin/zuzuu.mjs <cmd>                   # the CLI (or `zz`/`zuzuu` after npm link)
#   the five verbs:  query · act · enhance · review [approve|reject] · check
#   lifecycle:       init · enable|disable · digest · observe · migrate
#                    session [status|merge|continue|discard|worktree …|manifest|restore|label]
#                    module [list | <m> generations | <m> rollback <n>]
#                    doctor · status · explain · code · web · hook <Event>
```

No build step, **zero runtime dependencies** for the CLI core (a deliberate policy — `node:test`, `node:sqlite`, hand-rolled OTLP); the bundled workbench's deps ride as `optionalDependencies` (never imported by CLI code). Node ≥ 22 (OpenCode adapter needs `node:sqlite`; tests need ≥ 21's glob).

The **workbench** lives at `web/` — a self-contained nested project (own package.json/lockfile, vitest, React/Vite/Hono): `cd web && npm ci && npm test` (174 daemon + 417 web-ui vitest) · `npm run dev` (daemon :7770 + Vite :5173) · root `npm run build:web` stages it into `web-app/` for publishing. Its conventions live in `web/CLAUDE.md` (the daemon package is `@zuzuucodes/web`).

## Architecture (the big picture)

The stack is one inward-only import chain: **`kernel ← capabilities ← pipelines ← hosts/cli ← sessions`** + `api.mjs`. The kernel is the only code that touches `.zuzuu/`; everything else asks `api`/`store` for a path. (Lessons `docs/learn/02–08` walk it file by file.)

**`kernel/` — the one envelope + its substrate.** `item.mjs` is the tolerant generic parser/serializer (markdown body + frontmatter; only `type` required, unknown keys preserved round-trip-exact; `id` = the filename stem, injected by the caller, never in frontmatter). `store.mjs` resolves the git-citizen home (`git --show-toplevel` + `/.zuzuu` — never `git init`s) and any `module:id` address. `index.mjs` is a lazy `node:sqlite` cache (zus + KV props + a typed link graph + FTS5), rebuilt on mtime-staleness — the keystone bet, benchmarked at 5000 zus build 157ms / search 13ms. `module.mjs` reads `module.md` manifests; `capability.mjs` is the ONE registry (`register`/`invoke`, manifest-gated, **fail-soft**). `log.mjs` = append-only events (mutations tracked, runs local). `snapshot.mjs` = content-addressed per-module **generations** + whole-brain **checkpoints** (rollback = pointer-flip + restore, never `git revert`). `session.mjs` = the lifecycle state machine + the tracked `sessions.json` index.

**`capabilities/` — the five verbs, no per-module code.** `query.mjs` (FTS + graph walk, TOON output), `act.mjs` (run a runnable zu under its policy tier + the `run.allow` command-axis; capture `{stdout,stderr,exit,success}` + log), `gate.mjs` (the enforced guardrails check — rules are `type: rule` zus, severity deny>ask>allow, **fail-open**), `check.mjs` (integrity: broken links · orphans · stale). The **loop**: `enhance.mjs` (mine the run log — co-invocation past a corroboration threshold), `propose.mjs` (the typed, deduped, ranked proposal queue), `review.mjs` (**THE human gate** — approve = CRUD + log + mint a generation; the only door to the brain). `index.mjs` wires every verb into the registry (`review` is interactive, deliberately unregistered).

**`hosts/` — observe (Design B) + the lifecycle hook.** `adapters/claude-code.mjs` re-parses a real transcript → deterministic mining signals (commands·files·failures·sequences·corrections·destructive); `registry.mjs`/`capture.mjs` are the host-blind core (iterate `detected()`, never a host name — adding a host = one adapter file + one registry line). `hook.mjs` maps every host's lifecycle → open/turn/end (OPEN grounds + opens the session branch; TURN checkpoints; END squash-merges + **observes**) and routes `PreToolUse` → the gate; fail-open, always exits 0.

**`pipelines/` — observe + digest.** `observe.mjs` aggregates signals across sessions with the corroboration threshold and **routes** each candidate to the right module (a recurring command → a runnable `action` zu; a hot file → a `knowledge` entity) through `propose`. `digest.mjs` = the deterministic session-start brief.

**`sessions/` — session = git branch (the most safety-critical area, characterization-first).** `session-git.mjs` (one session = one `zz/session-*` branch, turn-checkpoints with secret exclusion, squash-merge on end, single-working-branch invariant; fail-soft, never throws), `session-worktree.mjs` (a worktree per session → concurrency), `session-manifest.mjs` (a portable, content-addressed session definition + `restore`), `labels.mjs`. Now kernel-backed (re-pointed off the deleted v1 core).

**`cli/` — the thin veneer.** A flat router (`index.mjs`) where every verb is a one-liner onto `api`; `init.mjs` (git-citizen scaffold), `session.mjs`, `enable.mjs` (install the hook block by a stable `#zz-hook` signature, never clobbering user hooks), `doctor.mjs` (health · status · explain), `code.mjs` (launch OpenCode as the bundled host — runtime peer, installed on demand, never forked), `web.mjs` (the workbench), `migrate.mjs` (v1 home → v2). AXI throughout: TOON output, brief-by-default, no blocking prompts (review is explicit subcommands).

**The method:** product code lives in `zuzuu/` (+ `web/`), full stop. The rebuild was **greenfield-kernel, cull-per-rung** — build v2 beside v1, keep the suite green at every commit, delete each v1 surface only after its v2 replacement proved out (rungs 1–8, `docs/LOG.md`). **Live experimentation happens OUTSIDE the repo** — `~/Documents/cards-game` is the dogfood target where zuzuu is exercised against real Claude Code sessions (init/enable/observe/the gate); findings that matter graduate into `docs/LOG.md` (the build journal, append-only). In-repo: `tests/playground/` = smoke vs real machine data (playground-5 mines real transcripts); `tests/unit/` = hermetic.

## Hard-won conventions (violating these has bitten us)

- **Real-wire-data rule:** adapters/integrations are built and verified against output the host *actually produced* — never from docs alone, never against self-invented fixtures (that's circular). Observe real events **before** wiring lifecycle semantics (docs lied twice: Claude `Stop` and OpenCode `session.idle` are per-*turn*, not end; OpenCode `session.deleted` is delete-only).
- **Golden ids in regression tests are pasted from a real run** — never hand-computed. If the id scheme changes intentionally, regenerate and review.
- **Verify fixes with `node bin/zuzuu.mjs`, never the PATH `zuzuu`** — the global is the *published* version and silently lacks unpushed code (a live bug-fix verification ran the old binary once and the bug "survived" its own fix).
- **Playground exit contract:** 0 = pass, **2 = skip** (host data absent — not a failure), anything else = fail. Don't "fix" skips to passes.
- **Hooks/plugins must never break the host:** always exit 0 (`… || true` wrappers, try-wrapped plugin), spawn detached, degrade silently. The guardrails **gate fails open** — engine/rule errors emit no decision (host's normal flow), never a block.
- **Home deny rules are narrow** (`.zuzuu/.live/**` only, since the trace layer was dropped) — a blanket `.zuzuu/**` deny starves the agent of its own modules (which it's meant to read).
- **Secrets:** keys never land in tracked files; scan before commit/push. Generated host-enablement config (`.opencode/`, `.claude/settings*.json`) is git-ignored.

## Load-bearing vocabulary (these terms carry decisions)

- **Modules — the 5+3 anatomy** (the five, since 2026-06-10; renamed faculty→module later): **five us-owned modules** — Knowledge (semantic), Memory (episodic), Actions (procedural), **Instructions** (directive: the pinned steering/system-prompt artifact), Guardrails (protective: *enforced* tool gates) — each us-owned, trace-grown, generation-pinned, served. **Cognition / Model / Workspace are host *anatomy*, not modules** (process / engine / arena; observed and steered, never graduated).
- **be / run / evolve**: what the agent *is* / what *serves & bounds* it / what *grows* it.
- **Pin definitions, observe data**: immutable things are *definitions* (prompt, tool version, schema); everything else is runtime captured in traces.
- **Agent → Generation → Run**: durable identity → immutable pinned lockfile (rollback = flip pointer) → transient episode emitting a trace. Generations are now **per-module**; a **checkpoint** composes all five active generations into one whole-brain pin (the unit you mint/roll back to move the entire brain).
- **Proposal**: the bridge from observability to a new generation — **always human-approved in v1**.
- **Design B**: live-capture hooks signal + trigger re-capture through the proven parse path; they never build spans.

## Docs canon

- **The doc set:** `README.md` = front door (what works, quickstart) · `docs/learn/` = the **in-repo educative book** (read in order: motivation → mental model → a code tour that fills in as each rung ships; mirrored to the GitHub wiki, which is now a *rendered* surface, not a hand-edited source) · `docs/DESIGN.md` = **canonical design** incl. the §13 roadmap (older docs citing "README §N" mean DESIGN.md) · `docs/LOG.md` = the **build journal** (append-only — append corrections, don't rewrite history) · the **GitHub wiki** documents **only shipped + verified behavior**, never design intentions. Module knowledge lives in code comments + `docs/learn/`, not scattered READMEs.
- `docs/specs/` holds **live specs** — designs for work not yet shipped. It currently holds the **redesign direction** (`thesis-and-risks` · `cli-revamp` · `from-scratch-blueprint` · `enhance-and-sessions`): the filesystem-native **zu / module / project** model (a *zu* = one markdown+frontmatter file, knowledge that can also run) and the conversation-driven, human-gated **enhance** loop, with a borrow-the-thesis approach (OKF, Anthropic sandbox-runtime, git's object model). **This is design-stage — NOT built**; don't describe it as working. The *built* product is the 5-module observe/serve/evolve layer (above). When a workstream ships: record the outcome in LOG.md, then delete its spec — git history is the archive.
- `docs/inspiration/` = the **research shelf**: prior-art audit records (with intentionally-dead links to pre-consolidation filenames — do **not** recreate those files) + the redesign's `git-from-scratch` deep-dive and `research/` syntheses (background reasoning, not canon). Preserve every verified-vs-directional honesty split.
- Older docs say "zuzu/zuzuagents" — expected, not an error. Dates are absolute (`2026-06-09`).
- The personal federation layer (`STATUS.md`, work `tasks/`) lives in **`.personal/` — git-ignored, local-only** (it's planning, not product). The personal vault reads `.personal/STATUS.md`. Social artifacts (`SOCIAL.md`, `engagement/`) moved to the personal vault on 2026-06-12 (de-federation). Note: pre-split copies exist in public git history.

## Key fixed decisions (don't relitigate without cause)

- Evolution engine runtime = **Cloudflare Workflows only** (async evolution loop, never the hot agent loop) · org topology = **strict 1:N tree + mirror aliases** · **interactive-mode-first, never headless** · host integration = **observe model** (entire.io shape), not a driving bridge · Knowledge/Memory substrate = off-edge Postgres/Neon (graph/vector are earned top rungs) · **transcript-parsing is the capture foundation**; hooks are enhancement · product sequence (decided 2026-06-10) = **three stages**: ① host-agnostic wrapper (Claude/Gemini/Codex — building now) → ② OpenCode as **default bundled host** (`zuzuu code` distribution; zuzuu-as-plugin is built) → ③ owned harness on **pi** for granular context/model control, gated on the efficiency benchmark — never an OpenCode fork, never scratch (DESIGN §6; credits model stays a flagged, undecided hypothesis).
- Product experience (decided 2026-06-12, DESIGN §13): the home is **hidden `.zuzuu/`** (reversed the visible-`agent/` decision with cause — clash risk + brownfield clutter; transparency = porcelain: `zz status`/`explain`/`digest` + plain-text files + the human gate, the `.git` model) · six workstreams in dependency order (home/onboarding → workbench → module-health UX → marketplace templates → tasks module → benchmark) · the workbench middle pane = **embedded terminal** (xterm.js running the real host CLI), never a custom chat loop · **zuzuu-web evolves into the workbench** (one web surface) · workbench packaging = **ONE package, ONE repo** (the workbench lives at `web/` — a self-contained nested project, NOT a root workspace — and ships inside `@zuzuucodes/cli` as `web-app/`, staged by `scripts/build-web.mjs` at publish; its runtime deps are the CLI's `optionalDependencies`; `dependencies` stays empty — the zero-dep guarantee is about the CLI core, not the install footprint; there is no `@zuzuucodes/web` package) · positioning = AI-first directory for *any* folder-based work, coding is the first vertical · philosophy = **enhance, never reinvent**.

## Social

**Social is managed from the personal vault** (`~/Documents/personal` — de-federated 2026-06-12; this repo no longer owns the X channel's strategy or state). The vault's social handler reads this repo **read-only** as a content source for build-in-public posts: `README.md`, `docs/LOG.md`, `docs/DESIGN.md`, and the git log — **keep those current; they're what gets posted about.** Build-log discipline still applies: only what actually shipped, verified. Don't do social work (drafting, posting, engagement) from this repo.

## Tasks

This project owns its **work** activities in [`.personal/tasks/`](.personal/tasks/) — multi-day work units as `type: activity` markdown notes (checkboxes for steps, `relations: depends-on` for dependencies). Current: `ai-agent-harness`, `zuzuu-landing-page`. (The social activity `twitter-profile-growth` was repatriated to `~/Documents/personal/tasks/` on 2026-06-12.)

- Activity templates live at `~/Documents/personal/tasks/.schema/templates/` (canonical) — mirror that shape when creating a new task here.
- When task state changes materially, reflect the headline in [`.personal/STATUS.md`](.personal/STATUS.md) (slim, work-only: Focus now / Shipped recently / Blockers / Next up) so the personal vault's dashboard stays current — that's the only cross-repo obligation.
- Some tasks carry `[[wikilinks]]` to notes that live in the personal vault; those are cross-repo and won't resolve in Obsidian — leave them as references.
