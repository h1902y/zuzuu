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

See [`CONCLUSIONS.md`](CONCLUSIONS.md) for lessons and the harvest list.
