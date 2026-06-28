# Roadmap

The core was rebuilt greenfield in 2026-06 — the **envelope/note model**, the **four verbs**, the human-gated **loop**, and a concept-filed `src/` (~3.6k lines, zero-dep). What's shipped + verified is documented here; the *why* and the longer arc live in [docs/DESIGN.md](https://github.com/h1902y/zuzuu/blob/main/docs/DESIGN.md) and the build journal [docs/LOG.md](https://github.com/h1902y/zuzuu/blob/main/docs/LOG.md). Live tracking: [issues](https://github.com/h1902y/zuzuu/issues) · [milestones](https://github.com/h1902y/zuzuu/milestones).

## Shipped (verified)
- **The envelope** — one md+frontmatter format; note › module › project; zero-dep parse/serialize.
- **The four verbs** — `query` (FTS + graph over a `node:sqlite` index) · `act` (run a note, gated, with a `run.allow` allowlist) · `check` (integrity) · `review` (the human gate). The producer is `observe` (mine real sessions → proposals).
- **observe (Design B)** — re-parse the transcript, never drive the host; mine recurring commands/files/failures → routed proposals. Adapters for **5 hosts** (Claude Code · Codex · Gemini CLI · OpenCode · pi).
- **The human gate** — every write to the brain through `zz review`; content-addressed per-module generations, rollback = pointer flip.
- **Guardrails** — the enforced `PreToolUse` gate (rules are notes; fail-open; raw-command matching; ReDoS-guarded).
- **Session management** — session = git branch (the branch *is* the record); per-session worktrees (concurrency); **END holds for the merge gate** (`zz session land`; `autoMerge` opt-in to land on exit); navigable recording markers.
- **The CLI + workbench** — a **two-tier `zz`** veneer over one `api` (flat hot-loop verbs · `note`/`gen`/`session`/`host`/`registry` namespaces; every old verb still aliased); **schema-enforced module tables** (a `module.md` `fields` block validates each note at the gate); the visual workbench (`zz host web`).

## Next
- **Host hook/gate parity** — the lifecycle hook + enforced gate are wired for **Claude Code**; re-wire the per-host enable for Codex (`.codex/hooks.json`), Gemini (`.gemini/settings.json`), OpenCode (plugin), pi (extension). observe already covers all five.
- **Real containment for `act`** — bundle a sandbox (e.g. Anthropic's sandbox-runtime — Seatbelt / bubblewrap) so runs can be OS-isolated, not just gated + allowlisted. (The earlier `contained`/`sandboxed` tier stubs were removed; this would reintroduce containment as a real, opt-in backend.)
- **Conversation mining** — the LLM-judge seam in `observe`: extract durable facts + "avoid X" lessons from the session conversation, not just the command log.
- **Richer Gemini observe** — recover tool spans from Gemini's checkpoint files (it's the one thin host today).
- **Cloud session tier** — container-per-worktree + local↔cloud sync (infra-gated).
- **pi owned harness** — the stage-3 target: granular context/model control, gated on the efficiency benchmark.

## The spine
The product is the loop: **observe → propose → review → write + snapshot** — human-gated, compounding. Everything above is in service of making that loop cheaper to run and richer to feed.
