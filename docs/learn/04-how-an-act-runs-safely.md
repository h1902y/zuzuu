# 04 · How an act runs safely

> Lesson `02` showed a runnable note — an action, with `run` / `inputs` / `policy`. This page is about the scariest word in the project: **run**. Letting an agent execute commands is where things go wrong, so zuzuu is deliberately, honestly careful about it.

The code is `src/use/act.mjs` (the runner) and `src/guardrails/gate.mjs` (the guardrails gate).

## Two execution surfaces, one containment idea

There are two different ways commands run, and it's worth keeping them straight:

1. **A stored action** — `zz act build-report`. A *curated, reusable* note the agent invokes. Each carries its own `policy`. This is `act.mjs`.
2. **The agent's ad-hoc shell** — the raw commands the agent runs mid-session. Those pass through the **guardrails gate** (a hook on every tool call).

Both lean on the same principle: **a regex gate is not containment.** A pattern-matcher can be evaded (base64, `eval`, write-then-run). So zuzuu never pretends a regex check is a security boundary. It uses tiers, and it's honest about which tier you're in.

## The three tiers

A note's `policy.tier` says how contained the run is:

- **`advisory`** — runs directly; the guardrails gate is the only check. Honest framing: *not contained.* For trusted, local work.
- **`contained`** — kernel-enforced: filesystem and network restricted by the OS sandbox (Anthropic's `sandbox-runtime` — Seatbelt on macOS, bubblewrap+Landlock on Linux). This is real containment.
- **`sandboxed`** — a microVM, for untrusted code. Not built yet; reserved.

The key honesty rule, visible in the code: `act` reports `contained: true|false` truthfully. If a note asks for `contained` but the sandbox backend isn't installed, it does **not** silently run uncontained pretending otherwise — it runs and flags `contained: false`. You always know the real tier.

> The sandbox is an *optional accelerator* — detect it, use it if present. The CLI core stays zero-dependency; containment is opt-in infrastructure. (We borrow the proven stack — Codex, Claude Code, and Cursor all converged on it — rather than invent one.)

## The `policy` block

```yaml
policy:
  tier: contained
  filesystem: { allowWrite: ["./reports/"], denyRead: ["~/.ssh", "./.zuzuu/"] }
  network:    { allowedDomains: [] }
  run:        { allow: [pandoc, git] }
```

Two layers enforce different rows:

| Field | Enforced by | How |
|---|---|---|
| `filesystem`, `network` | the **OS sandbox** (srt) | kernel-level — can't be evaded |
| `run.allow` (the command toolkit) | **zuzuu**, in `act.mjs` | the novel layer — "this action may only run these binaries" |

That last row — **the command-axis** — is the one piece with no prior art (no other agent tool does command-level allowlisting). `act` checks the command's binary against `run.allow` *before* executing, and refuses if it's not listed. Try to make a `pandoc`-only action run `curl` and it's denied, no execution. Note the carve-out: `./.zuzuu/` is `denyRead` — an action can't read the brain it's part of (the self-modification defense, copied from how Codex protects `.git`).

One safety invariant: a note's own `policy` can only **narrow** the module's default policy, never widen it. The module sets the ceiling; a runnable note can tighten it.

## What `act` actually does — one call, three jobs

```bash
zz act build-report --in client=acme
```

`act.mjs` does the whole thing in one call (the AXI "combine operations" idea):

1. **Run** — execute the note's `run` (with inputs passed as `ZZ_*` env vars), under the tier's containment.
2. **Capture** — the normalized result every agent tool agrees on: `{ stdout, stderr, exitCode, success }`. (Standardizing this shape *now* is what lets the real sandbox backend drop in later without changing callers.)
3. **Log** — append a `run` event to the module's `runs.jsonl`. The note itself doesn't record the outcome (it stays pure definition); the module's log does.

That third step is the quiet link to the rest of the system: every run is recorded, so `enhance` can later mine *what actually ran and worked* — not just what was discussed.

## The gate — enforced, fail-open

`gate.mjs` is the guardrails capability. Its rules are just notes (`type: rule`) in the guardrails module — each with `action` (deny/ask/allow), `tool`, a `pattern`, and a `reason`. On every tool call, the gate matches the call against them; **severity wins** (deny beats ask beats allow); no match defers to the host's normal flow.

The non-negotiable property is **fail-open**: a malformed rule is skipped (the others still apply), and an engine error emits *no* decision rather than a wrong block. A guardrail bug must never break your agent — at worst it stops protecting, it never starts blocking by accident.

And a real bug this caught: the gate matches over `JSON.stringify(input)`, so the bare `rm -rf /` is followed by a `"`, not whitespace — a naive `/(\s|$)` anchor *misses it*. The seed rule uses a negative-lookahead anchor (`/(?![\w/])`) that catches the bare root whether raw, JSON-wrapped, or chained, while still allowing `rm -rf /tmp/x`. (Found, fittingly, by dogfooding — see `docs/LOG.md`.)

---

**Next:** `05` · How the system grows — the session, the objective stack, episodes, and the human-gated enhance loop. *(Written when the loop ships.)*
