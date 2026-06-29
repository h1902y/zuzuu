---
title: "The ACP drive lane — own the workbench UX + build traces, off the host TUI"
status: subscription premise VALIDATED (Spike #1 passed 2026-06-29) — lane in-build, Spikes 2–3 next
date: 2026-06-29
supersedes-partially: the absolute reading of "observe, never drive" (Design B)
---

# The ACP drive lane

> **Live spec for unshipped work.** This proposes adding an **opt-in "drive" lane** to the
> workbench, built on the **Agent Client Protocol (ACP)**, so we can own the conversation/session
> UX and build real traces **without scraping the host's terminal** — while still riding the user's
> Claude Code subscription. It **revises** the absolute form of "observe, never drive" but does
> **not** adopt the lane: adoption is gated on the three spikes in §7. Grounded in a verified
> deep-research pass (§4, sources in §9).

---

## 1. The decision (revised stance)

**"Observe, never drive" is demoted from dogma to default, with a sanctioned drive lane:**

- **Observe stays the universal floor.** Re-parse the host's transcript (Design B). Works for
  *every* host (including non-ACP: Codex, etc.), zero-drive, the "wrap the agent you already run"
  CLI-hook path. The human gate (the moat) is unchanged. This is not up for revision.
- **Drive becomes an opt-in *capability* — via ACP — for ACP-native hosts (Claude Code, Gemini
  CLI), in the workbench.** It buys session/conversation/command control + a structured event
  stream for UX and traces, **without owning the agent loop** (the adapter delegates the loop, model
  calls, and tool execution to the host's own SDK).

The original decision conflated **"don't own the loop"** (still true — owning the loop is the hard,
undifferentiated part) with **"don't control the session"** (ACP separates these — you control the
session *over* the host's loop). That conflation is what this spec corrects.

**Status: subscription premise validated, lane in-build.** Spike #1 (§7) **passed 2026-06-29** —
the adapter drove a full prompt turn with the provider env key scrubbed, on a confirmed Max/Pro
subscription login, no API key (evidence in §7). The decisive "ride the subscription" question is
resolved YES for the current stack. The lane is not yet *shipped* — Spikes 2 (bridge + render) and 3
(gate) remain — but the CLAUDE.md / Decision-Log stance is updated from "never drive" to "observe is
the floor; an ACP drive lane is validated and in-build." The §4c billing-split risk still stands.

## 2. Why now — the thesis

The workbench's center is *terminal-is-the-transcript* today (spawn the host CLI on a PTY, mine the
terminal). That ceilings two things the product wants:

1. **Own the UX, off the host TUI.** A structured event stream lets us render a real conversation
   surface (tool-call cards, inline diffs, plans, permission prompts) instead of a raw terminal —
   the **parked conversation-composer**, finally buildable.
2. **Build real traces.** Structured, typed events (not terminal bytes) are the clean feed for a
   session trace / replay / observability layer — a far better `observe` input than re-parsing.

ACP is the standard that exposes exactly this, and (decisively) the Claude Code adapter can ride the
**existing Max/Pro subscription**, not per-token API billing.

## 3. What ACP is (one paragraph)

An LSP-analog, **JSON-RPC 2.0** protocol (newline-delimited JSON, typically over **stdio**;
protocol **version 1**, negotiated at `initialize`) that **decouples the UI from the agent** —
"connect any editor to any agent." The **client** (normally the editor) drives; the **agent** runs
as a subprocess. Authored by Zed; TS SDK `@zed-industries/agent-client-protocol` (`AgentSideConnection`).

## 4. What the research established (verified — §9 sources)

**4a. The structured surface — the raw material for UX + traces (high confidence, 3-0).**
`session/update` notifications carry a typed `SessionUpdate` union:
- **Typed tool calls** with a `pending → in_progress → completed/failed` lifecycle: `toolCallId`,
  `title`, `kind` (read/edit/delete/move/search/execute/think/fetch/other), `status`, `content`,
  `locations`, `rawInput`, `rawOutput` — via `tool_call` (initial) + `tool_call_update` (deltas).
- **Structured file diffs** (`path` / `oldText`(null=new file) / `newText`) + `{path, line}`
  follow-along locations; content unions of `diff` · `content` (text/image/resource) · `terminal`.
- **Agent message chunks** (grouped by `messageId`), **thought/reasoning chunks**, **plan updates**,
  **usage updates** (tokens + optional cost/currency), user-message chunks, mode changes.
- **Per-tool permission requests** (`session/request_permission`).
- Session lifecycle: `new/load/resume/close/list/delete/prompt/cancel/set_mode`.
→ This is record-and-replay-ready, typed data — strictly better than transcript scraping.

**4b. The subscription linchpin — real but CONTESTED (decisive; must spike).**
- *Yes-path:* the adapter (`zed-industries/claude-code-acp` → renamed **`claude-agent-acp`**,
  Apache-2.0) wraps **Anthropic's official Claude Agent SDK**, which supports *both* `ANTHROPIC_API_KEY`
  and Claude **subscription OAuth**. Zed docs confirm a per-thread `/login` that authenticates "with
  Claude Code where supported," and that the agent "owns its own authentication and billing."
- *Counter-evidence:* the adapter READMEs are **silent on auth** and their only launch example uses
  `ANTHROPIC_API_KEY=sk-...`; a third-party report said the **bare adapter required an API key and
  couldn't use a Max subscription**; a Zed bug had `/login` **default to API key**; the decoupling is
  **version-dependent** (~Zed 0.202.7 stable / 0.203.2 preview).
→ **Subscription auth works through Zed's integration, but the standalone adapter as *we'd* launch
  it may default to / need a key. Prove it in our setup (Spike #1) — do not take it on docs.**

**4c. TOP macro risk — the billing split (announced, then PAUSED).** Anthropic announced
(2026-05-14) then **paused (2026-06-16)** routing Agent-SDK/ACP usage to separate "Agent SDK
credits" instead of subscription limits. **For now it works as before**; Anthropic is "revising the
plan" with promised advance notice. The whole "ride the subscription" premise could move — **monitor
this; re-verify before committing.**

**4d. Ecosystem & maturity — current and active.** Protocol v1; Zed-maintained adapter actively
released. Clients: Zed (reference), JetBrains (late 2025), Neovim (CodeCompanion), OpenCode, a VS
Code ACP-client extension. Agents: Claude Code, Gemini CLI, Codex, Qwen Code, others.

**4e. Browser-client prior art EXISTS (the big de-risk).** `formulahendry/acp-ui` is a
cross-platform ACP client that runs in the **browser**, renders the structured stream (chat, tool
calls, diffs, sessions), and reaches a local/remote agent over a **WebSocket bridge** — the exact
architecture we'd use, already demonstrated.

**4f. Honest gaps (not closed by verified claims).** Remote HTTP/WebSocket transport status (only
stdio/ndjson is verified — we bridge it ourselves anyway); the **head-to-head vs Claude Agent SDK
direct / MCP / AG-UI** produced no verified findings (so we don't *claim* ACP beats them — but for
"decoupled UI + structured traces + subscription" it's the strongest evidenced path; **Agent SDK
direct is the obvious fallback** — same SDK underneath, same subscription question, minus the
protocol); no existing trace product built on ACP was found (greenfield, not a red flag).

## 5. Target architecture (how ACP maps into zuzuu)

It maps cleanly onto pieces the workbench daemon already has (it already bridges **PTY↔WebSocket**):

```
browser SPA (ACP client UI)
   │  WebSocket  (our wire)
web daemon  ──spawns──▶  claude-agent-acp  (subprocess)
   │  stdio JSON-RPC (ndjson)        │ wraps
   └── bridge: stdio ⇄ WS            └── @anthropic-ai/claude-agent-sdk  ──▶ Claude Code (subscription auth)
```

- **The bridge** = the daemon spawns the adapter and pipes its stdio JSON-RPC ⇄ the browser over WS
  (same shape as our existing PTY↔WS path; mirror `acp-ui`). This is how a browser reaches a local
  stdio agent.
- **The SPA** renders the `session/update` stream — tool-call cards, live diffs, plans, thoughts,
  usage — i.e. the **structured conversation composer** *and* the **trace feed** in one.
- **The gate** maps `session/request_permission` → our guardrails gate **in-band** (cleaner than the
  PreToolUse-hook shim). `observe` can consume the same structured stream instead of re-parsing.
- **Coexistence:** the ACP lane is *additive*. Terminal-is-the-transcript stays the default fidelity
  path; ACP-structured is the opt-in rich surface for ACP-native hosts. Observe stays the floor for
  everything else.

## 6. Decision Log + CLAUDE.md deltas

- **Decision Log (`docs/guide/Decision-Log.md`):** add a new entry — *"Observe is the floor; an
  opt-in ACP drive lane (for ACP-native hosts, in the workbench) is being explored — spike-gated."*
  Status: **exploring**. (Added in this branch.)
- **CLAUDE.md "Key fixed decisions":** the line *"the observe model (Design B — re-parse the host's
  transcript, never drive)"* gets a trailing clause **only after Spike #1 confirms** — e.g. *"…never
  drive (observe is the floor); a drive lane via ACP is an opt-in workbench capability for ACP-native
  hosts, never by owning the loop."* Not edited now (the spike gates it).

## 7. The spike plan (gate before any adoption)

Three spikes, **#1 first and decisive**. Each has an explicit kill-criterion.

### Spike #1 — Subscription auth (DECISIVE, do first)
- **Goal:** prove `claude-agent-acp` drives Claude Code on a **Max/Pro subscription** via `/login`
  OAuth, **without** an `ANTHROPIC_API_KEY`, on current adapter + SDK versions.
- **Build:** spawn the adapter from a throwaway script (no API key in env), run the `/login`
  subscription flow, send one `session/prompt`, confirm a normal turn completes.
- **Measure:** does it run with no API key? Does usage draw from the **subscription** (not API
  credits)? Pin exact adapter/SDK/Claude-Code versions that work.
- **KILL IF:** it requires an API key / per-token billing with no subscription path → the "ride the
  subscription" premise fails; fall back to (a) Agent SDK direct under the same test, or (b) stay
  observe-only. Also re-check the §4c billing-split status before relying on the result.
- **RESULT — PASS (2026-06-29).** A ~60-line ACP client (SDK `@agentclientprotocol/sdk@1.0.0`)
  spawned the adapter (`@agentclientprotocol/claude-agent-acp@0.52.0` → `@anthropic-ai/claude-agent-sdk@0.3.191`),
  Claude Code `2.1.195`, with `ANTHROPIC_API_KEY`/`AUTH_TOKEN`/`BASE_URL` stripped from the child
  env. `initialize` returned `protocolVersion: 1, authMethods: []` (no auth demanded — valid local
  auth present); `session/new` returned no `auth_required`; `session/prompt` completed
  `stopReason: end_turn` with streamed `agent_message_chunk` + `usage_update` events. The local
  login was **confirmed Max/Pro subscription** by the operator → the adapter rides the subscription
  with no API key. Refutes the third-party "bare adapter needs an API key" report for this stack.
  **Bonus (free):** the structured stream (`agent_message_chunk`, `usage_update` with cached-token
  breakdown, `available_commands_update`) renders end-to-end — partial validation of Spike #2; and
  the SDK ships experimental `ws-client`/`http-client` stream helpers, promising for the bridge.

### Spike #2 — The bridge + structured render
- **Goal:** prove the daemon can bridge stdio↔WS and the SPA can render the structured stream.
- **Build:** daemon spawns the adapter, bridges its ndjson stdio ⇄ a WS endpoint (reuse the PTY↔WS
  plumbing); a minimal SPA view renders `session/update` — agent message chunks, **tool-call cards**
  with status lifecycle, **inline diffs** (oldText/newText), plans, thoughts.
- **Measure:** end-to-end latency vs the terminal path; fidelity of tool/diff rendering; can we
  reconstruct a full **trace** from the event log (replay a session offline)?
- **KILL IF:** the structured stream is materially lossier or laggier than the terminal for real
  sessions (unlikely given 4a, but measure).

### Spike #3 — The gate in-band
- **Goal:** map `session/request_permission` → the guardrails gate (deny/ask/allow), preserving the
  moat in the drive lane.
- **Build:** intercept permission requests, evaluate against `guardrails/gate`, respond allow/deny
  with reason; confirm a denied tool call is actually blocked.
- **KILL IF:** ACP gives no pre-execution hook we can gate on (it does — `request_permission` — but
  confirm coverage across tool kinds).

**Sequence:** #1 → (if green) #2 → #3. Time-box #1 to ~1–2h; it alone decides whether to continue.

## 8. Deferred / out of scope (for now)

- Remote (cloud) ACP transport — bridge is local-daemon-only initially.
- Driving non-ACP hosts (Codex etc.) — stays observe-only.
- The full conversation-composer build — this spec gates the *substrate*, not the finished surface.
- The verified head-to-head vs Agent SDK-direct / MCP / AG-UI — re-run as a focused follow-up if
  Spike #1 fails or if we want a second opinion before building.

## 9. Sources (verified pass, 2026-06-29)

- ACP spec: `agentclientprotocol.com/protocol/{schema,tool-calls,prompt-turn,transports,initialization}`,
  `agentclientprotocol.com/rfds/session-usage`; repo `github.com/agentclientprotocol/agent-client-protocol`; TS SDK docs.
- Subscription/auth: `zed.dev/docs/ai/external-agents`, `zed.dev/blog/claude-code-via-acp`,
  `zed.dev/blog/anthropic-subscription-changes` (the paused billing split), `github.com/zed-industries/claude-agent-acp`,
  npm `@zed-industries/claude-code-acp` / `@agentclientprotocol/claude-agent-acp`, `code.claude.com/docs/en/authentication`.
- Browser client prior art: `github.com/formulahendry/acp-ui`.
- Full cited report (25 verified claims, 0 killed): the deep-research run output in the session scratch dir.
