# Spec — the OpenCode guardrails gate

**Date:** 2026-06-10
**Status:** approved design → Phase 0 (probe) then the implementation plan
**Stage:** the last gate rung. After exp-11, live capture works on all four wrapper hosts and the enforced gate runs on Claude / Gemini / Codex. OpenCode has live capture (plugin) but **no gate** — this closes that gap, giving enforced-gate parity across all four.

## Goal

`mns enable --host opencode` should install a guardrails gate alongside the existing live-capture plugin: tool calls are evaluated against `.mns/guardrails/rules.json` **before they run**, and a `deny` blocks the call. Reuse the shared host-agnostic engine (`evaluate()`), not a reimplementation.

## The governing constraint — the real-wire-data rule

Per CLAUDE.md, the gate is wired against OpenCode's **actual** plugin behavior, not docs. The docs/research say a plugin that **throws** from `tool.execute.before` blocks the call — Phase 0 confirms (a) the hook's real argument shape (how the tool name + input arrive) and (b) that throwing actually vetoes, by running a real OpenCode session with a probe plugin. OpenCode is installed locally, so this probe is self-served (no user session needed).

## Existing pattern this builds on

- `mns enable --host opencode` (`mns/commands/enable.mjs`) writes `.opencode/plugin/mns.js` — a plugin whose `event` handler fires `mns hook session.created|idle|deleted --host opencode --session <id>` by **spawning node detached** (fire-and-forget capture; the plugin runs in OpenCode's bun runtime, so it spawns the real node for `node:sqlite`). Always graceful — never throws into OpenCode.
- The gate engine (`mns/guardrails.mjs`: `loadRules`/`evaluate`) is host-agnostic. `mns/commands/hook.mjs` `gateDecision({host, payload, cwd})` evaluates a tool call, logs matched decisions to `.mns/live/guardrails-<session>.jsonl`, and returns a per-host decision. `runHook` reads stdin JSON for claude/gemini/codex; opencode uses `--session`.

## The architectural difference (why capture ≠ gate here)

Capture is fire-and-forget (spawn detached, don't wait). A **gate must decide synchronously, before the tool runs**. OpenCode's `tool.execute.before` is `async`, so the plugin can `await`. The canon-correct design: the plugin **spawns `mns hook PreToolUse --host opencode`**, pipes the tool payload on stdin, waits for the decision, and **throws** to veto on `deny`. This keeps `evaluate()` as the single engine (no rules logic duplicated into plugin JS) and matches the cost profile of the other three hosts (one node spawn per tool call) — the only difference is the *plugin* spawns it, not the host.

---

## Phase 0 — Observe (self-served; OpenCode is installed)

A throwaway probe plugin records what `tool.execute.before` actually receives and whether throwing blocks:
- Install a probe plugin in a scratch project that, on `tool.execute.before`, appends `{args, this}` (whatever the hook is handed) to a capture file and — in a second variant — **throws** to test veto.
- Run a real OpenCode session (headless `opencode run "..."` if it fires plugin hooks, else interactive) that triggers a tool call.
- **Deliverables (gate the plan):** the real `tool.execute.before` signature (where `tool_name` + `tool_input` live in the args), confirmation that throwing blocks the call (and what OpenCode shows the user), the `session_id` field on the hook, and whether `tool.execute.before` fires in `opencode run` (headless) or interactive-only. Committed as a golden fixture (`tests/fixtures/hooks/opencode.probe.*`).

If the probe shows a different veto mechanism than "throw" (e.g. a returned decision object, or the `permission.ask` hook), the plan adapts to whatever actually works — that is the rule in action.

---

## Phase 1 — Wire (shape specified; specifics from Phase 0)

### 1. The plugin gains a gate handler (`mns/commands/enable.mjs` — the `opencodePlugin()` template)

Add a `tool.execute.before` handler that:
1. Extracts `tool_name` + `tool_input` + `session_id` from the hook args (exact paths from Phase 0).
2. Runs the mns gate **synchronously-awaited**: spawn `node "<BIN>" hook PreToolUse --host opencode`, pipe `JSON.stringify({tool_name, tool_input, session_id})` on stdin, capture stdout.
3. If the decision is `deny` → `throw new Error("guardrail <rule>: <reason>")` (OpenCode blocks the tool, surfaces the reason).
4. **Fail-open + never-break-the-host:** wrap the whole handler in try/catch — on *any* error (spawn failure, timeout, parse error, malformed rules) → **return normally** (the tool proceeds; a gate bug must never block a tool, and the plugin must never throw a non-deny error into OpenCode). Only an explicit `deny` throws.
5. Keep the existing `event` lifecycle handler unchanged (capture stays fire-and-forget).

### 2. `hook.mjs` — gate path for opencode

- `runHook`: for the **gate** event invoked by the plugin (PreToolUse), read the piped stdin JSON even though host is opencode (lifecycle events still use `--session`, no stdin). I.e. opencode + a `GATE_EVENTS` event → parse fd 0.
- `gateDecision`: already host-aware. Add an opencode decision the plugin can unambiguously parse for deny vs not (e.g. reuse the `{decision:"deny",reason}` shape, or emit the existing `hookSpecificOutput`; the plugin only needs "is this a deny"). Matched decisions still log to `.mns/live/guardrails-<session>.jsonl` with `host:"opencode"`.

### 3. `ask` action

`ask` → **defer** (no throw), like Gemini: OpenCode's own permission flow handles approval; only `deny` hard-blocks in v1. (OpenCode's `permission.ask` plugin hook is a later rung if we want mns-driven asks.)

### Honest-outcome handling

If Phase 0 shows `tool.execute.before` doesn't fire in `opencode run` (headless) — same as Codex's interactive-only finding — ship the gate as interactive-only and record it. If throwing doesn't veto and no alternative veto exists in this OpenCode version, ship capture-only and record the gap (no gate that the host won't honor).

---

## Testing

- **Golden fixture:** the Phase-0 `tool.execute.before` capture (real-wire).
- **Unit:** the opencode gate decision serializer; `runHook` reads stdin for the opencode gate event (and still uses `--session` for lifecycle); **fail-open** (malformed rules / spawn error → no deny → no throw).
- **Dogfood (self-served — OpenCode installed):** `mns enable --host opencode` in a scratch project, seed a `deny` rule (e.g. `notes.txt`), run an OpenCode session that reads the gated file → confirm the tool is **blocked** and a `{host:"opencode",…,action:"deny"}` line lands in `.mns/live/guardrails-*.jsonl`. Record the result (including interactive-only, if that's the finding).

## Explicitly NOT in scope (YAGNI)

- mns-driven `ask` via OpenCode's `permission.ask` hook (deny-only gate in v1).
- Any change to the capture path, the other three hosts, or the shared `evaluate()` engine.
- **pi** — the separate queued spec (opens once pi is installed + authed; user is setting that up).

## Sequencing note

Phase 0 (probe) runs and reveals the real `tool.execute.before` shape + veto mechanism before the Phase-1 plan is written — same discipline as the Gemini/Codex spec.
