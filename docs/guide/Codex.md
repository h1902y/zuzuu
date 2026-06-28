# Host guide — Codex

| Capability | State |
|---|---|
| observe (mine sessions) | ✅ rich — real shell calls, pass/fail |
| lifecycle hook + gate | ⏳ not yet wired in v2 (see *Status* below) |

## How observe works
Codex writes rollout files to `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` — `{timestamp, type, payload}` lines, built against real wire data. `zz observe` reads them: shell calls are `response_item` `function_call`s (`exec_command`/`shell`/`bash`), and failure is inferred from the paired `function_call_output` text ("Process exited with code N", N≠0 ⇒ failed). Turns come from `event_msg/user_message` (the clean prompt text). The mined commands/files/failures feed the same proposal loop as every host.

> Mine Codex sessions without any wiring: just `zz observe` in a repo where you've run Codex.

## Status — observe today, hook/gate next
The v2 rebuild ships the **observe adapter** (mining) for Codex. The live lifecycle hook + the enforced `PreToolUse` gate are currently wired for **Claude Code only**; re-wiring Codex's `.codex/hooks.json` block (the engine + the `hookSpecificOutput` deny schema are host-shared, and the gate's tool-name canonicalization already covers Codex's shell tool) is on the [[Roadmap]].

## Worth knowing
- `codex exec` (headless) fires no hooks (verified, v0.138.0) — so when the gate lands it will be interactive-only, which fits zuzuu's interactive-first stance. Observe (post-hoc) works for headless runs regardless.
