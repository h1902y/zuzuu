---
title: The conversational composer (+ agent sessions) — the workbench input surface
date: 2026-06-23
status: live spec, unshipped
supersedes-input-of: docs/design-research/02-session-conversation-composer.md (the UX half; this is the architecture half)
---

# The conversational composer (+ agent sessions)

## Problem

The workbench center pane is a **raw PTY shell**. Typing flows keystroke-by-keystroke into whatever's on the PTY (`TermView` → `connection.sendInput` → `ClientOp.Input` → `session.write` → `pty.write`). Two consequences:

1. **A statement does nothing useful.** The default session is `type: "shell"` (zsh). Type a prompt — "add a dark-mode toggle" — and the shell tries to run it as a command → `command not found`. Nothing in the loop understands natural language, because nothing is listening for it.
2. **Per-keystroke latency.** Every key is a round-trip to the daemon. Invisible on localhost; once the PTY runs on a remote VM (cloud waves), perceived latency degrades sharply.

The system *can* take prose — an `agent` session runs a host coding-agent CLI (Claude Code/Codex/…) directly on the PTY, and typing into *that* talks to the agent. But: (a) the workbench has **no UI to start one**, and (b) raw per-keystroke input over a remote PTY will feel laggy.

## Thesis

**Decouple input from the PTY.** Replace the raw terminal input (for agent sessions) with a **native, browser-local composer**: a normal text box where typing is instant (zero RTT), and **Send** ships the whole message to the agent's stdin in one shot. We trade terminal-native input features (readline, autocomplete, syntax highlighting) — irrelevant for prose — for snappiness and a surface we own (suggestions, polish, slash-commands later).

This is the input half of the already-validated conversation-surface design (`design-research/02`). It is consistent with **interactive-mode-first, never headless** — we still drive the *real* interactive host CLI over a PTY; we just give it a better front door. It also **retires predictive local echo** (a benchmark "behind" gap): the composer deletes per-keystroke RTT instead of masking it.

## Design

### 1. Agent sessions, surfaced

The create path already exists (`sessions-routes.ts`: `type: "agent"` + `command`/`args`, argv-allowlisted, spawned directly on the PTY in its own worktree, squash-merged on exit). What's missing is the **UI affordance**: a "new agent session" control (host picker → spawns the host CLI). This alone makes "type a statement → the agent acts" work today.

### 2. The composer (the agent-session input)

- A native textarea, **fully local** — typing never touches the network.
- **Send** (⏎, with Shift+⏎ for newline) ships the message to the PTY as a **bracketed paste** + submit (mechanics below).
- Multi-line, history (↑/↓ recalls prior turns), and a host/model pill (per `design-research/02`, Cursor-style).
- **Shell** sessions keep the raw terminal (a shell *is* a terminal; prose there is still a command). The composer is the **agent**-session surface.

### 3. The raw-control path (the part that's easy to get wrong)

The host CLI is an interactive **TUI**, not a line REPL. The composer covers "type a turn," but the TUI also needs single keypresses the composer must not swallow:

- **Stop** button → `Ctrl-C` (`0x03`). **Esc** button → `ESC`. These are single bytes — latency-irrelevant even over a remote VM.
- A detected **"the app wants a keypress"** mode (y/n confirms, arrow-key menus, "press Enter to continue") that briefly exposes raw key capture.
- The **raw xterm stays available as a tab** — the escape hatch for genuinely terminal moments (a sub-shell, interactive `vim`, a pager). The composer must never hide the terminal so completely the user can't answer a `y/n` or kill a hung process.

### 4. Conversation rendering

The user's Send renders as a **chat block** in a transcript (not relying on PTY echo, which a raw-mode TUI may not place where we want). Agent output renders as prose + **one-line receipts** ("Edited store.ts", "Ran npm test", "Guardrail: blocked rm -rf") + **cards** for substantial events (a plan to approve, a diff, a checkpoint/rollback) — the `design-research/02` patterns. The raw terminal is demoted to an on-demand tab.

*(Scope note: rich rendering can land incrementally — the composer + chat-block + raw-terminal-tab is the MVP; receipts/cards follow.)*

## Mechanics

- **Bracketed paste, not raw lines.** On Send, wrap the message in `ESC[200~ … ESC[201~` and append the submit key (`\r`), sent as ordinary `ClientOp.Input` frames. **No wire-protocol change** — the composer client constructs the byte sequence; `session.write` feeds it to the PTY; the host CLI treats it as one paste + submit (so multi-line prose doesn't execute line-by-line). This is a real terminal standard the host already understands.
- **Idle-gating — the key open problem.** Don't fire a prompt mid-turn. We need an "agent is awaiting input" signal. *But* agent sessions get **no shell-integration injection** (plain env, no OSC 133 from us — by design, so the host's output isn't polluted). So idle detection can't rely on our markers. Options to evaluate against real host output (real-wire-data rule): (a) the host's *own* OSC/title signals if it emits them; (b) an **output-quiescence heuristic** (no PTY output for N ms ⇒ idle); (c) **always-allow + queue** (Send whenever; the host buffers; the composer optionally holds a follow-up until quiescent). MVP: **(c) + a soft (b) hint**; harden per host later.
- **Message queueing** falls out for free: when the agent is busy, the composer holds the next message locally and sends on idle — something raw stdin can't do.

## Build units (sequence)

1. **Agent-session affordance** — a "new agent session" control + host picker; spawns `type:"agent"`. *Unblocks "statement → agent acts" immediately; no composer needed yet.*
2. **The composer** — local textarea, Send → bracketed-paste `Input`, Stop/Esc buttons. Agent sessions only.
3. **Idle-gate + awaiting-input signal** — quiescence heuristic + queueing; the paused/awaiting-input banner.
4. **Conversation rendering** — chat blocks; raw terminal as a tab. (Receipts/cards incremental.)
5. **Host/model picker** in the composer.
6. **Later** — suggestions · message polish · slash-commands.

## Open questions

- **Agent-idle detection without shell-integration** (mechanics §). Resolve against real host output, per host.
- **Per-host paste+submit semantics** — Claude Code vs Codex vs Gemini may differ on bracketed-paste handling and the submit key. Verify against each real CLI before wiring (real-wire-data rule).
- **Does the composer fully replace the agent terminal, or coexist?** MVP: composer primary + raw terminal tab. Revisit once rendering matures.

## Scope boundaries

- **In:** the agent-session input surface (affordance + composer + raw-control path + minimal chat rendering) for the **local** workbench.
- **Out / deferred:** the cloud sync + remote-PTY work (separate waves); predictive local echo (**retired** by this design); shell-session input (stays raw); the full receipts/cards rendering (incremental after MVP).
- **Retires:** the benchmark's "predictive echo" recommendation.
