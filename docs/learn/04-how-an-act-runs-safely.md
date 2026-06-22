# 04 · How an act runs safely

> Lesson `02` showed a runnable note — an action, with `run` / `inputs` / `policy`. This page is about the scariest word in the project: **run**. Letting an agent execute commands is where things go wrong, so zuzuu is deliberately, honestly careful about it.

The code is `src/use/act.mjs` (the runner) and `src/guardrails/gate.mjs` (the guardrails gate).

## Two execution surfaces, one honest idea

There are two different ways commands run, and it's worth keeping them straight:

1. **A stored action** — `zz act build-report`. A *curated, reusable* note the agent invokes. Each carries its own `policy`. This is `act.mjs`.
2. **The agent's ad-hoc shell** — the raw commands the agent runs mid-session. Those pass through the **guardrails gate** (a hook on every tool call).

Both lean on the same principle: **a regex gate is not containment.** A pattern-matcher can be evaded (base64, `eval`, write-then-run). So zuzuu never pretends a check is a security boundary — it's honest about exactly what protects a run, and what doesn't.

## What actually guards a run

Every `act` run passes **two checks**, and zuzuu is explicit that neither is an OS sandbox:

1. **The guardrails gate** — before anything executes, the command is evaluated by the same `PreToolUse` gate that guards the agent's own shell; a `deny` rule blocks it. So a poisoned action note can't `rm -rf /`.
2. **The `run.allow` allowlist** (the command-axis, below) — the command's binary must be on the note's allowlist, or be a repo-local script.

That's the whole boundary. There is **no OS sandbox**. An earlier design reserved `contained` (Anthropic's `sandbox-runtime` — Seatbelt / bubblewrap+Landlock) and `sandboxed` (microVM) tiers, but srt was never wired, so the stub was **removed (2026-06-22)** rather than ship a `contained` flag that didn't contain. Honest framing: **an `act` run is gated + allowlisted, not isolated** — trust it the way you'd trust running the command yourself.

> Why cut it instead of keeping the seam? A flag that reports `contained` while running uncontained is worse than no flag — it invites false trust. Real containment can return as opt-in infrastructure (the proven Seatbelt/bubblewrap stack Codex, Claude Code, and Cursor converged on) the day it's actually wired; until then the code says only what's true.

## The `policy` block — the command-axis

```yaml
policy:
  run: { allow: [pandoc, git] }
```

`run.allow` is the one piece with no prior art (no other agent tool does command-level allowlisting). `act` checks the command's binary against `run.allow` *before* executing, and refuses if it's not listed — try to make a `pandoc`-only action run `curl` and it's denied, no execution. A repo-local script (`./x`, or an absolute path under the repo root) is allowed; an absolute path *outside* the repo is not.

One safety invariant: a note's own `policy` can only **narrow** the module's default, never widen it. The module sets the ceiling; a runnable note can tighten it.

## What `act` actually does — one call, three jobs

```bash
zz act build-report --in client=acme
```

`act.mjs` does the whole thing in one call (the AXI "combine operations" idea):

1. **Run** — execute the note's `run` (with inputs passed as `ZZ_*` env vars), after the gate + allowlist clear it.
2. **Capture** — the normalized result every agent tool agrees on: `{ stdout, stderr, exitCode, success }`.
3. **Log** — append a `run` event to the module's `runs.jsonl`. The note itself doesn't record the outcome (it stays pure definition); the module's log does.

That third step is the quiet link to the rest of the system: every run is recorded, so `enhance` can later mine *what actually ran and worked* — not just what was discussed.

## The gate — enforced, fail-open

`gate.mjs` is the guardrails capability. Its rules are just notes (`type: rule`) in the guardrails module — each with `action` (deny/ask/allow), `tool`, a `pattern`, and a `reason`. On every tool call, the gate matches the call against them; **severity wins** (deny beats ask beats allow); no match defers to the host's normal flow.

The non-negotiable property is **fail-open**: a malformed rule is skipped (the others still apply), and an engine error emits *no* decision rather than a wrong block. A guardrail bug must never break your agent — at worst it stops protecting, it never starts blocking by accident.

And a real lesson in why a regex gate is *best-effort*: matching matters more than it looks. The gate matches each pattern over the **raw string values** of the tool input (the actual command), *not* `JSON.stringify(input)` — because JSON-escaping turns a real tab/newline into `\t`/`\n`, so `\s` stops matching and `rm⇥-rf⇥/` would slip past a deny rule (a bypass a multi-agent review caught; see `docs/LOG.md`). The seed root-wipe rule requires a whitespace-delimited, optionally-quoted bare `/` after `rm` + any flags, so it catches `rm -rf /`, `rm --recursive --force /`, `rm -rf "/"`, and chained/tab variants — while still allowing `rm -rf /tmp/x` and `rm dir/`. Two hardening rules ride along: tool names are canonicalized across hosts (a `tool: Bash` rule fires on every host's shell tool, not just Claude's), and patterns with a catastrophic-backtracking shape are rejected at compile so a rule can't ReDoS-hang the synchronous gate.

---

**Next:** `05` · How the system grows — the session, the objective stack, episodes, and the human-gated enhance loop. *(Written when the loop ships.)*
