# Host guide — Gemini CLI

| Capability | State |
|---|---|
| observe (mine sessions) | ✅ thin — session listing only (honest gap, below) |
| lifecycle hook + gate | ⏳ not yet wired in v2 (see *Status* below) |

## How observe works — the honest thin host
Gemini's `~/.gemini/tmp/<project>/logs.json` is a **flat user-prompt timeline** — it carries no tool calls (those live in separate checkpoint files). So zuzuu's Gemini adapter lists sessions but mines **no shell signals** — an honest capture gap, not a core difference. Same contract as every host, thinner data.

This is **host-agnosticity demonstrated, not asserted**: the host-blind core iterates detected adapters and calls their uniform interface; Gemini simply has less on disk to mine.

## Status
The v2 rebuild ships the **observe adapter** (session listing). The live hook + the enforced gate are currently wired for **Claude Code only**; re-wiring Gemini's `.gemini/settings.json` hook block — and recovering tool spans from Gemini's checkpoint files so it stops being thin — is on the [[Roadmap]].
