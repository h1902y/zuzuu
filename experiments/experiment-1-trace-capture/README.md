# Experiment 1 — host-agnostic trace capture

> The README calls the **trace** the keystone — "the typed, append-only, tree-shaped record of every run… **build it first**." This experiment builds the minimal version of it, and does so **host-agnostically** (not Claude-Code-first).

## Hypothesis

We can capture a coding-agent session as a **tree-shaped OpenTelemetry trace** by **parsing the host's session transcript off disk** — a mechanism that:

- needs **zero cooperation** from the host (no hooks, no running process, no SDK in the host), and
- runs through **one host-agnostic core** that knows nothing about any specific host, fed by small per-host **adapters**.

If true, "host-agnostic" is a property of the architecture, provable by pointing ≥2 different hosts' logs at the same core and getting valid traces out of both.

## Why transcript parsing (not hooks)

Hooks are host-specific and uneven — Claude Code's are rich, most others are thin or absent. But **every** host writes a session log to disk. Parsing that log is the most host-agnostic capture surface there is (it's the entire.io adapter shape: `resolveTranscript` + `parseTranscript`). It also hands us **stable per-tool-call ids** for free (`tool_use.id` ↔ `tool_result.tool_use_id`), which dissolves the Pre/Post correlation problem that the hook approach can't solve cleanly (Claude Code hook payloads carry no per-call id — verified). Live hooks remain a *future* enhancement, not the foundation.

## Success criteria

- [x] A host-agnostic **core** (`core/`) maps a normalized `Event[]` → OTel spans → OTLP/JSON, with **no host conditionals**.
- [x] A documented **HostAdapter contract** (`adapters/host-adapter.mjs`).
- [x] **≥2 adapters** producing valid traces from **real on-disk data** → agnosticity *demonstrated*, not asserted.
- [x] Output is **OTLP/JSON** (`ExportTraceServiceRequest` per line) — structurally validated, replayable into any OTel backend later.

## Architecture

```
adapters/<host>.mjs   native log ──▶  Event[]        (host-specific; the only place host knowledge lives)
core/event.mjs        the normalized Event vocabulary (session / turn / tool_call; tree via refId/parentRefId)
core/ids.mjs          deterministic W3C trace_id / span_id  (re-capture is idempotent)
core/spans.mjs        Event[] ──▶ OTel spans            (pure id-wiring; host-agnostic)
core/otlp.mjs         spans ──▶ OTLP/JSON NDJSON
bin/capture.mjs       pick host → parse → write out/<host>-<session>.otlp.jsonl
bin/inspect-trace.mjs pretty-print the span tree
```

The core never branches on host name; the dispatcher routes by detection/capability. Adding a host = adding one adapter file to `adapters/registry.mjs`.

## Run it

```bash
npm run capture                       # auto-detect a host (transcript-present), capture latest session
npm run capture -- --list             # show detected hosts + their sessions
npm run capture -- --host gemini-cli  # capture a specific host
npm run inspect -- experiments/experiment-1-trace-capture/out/<file>.otlp.jsonl
```

## Result (captured live, this session)

**Claude Code** — rich `session → turn → tool` tree, real durations + OK/ERROR status:

```
• session 20410eef (claude-code)  56.1m
  • turn: …/init…  1.0m
    • Bash  704ms
    • Read  540ms
  • turn: Okay let's start the application scaffolding…  48.6m
    • Agent  2.1m
    • AskUserQuestion  17.2m      ← real human think-time, captured
    • WebFetch  13.8s
    • ExitPlanMode  13.4m
    …
```

**Gemini CLI** — thin `session → turn` tree (its `logs.json` logs user prompts only; tool calls live in checkpoints, not captured):

```
• session 6c6924c4 (gemini-cli)  1420.4m
  • turn: what is this codebase about  6.3m
  • turn: deep dive on swira  1414.1m
```

Same core, two hosts, different richness → **host-agnosticity demonstrated**, and the rich/thin gap is the README's "completeness varies by host" thesis made literal.

 for lessons and the harvest list.

---

## Conclusions

**Verdict: hypothesis confirmed.** Transcript parsing is a viable, genuinely host-agnostic trace-capture mechanism. Two real hosts (Claude Code, Gemini CLI) produced valid OTLP/JSON traces through one core with zero host conditionals. All structural checks on the output passed.

## What worked

- **Transcript-first beats hook-first** for the foundation. It needs no host cooperation, no running process, and — critically — Claude transcripts carry stable `tool_use.id` ↔ `tool_result.tool_use_id` pairs, so span pairing, durations, and OK/ERROR status come for free. (Confirmed the hook payload has *no* per-call id, which would have made Pre/Post pairing ambiguous under parallel tool calls.)
- **`refId` / `parentRefId` on the Event is the right host-agnostic seam.** Adapters express whatever tree depth the host's log supports; the core just wires `parent_span_id = spanId(parentRefId)`. No host logic leaks into the core.
- **Deterministic ids** (`sha256(host+session)` / `sha256(trace+refId)`) make re-capture idempotent and remove any id-mapping table.
- **OTLP/JSON `ExportTraceServiceRequest` per line** is the right output: validated structurally (32/16-hex ids, uint64-nano string timestamps, AnyValue attrs, resolvable parents). It's collector-ingestible later with no converter.
- **Capturing live, in-session, is dogfood gold.** The trace shows real human think-time (`AskUserQuestion 17.2m`, `ExitPlanMode 13.4m`) and tool latencies — exactly the signal the evolution engine will mine.

## What we learned / honest limits

- **Completeness varies by host — by a lot.** Claude = `session→turn→tool` with status; Gemini's `logs.json` = `session→turn` (prompts only). This is the README's thesis made literal, and it means **trace richness is per-adapter**, so any downstream eval lens must tolerate missing tool spans, not assume them.
- **OTLP-conformant ≠ collector-tested.** We validated the structure by schema, not by feeding a running OpenTelemetry Collector `otlpjsonfilereceiver`. Structurally it matches; a live round-trip is still unproven. *(Cheap follow-up.)*
- **Turn detection is heuristic.** We key turns on non-meta `user` entries with text content; queued user messages (`queue-operation` entries — e.g. mid-turn interjections) are currently **not** captured as turns. Visible in this very session (2 turns detected, but there were more interjections).
- **Raw tool input/output is deliberately NOT on the trace** — only byte sizes. Good default (dodges secrets-in-trace, keeps size down), but the eval lens will eventually need *some* content; that's a guardrails/redaction design point, not a free addition.
- **Tree depth is shallow.** Subagent/`Task` calls aren't nested under their sub-session yet (the `Agent` tool shows as a single span). Real nesting needs sidechain-transcript linking.
- **Span durations are wall-clock, including idle.** Tool spans are real latency (meaningful — `AskUserQuestion 17.2m` is genuine think-time). But a **turn** span is tiled to run until the next prompt, so it conflates response + idle (e.g. `turn: deep dive… 1414.1m` is mostly idle). The future eval lens must **not** treat turn duration as active-work time, or it'll flag idle gaps as pathological "slow operations".

## Harvest list → `app/`

When we promote (the method's step 5):

| From experiment | To `app/` | Notes |
|---|---|---|
| `core/event.mjs`, `core/ids.mjs`, `core/spans.mjs`, `core/otlp.mjs` | `app/evolution/observability/` | the host-agnostic trace core — Observability is the keystone under "evolve" |
| `adapters/host-adapter.mjs` (contract) + `registry.mjs` | `app/runtime/host-adapter/` | the observe-model seam lives under "run" |
| `adapters/claude-code.mjs`, `adapters/gemini-cli.mjs` | `app/runtime/host-adapter/adapters/` | per-host shims |

Harvest is a **separate step** (not done today) — promote only once a second experiment hasn't forced a core change.

## Candidate next experiments

- **Exp 2 — collector round-trip:** feed `out/*.otlp.jsonl` into a real OTel Collector `otlpjsonfilereceiver` → prove drop-in interop (and to a viewer like Jaeger/Tempo).
- **Exp 2/3 — Gemini checkpoint adapter:** parse Gemini checkpoint files to recover the missing tool spans → close the completeness gap for a second host.
- **Live capture (hooks):** Claude Code `PostToolUse`/`Stop` → append spans in real time, reconciled against the transcript at session end.
- **Subagent nesting:** link sidechain transcripts so `Task`/`Agent` spans become real sub-trees.
- **First eval lens:** run the README's cheap signals over a captured trace (retire-unused-tool, high tool-failure) — the first taste of the evolution engine.
