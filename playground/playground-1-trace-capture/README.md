# playground-1 — trace capture

Captures this repo's latest **real Claude Code session** through the full pipeline (`adapter.parse → eventsToSpans`) and asserts a sane tree: exactly one SESSION root, ≥1 tool_call, no negative durations, valid 32-hex trace id, every parent span resolves.

- **Pass:** a real Claude session here captured cleanly.
- **Skip:** Claude Code absent, or no session recorded for this repo yet.

Run: `node playground/run.mjs 1`
