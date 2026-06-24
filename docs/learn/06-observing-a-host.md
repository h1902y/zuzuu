# 06 · Observing a host

> Lesson `05` showed the loop but left its producer — *observe* — unexplained. Where do the proposals come from? They come from **watching the host work** — re-reading the transcript the agent already wrote, and turning what recurred into proposals. This is what solves the cold-start: the loop has nothing to propose until it has watched real sessions.

The code is `hosts/adapters/claude-code.mjs` (read one host), `hosts/capture.mjs` (host-agnostic core), and `grow/observe.mjs` (signals → proposals).

## Design B: we never drive the host

zuzuu does not wrap, intercept, or steer the coding agent. The host (Claude Code, OpenCode, …) runs normally and writes its own session log. We **re-parse that log after the fact**. Hooks, where present, are only lifecycle *signals* ("a session ended, re-read it") — they never build the data. This is the load-bearing decision: it's why zuzuu is host-agnostic, why it can't corrupt a session, and why adding a host is one file.

> **The real-wire-data rule.** An adapter is built against output the host *actually produced* — never from docs, never from invented fixtures (that's circular). `claude-code.mjs` was written against real transcripts in `~/.claude/projects/`, and the playground (`playground-5`) mines those same real sessions on every run. The docs have lied before (Claude's `Stop` is per-*turn*, not session-end) — only the wire tells the truth.

## The adapter: a transcript → signals

`claude-code.mjs` reads one `.jsonl` transcript and extracts **deterministic mining signals** — zero-LLM, the cheap unambiguous ones:

- **commands** — normalized `Bash` commands, each tagged pass/fail (the transcript pairs every `tool_use` id to its `tool_result.is_error`).
- **files** — paths touched by Read/Write/Edit.
- **failures** — which tools errored.
- **sequences** — adjacent command 2-grams (a procedure shape).
- **correctionTurns** — a user turn *after* a tool action that reads like a correction ("no, don't…", "always…") — the richest signal, because it's failure-derived.
- **destructiveFailures** — a failed `rm -rf`, `--force` push, etc.

It is tolerant by construction: a malformed line is skipped, a missing file returns empty — observing must never break, and there's nothing to break anyway (it's a read).

`capture.mjs` is the **host-blind** core: it iterates the *detected* adapters (`registry.detected()`), never a host name, and a flaky host degrades to skipped. Adding OpenCode = an adapter file + one line in the registry; this core does not change.

## observe: signals → proposals, routed to the right module

`grow/observe.mjs` is where watching becomes growth. Two steps:

**1. aggregate, with a corroboration threshold.** A signal from one session is a coincidence; a signal corroborated across *several* sessions is a pattern (the Generative-Agents lesson again). So a command must recur **≥3× across ≥2 sessions** before it's a candidate; a file must be touched **≥5×**. One sighting proposes nothing.

**2. route each candidate to the module it belongs in.** This is the payoff of the generic module model — a candidate isn't "a memory," it's typed and addressed:

| signal | becomes | in module |
|---|---|---|
| a recurring command | a **runnable action** note (`type: action`, `run: <cmd>`) | `actions` |
| a hot file | a project **entity** (`type: knowledge`) | `knowledge` |
| a frequently-failing tool | a **fact** worth knowing | `knowledge` |

Then every candidate goes through the exact same door as everything else: `createProposal` (lesson `05`). Observe **never writes the Project** — it stages evidence-backed, deduped proposals into the review queue. A second observe of the same sessions proposes nothing new (idempotent).

So the full loop from lesson `05` now has its source:

```
host writes a session   →  adapter mines signals  →  aggregate (corroborated)
   →  route → propose   →  review (you)  →  write + snapshot
```

The agent worked; zuzuu watched; what recurred is now a suggestion waiting for your yes. That's the compounding engine, fed.

---

**Next:** `07` · The CLI veneer — how `zz <verb>` becomes a thin router over the one `api`, and how `zz init` scaffolds the Project into any repo.
