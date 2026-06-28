# Host guide — pi

[pi](https://www.npmjs.com/package/@earendil-works/pi-coding-agent) (`@earendil-works/pi-coding-agent`) is zuzuu's 5th supported host — and the eventual owned-harness target (see [[Roadmap]]). Here it's a normal *observed* host.

| Capability | State |
|---|---|
| observe (mine sessions) | ✅ rich — real shell calls + isError status |
| lifecycle hook + gate | ⏳ extension not yet wired in v2 (see *Status*) |

## How observe works
pi writes sessions as JSONL under `~/.pi/agent/sessions/<slug>/<timestamp>_<uuid>.jsonl` — a `{type:"session",…}` header then entries linked by `id`/`parentId`. zuzuu's adapter reads it: shell calls are assistant `content[].toolCall`s (name `bash`/`shell`), command = `arguments.command`, with failure read from the paired `toolResult.isError` matched by `toolCallId`. Mined signals feed the proposal loop.

> `zz observe` mines pi sessions directly from disk — no wiring needed.

## Status — observe today, extension next
The v2 rebuild ships the **observe adapter**. The live capture/gate **extension** (the `.pi/extensions/` `tool_call` handler returning `{block:true}` on a deny) is currently wired for **Claude Code's hook only**; re-wiring the pi extension is on the [[Roadmap]].

## Worth knowing
- Headless `pi -p` shows no trust prompt, so a project-local extension is skipped unless trusted (pass `--approve`). This will matter once the extension is re-wired; observe (post-hoc) is unaffected.
- A killed session emits no clean end → `zz doctor` surfaces the leftover branch; `zz observe` still mines the session file on disk.
