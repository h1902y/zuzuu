---
title: Composer primitives — adopt vs build (4-cluster research)
date: 2026-06-23
kind: prior-art-audit
method: 4 parallel web-researchers — AI chat UI libs · chat SDKs/message models · headless primitive standards · terminal-agent prior art
verdict: Adopt the input chrome (own-the-code shadcn/Base-UI). Own the PTY glue, the send-log, and the host-transcript-fed conversation. No chat SDK fits a PTY substrate.
---

# Composer primitives: what to adopt vs build

We're building the workbench's **conversational composer** — a native input box that sends prose to a host coding-agent CLI running on a **PTY** (not an LLM API). The research answers: what's standardized/adoptable, and what's irreducibly ours.

## The decision

**ADOPT — the input chrome (own-the-code, shadcn/Base-UI style):**

| Need | Adopt | License / notes |
|---|---|---|
| Composer input | **Vercel AI Elements `PromptInput`** (copied in) | `onSubmit(message)` is target-agnostic → write `message.text` to the PTY. Strip file/streaming bits. No runtime dep. |
| Popover/Dialog/Menu (host picker) | **`@base-ui-components/react`** v1 | MIT, MUI-maintained (named team — stronger than post-acquisition Radix), React-19 + Tailwind-v4 clean. The new shadcn default. |
| Slash-command menu | **`cmdk`** (already a dep) | MIT, React-19-clean since the 2025 fix. |
| Autosizing textarea | **`react-textarea-autosize`** v8.5.9 | MIT, stable. `field-sizing: content` is **not** Baseline (Chrome-only) → keep the JS lib until ~2027. |
| a11y / focus / keyboard | Base UI built-ins | No extra lib; Enter/Shift+Enter/Esc hand-rolled on `onKeyDown`. |

shadcn itself is a *CLI*, not a runtime dep. **Avoid:** CopilotKit (agent-runtime lock-in), Stream Chat (commercial API + React-19 peer conflict), react-chatbotify/Chatscope (styled monoliths), React Aria (over-engineered here), Ark UI (Tailwind friction). assistant-ui is a viable runtime-backed alternative (`useExternalStoreRuntime.onNew` is backend-agnostic; it even shipped a terminal renderer Mar 2026) — reach for it only if we want its `ThreadPrimitive` for a user-turn panel.

**BUILD/OWN — everything below the input box (no library fits a PTY substrate):**

- **Send glue = ~5 lines.** `tmux send-keys` / Warp pattern: `ESC[200~ + text + ESC[201~ + \r` written to the PTY. Claude Code (reverse-engineered) handles bracketed paste correctly.
- **Transcript = two data structures, never one.** xterm renders raw PTY output (it does VT100); a separate local **send-log** holds user turns (`{id, role, content, ts}` — borrow `UIMessage`'s *shape*, not its SDK). **Never parse VT100 into messages** (the Jupyter mistake).
- **Structured conversation = the host's own transcript file**, not the bytes (aider-webui polls `.aider.chat.history.md`; Claude Code writes `~/.claude/projects/**/*.jsonl`) — **the transcript zuzuu's `observe` already parses.** Big reuse; defer past the input MVP.

## Why no chat SDK fits

All (Vercel AI SDK `useChat`/`UIMessage`, AI Elements `Conversation`, Stream) impose an **LLM-API message model** — typed chunks over SSE, **no raw-bytes chunk type**. Routing a PTY stream through one means JSON-wrapping every frame *and* parsing VT100 to find message boundaries. The one standard worth borrowing is `UIMessage`'s **shape** for the local send-log; adopt no runtime. (Note: "Vercel Chat SDK" at `github.com/vercel/chat` is a *bot-side* Slack/Teams framework — irrelevant to browser UI.)

## Terminal-agent prior art (grounds the one hard piece: turn detection)

- **Warp** — canonical "editor decoupled from PTY": buffer the input, send the whole block on Submit (one PTY write). Its `BlockList` mixes agent-response blocks + raw terminal blocks in one list that doesn't parse content — the rendering model.
- **aider-webui** — dual-stream: raw PTY→xterm; a separate poller reads aider's history file→clean markdown panel. "Input locks while processing" (quiescence).
- **claude-code-web / Claude Code Remote** — PTY proxy; idle detected by matching Claude's "waiting for input" output (no protocol signal).
- **relay (AgentWorkforce)** — most-engineered injection: 500ms coalescing, 3s cooldown, **echo-verification** of delivery, pattern-match auto-`y` to permission prompts.
- **Herdr** — per-pane busy/blocked/ready via output heuristics (screen detection), not an agent API.
- **Roo Code** — chat→CLI via VS Code `sendText` + OSC 633 markers; documented pitfall: markers break under prompt customization → 15s timeout fallback.
- **Bracketed paste** — `ESC[?2004h` enables it; pastes wrap in `ESC[200~…ESC[201~`; newlines inside don't execute; **no ack**; programs not in paste mode get raw escapes (corruption) → only inject when the program supports it.
- **opencode-pty** — `POST /input` works but **can't drive OpenCode's permission UI** via injection → permission prompts must use the raw-control path.

**Resolved:** idle/turn detection = **output-quiescence heuristic** (not OSC markers); permission prompts = **raw-control path** (Stop/Esc/keys + raw terminal), never the composer.

## Sources (selected)

- assistant-ui ExternalStoreRuntime · AI Elements `PromptInput` (elements.ai-sdk.dev) · Base UI v1 (InfoQ Feb 2026) · shadcn Base-UI changelog (Jan 2026) · `react-textarea-autosize` (GitHub) · MDN `field-sizing` / Popover API
- AI SDK `UIMessage` / `ChatTransport` · Stream Chat React docs
- Warp "Why is the terminal input so weird" / "Block model behind Warp's ADE" · aider-webui (GitHub) · relay (NousResearch issue #413) · Roo Code shell-integration docs · cirw.in bracketed-paste · "Reverse-engineering Claude Code"
