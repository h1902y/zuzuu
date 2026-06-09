# runtime/ — "run"

What **serves & bounds** the agent. We do **not** run the agent loop — the host does. The runtime serves faculties to a host we don't run, captures the boundary, and runs the async evolution loop (`README.md` §3②).

- **host-adapter/** — the **observe model** (entire.io shape): detect a host, resolve + parse its transcript, normalize to one `Event`. Route by capability, never by host name. ← **first harvest target** (Experiment 1's `HostAdapter` contract + the Claude Code / Gemini adapters).
- faculty serving (MCP / filesystem / instruction-file), activation (scheduled graduation reviews), identity/permissions — later.

> Empty — Experiment 1's adapter layer harvests into `host-adapter/` once concluded.
