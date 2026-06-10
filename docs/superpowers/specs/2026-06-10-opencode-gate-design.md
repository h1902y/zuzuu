# Spec — the OpenCode guardrails gate

**Date:** 2026-06-10
**Status:** approved design, **revised 2026-06-10 with doc-verified findings** (see below) → Phase 0 (confirm) then the plan
**Stage:** the last gate rung. After exp-11, live capture works on all four wrapper hosts and the enforced gate runs on Claude / Gemini / Codex. OpenCode has live capture (plugin) but **no gate** — this closes that gap, giving enforced-gate parity across all four.

## Goal

`mns enable --host opencode` should install a guardrails gate alongside the existing live-capture plugin: tool calls are evaluated against `.mns/guardrails/rules.json` **before they run**, and a `deny` blocks the call. Reuse the shared host-agnostic engine (`evaluate()`), not a reimplementation.

## The governing constraint — the real-wire-data rule

Per CLAUDE.md, the gate is wired against OpenCode's **actual** plugin behavior, not docs alone — Phase 0 confirms by running a real session. But a detailed read of OpenCode's plugin API (the `@opencode-ai/plugin` types + https://opencode.ai/docs/plugins/, against installed v1.16.2) has already settled the wiring shape and surfaced corrections; Phase 0 is now *confirmation*, not discovery.

### Doc-verified findings (2026-06-10) — these change the design

1. **Two veto mechanisms exist; `permission.ask` is the better fit.** `permission.ask(input, output)` lets a plugin set `output.status` to `"deny" | "ask" | "allow"` — a direct match for our `deny > ask > allow` severity (and it handles `ask` *natively*, unlike Gemini where we had to defer). `tool.execute.before(input, output)` blocks only by **throwing** (or mutating `output.args`). → **Use `permission.ask` as the primary gate; `tool.execute.before` throw is the hard-deny fallback** if `permission.ask` proves not to fire for a tool.
2. **`tool.execute.before` signature footgun:** `input = { tool, sessionID, callID }`, `output = { args }` — the tool **arguments live on `output.args`, not `input`**.
3. **~~Existing-capture bug~~ — DISPROVEN by the probe (real-wire correction).** A web-sourced reading claimed `session.created`/`deleted` carry the id only at `properties.info.id`, not `properties.sessionID`. **On the installed v1.16.2 the probe shows `properties.sessionID` is present on *every* session event** (`session.created`, `session.idle`, `session.updated`, …, all = `ses_…`). So our existing plugin's `event.properties.sessionID` is **correct** — no fix needed. (Classic case for the real-wire rule: the fork docs differed from the installed binary.)
4. **Plugin directory:** the probe confirms the installed v1.16.2 loads **both** `.opencode/plugin/` (singular, our current) **and** `.opencode/plugins/` (plural, the documented default) — both fired `__init__`. So no forced change; we'll standardize on the documented **plural** for forward-compat, but singular is not broken.
5. **Headless reality:** `opencode run` has a known upstream post-tool-call hang (#17516) and needs `-m <provider/model>` (our self-probe stalled on exactly this). Gate hooks (`permission.ask`/`tool.execute.before`) **are awaited**; the lifecycle `event` hook is **fire-and-forget** (fine for Design B — capture is signal+reconcile). → empirical confirmation runs **interactively** (headless is too flaky here), the Codex pattern.

## Existing pattern this builds on

- `mns enable --host opencode` (`mns/commands/enable.mjs`) writes `.opencode/plugin/mns.js` — a plugin whose `event` handler fires `mns hook session.created|idle|deleted --host opencode --session <id>` by **spawning node detached** (fire-and-forget capture; the plugin runs in OpenCode's bun runtime, so it spawns the real node for `node:sqlite`). Always graceful — never throws into OpenCode.
- The gate engine (`mns/guardrails.mjs`: `loadRules`/`evaluate`) is host-agnostic. `mns/commands/hook.mjs` `gateDecision({host, payload, cwd})` evaluates a tool call, logs matched decisions to `.mns/live/guardrails-<session>.jsonl`, and returns a per-host decision. `runHook` reads stdin JSON for claude/gemini/codex; opencode uses `--session`.

## The architectural difference (why capture ≠ gate here)

Capture is fire-and-forget (spawn detached, don't wait). A **gate must decide synchronously, before the tool runs**. OpenCode's gate hooks are `async` and **awaited**, so the plugin can `await` a spawned `mns hook PreToolUse --host opencode` (tool payload on stdin), keeping `evaluate()` as the single engine — one node spawn per tool call, like the other three hosts, only spawned by the plugin rather than the host.

**Mechanism: `permission.ask` primary, `tool.execute.before` throw as hard-deny fallback.** The plugin's `permission.ask(input, output)` handler runs the mns gate and sets `output.status` = `"deny" | "ask" | "allow"` — mapping our severity directly (this is why OpenCode gets *native ask*, unlike Gemini). If Phase 0 shows `permission.ask` doesn't fire for a given tool, fall back to `tool.execute.before` throwing on hard `deny`. Either way the spawned-engine pattern is identical; only how the decision is *applied* differs.

---

## Phase 0 — Observe (self-served; OpenCode is installed)

> **Phase-0 status (2026-06-10, partial):** the probe confirmed **plugin loading + lifecycle `event` hooks fire headless** (`opencode run -m`), both plugin dirs load, and finding #3 is disproven (sessionID on all events). **The gate hooks (`permission.ask`/`tool.execute.before`) remain UNobserved** — the run errored `Invalid API key` (the OpenCode Zen credential), so the model never invoked a tool. **Blocker: a working model credential** (re-auth `opencode auth login`), then re-run the probe to observe the gate hook + veto. Not a mechanism problem.

The signatures are doc-verified (above); Phase 0 *confirms behavior on the installed binary*: a probe plugin (in `.opencode/plugins/`) that records what `permission.ask` and `tool.execute.before` actually receive, and whether setting `output.status="deny"` / throwing actually blocks.
- **Run it correctly:** the earlier self-probe stalled because `opencode run` needs `-m <provider/model>` and hits a known post-tool hang (#17516). Retry headless **with `-m`**; if it still hangs after the tool, run **interactively** (a real OpenCode TUI session) — the Codex pattern — since the gate decision is what we need to observe, not headless completion.
- **Deliverables (confirm before the plan):** that `permission.ask` fires for the gated tool and `output.status="deny"` blocks it (else the `tool.execute.before`-throw fallback); the real arg paths on the installed version; that the lifecycle `event` ids match the per-event shape in finding #3. Committed as a golden fixture (`tests/fixtures/hooks/opencode.probe.*`).

---

## Phase 1 — Wire (shape specified; specifics from Phase 0)

### 1. The plugin gains a gate handler (`mns/commands/enable.mjs` — the `opencodePlugin()` template)

Also **standardize the dir** (finding #4): write the plugin to **`.opencode/plugins/` (plural, documented default)**. The `event` capture handler is **unchanged** — `event.properties.sessionID` is correct on v1.16.2 (finding #3 disproven).

Add a **`permission.ask(input, output)`** handler (primary gate) that:
1. Extracts `tool` + args + `sessionID` (args on `output.args` for the tool hook; `permission.ask`'s `input` is a `Permission` — exact field paths confirmed in Phase 0).
2. Runs the mns gate **awaited**: spawn `node "<BIN>" hook PreToolUse --host opencode`, pipe `JSON.stringify({tool_name, tool_input, session_id})` on stdin, read the verdict.
3. Apply: `deny` → `output.status = "deny"`; `ask` → `output.status = "ask"`; otherwise leave `output.status` untouched (defer to OpenCode's normal flow).
4. **Fail-open + never-break-the-host:** wrap in try/catch — on *any* error (spawn/timeout/parse/malformed rules) → leave `output.status` untouched and never throw (a gate bug must never block a tool or break OpenCode). Add a spawn timeout.
5. Fallback (only if Phase 0 shows `permission.ask` doesn't fire for a tool): a `tool.execute.before` handler that **throws** on hard `deny` (same engine call), wrapped so only an intentional deny throws.
6. Keep capture fire-and-forget.

### 2. `hook.mjs` — gate path for opencode

- `runHook`: for the **gate** event invoked by the plugin (PreToolUse), read the piped stdin JSON even though host is opencode (lifecycle events still use `--session`, no stdin). I.e. opencode + a `GATE_EVENTS` event → parse fd 0.
- `gateDecision`: already host-aware. Add an opencode decision the plugin can unambiguously parse for deny vs not (e.g. reuse the `{decision:"deny",reason}` shape, or emit the existing `hookSpecificOutput`; the plugin only needs "is this a deny"). Matched decisions still log to `.mns/live/guardrails-<session>.jsonl` with `host:"opencode"`.

### 3. `ask` action — natively supported

Because OpenCode exposes `permission.ask`, `ask` maps to `output.status = "ask"` (OpenCode then runs its own approval prompt) — OpenCode is the **first host with a native ask** (Claude maps ask→its prompt via the decision schema; Gemini/Codex deny-only or defer). `deny → output.status="deny"`.

### Honest-outcome handling

If Phase 0 shows the gate hooks fire only interactively (the Codex finding) — ship the gate interactive-only and record it. If `permission.ask` doesn't fire but `tool.execute.before` does, ship the throw fallback (deny-only). If neither vetoes in this version, ship capture-only and record the gap (no gate the host won't honor).

---

## Testing

- **Golden fixture:** the Phase-0 `tool.execute.before` capture (real-wire).
- **Unit:** the opencode gate decision serializer; `runHook` reads stdin for the opencode gate event (and still uses `--session` for lifecycle); **fail-open** (malformed rules / spawn error → no deny → no throw).
- **Dogfood (self-served — OpenCode installed):** `mns enable --host opencode` in a scratch project, seed a `deny` rule (e.g. `notes.txt`), run an OpenCode session that reads the gated file → confirm the tool is **blocked** and a `{host:"opencode",…,action:"deny"}` line lands in `.mns/live/guardrails-*.jsonl`. Record the result (including interactive-only, if that's the finding).

## Explicitly NOT in scope (YAGNI)

- Any change to the other three hosts or the shared `evaluate()` engine. (The OpenCode capture path *is* lightly touched — finding #3 sessionID fix + the plural dir — since they're in the same plugin we're editing.)
- **pi** — its own spec (`2026-06-10-pi-host-design.md`), written next. pi is now installed + authed; its capture+gate is a separate new-host effort.

## Sequencing note

Phase 0 (probe) runs and reveals the real `tool.execute.before` shape + veto mechanism before the Phase-1 plan is written — same discipline as the Gemini/Codex spec.
