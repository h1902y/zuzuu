# Host guide — OpenCode

> **OpenCode is also zuzuu's bundled default host.** `zz host code` ([[Getting Started|Getting-Started]]) — still aliased as `zz code` — installs + wires + launches it in one command, the fastest way to a module-equipped agent if you don't already run one.

| Capability | State |
|---|---|
| observe (mine sessions) | ✅ rich — real shell calls + error status |
| lifecycle hook + gate | ⏳ plugin not yet wired in v2 (see *Status*) |

## How observe works
OpenCode (≥1.16) stores sessions in SQLite (`~/.local/share/opencode/opencode.db`). zuzuu reads it via Node's built-in `node:sqlite` — still zero dependencies, loaded lazily so importing the adapter never breaks on older Node. Shell calls are `part` rows (`data.type` "tool", tool `bash`/`shell`), command = `state.input.command`, failed = `state.status === 'error'`. Those signals feed the proposal loop.

> Mine OpenCode sessions with `zz observe` in any repo where you've run `opencode`.

## Status — observe today, plugin next
The v2 rebuild ships the **observe adapter**. The live capture/gate **plugin** (the `.opencode/plugins/` `tool.execute.before` gate that throws on a deny) is currently wired for **Claude Code's hook only**; re-wiring the OpenCode plugin is on the [[Roadmap]]. (`zz host code` already ensures the home + the Claude-style hook path; the OpenCode-native plugin is the remaining piece.)

## Worth knowing
- `session.idle` is **per-turn** (like Claude's `Stop`); `session.deleted` only fires on deletion.
- Requires Node ≥ 22 for the SQLite reader.
