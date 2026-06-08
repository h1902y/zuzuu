# zuzuagents — Fundamentals (finalized)

> **Status:** locked 2026-06-08. The short, canonical statement of *what we're building and why*. Depth lives in [`agent-foundation-primitives.md`](agent-foundation-primitives.md), [`core-hypothesis-and-evolving-faculties.md`](core-hypothesis-and-evolving-faculties.md), and the [`inspiration/`](inspiration/) audits.

## Value proposition
Your host coding-agent (Claude Code / Codex / Gemini) gives the agent a **brain**. **zuzu gives it an evolving Memory, Knowledge, Actions (skills), and Guardrails — improved automatically from how you actually work.**

The differentiator vs static wrappers (OpenClaw, Hermes, entire.io): **zuzu's faculties *graduate*** — they level up across versioned **generations**, and **you configure the graduation mechanism from observability insights.**

## How it works (the loop)
1. **Wrap** the live *interactive* host session (never headless).
2. **Serve** faculties (via MCP / instruction-files / filesystem) **and observe** the session as a normalized **trace**.
3. **Evaluate** — score faculty operations from the trace.
4. **Propose** — a trace-miner suggests a graduation (memory promotion, tool crystallization, guardrail tightening, substrate tier-up).
5. **Approve** — the human disposes, async and out-of-band.
6. **Pin** — the approved change becomes a new **generation** (rollback = flip a pointer).

Backbone principle: **pin definitions, observe data.**

## Openness & business model
- **100% open source, local-first.** The whole harness runs locally — instruction files + a local CLI/server + a local trace store. **No account, no server, no data leaves the machine by default.**
- **Opt-in data sharing** — users may choose to share traces so we can inspect and improve the system.
- **Optional paid SaaS on top** — hosted control-plane (cross-device sync, large-scale server-side evolution/eval, managed semantic tier, team features). Always optional; the OSS local path is fully functional on its own.

## Architecture in one breath
Three layers — **Agent** (the evolving faculties) · **Runtime** (serve faculties + observe + run the async evolution loop) · **Evolution engine** (observe → eval → generations → governance). **Interactive-mode-first.** Host-adapter is an **observe model** (hooks → one normalized `Event`), not a driver. **TS** stack. The **trace is the keystone** — built first.

## Build order (incremental; each slice independently useful)
1. **Trace capture** (Claude-Code-first, local) ← *building now*
2. Faculty serving (MCP / filesystem / instruction-file)
3. The four faculties (Memory · Knowledge · Actions · Guardrails)
4. The evolution/graduation engine (the differentiator — deliberately last; it consumes 1–3)
