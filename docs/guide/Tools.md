# Tools — the toolkit/tool model (MCP-native, honestly labeled)

zuzuu already had a "runnable note" (`type: action`, a `run:` command). This page
covers the **second name** for the same thing — the MCP-native reading that makes
the whole picture click: a **toolkit** is a module, a **tool** is an action note, and
a tool declares **how** it runs via a `binding`. No new entity was invented to get
here — see `docs/specs/2026-07-02-polish-showcase-experience.md` §I.6.

| MCP concept | zuzuu concept |
|---|---|
| toolkit / server | a **module** (`module.md` is the toolkit manifest) |
| tool | a `type: action` note |
| tool's `inputSchema` | the module's declared typed-column **schema** (`fields`) |
| `tools/list` | `zz tool list` (a read-only preview of the same shape) |
| tool call | `zz act <module> <id>` |

## The `binding` field

A tool declares **how** it runs with `binding: shell | agent | mcp`. Absent means
`shell` — the ORIGINAL, still-default shape: every existing action note with just a
`run:` command is unchanged, no migration needed.

```yaml
---
type: action
title: Rebuild the deck index
run: npm run build:index
---
```

```yaml
---
type: action
title: Enrich a lead
binding: agent
prompt: use your browser tool to look up this company and summarize what it does
---
```

```yaml
---
type: action
title: Send an email
binding: mcp
mcp: { server: gmail, tool: send }
secrets: [GMAIL_OAUTH_TOKEN]
---
```

**The `prompt`/`run` decision**: an `agent`-binding tool needs a prompt — text
telling the host what to do. Rather than force every agent-binding tool to carry a
second required field, it reuses `run:` as the prompt string when `prompt:` is
absent. One primary instruction field, regardless of which binding reads it.

**`secrets: [name]`** is DECLARED metadata only — a list of secret *names* a tool
says it will need. **Nothing resolves them yet.** No value is read from anywhere,
injected into a run, or checked against an allowlist; that's a follow-on build (see
`docs/specs/2026-07-02-polish-showcase-experience.md` §J.3/§J.5 for the design —
value never in the note, never in `runs.jsonl`, never in agent context). Today
`secrets:` only round-trips and validates (a list of non-empty strings) so tool
authors can start declaring what they'll need before resolution lands.

## `zz tool list` / `zz tool show` — the read-only view

```bash
zz tool list
# tools[2]{module,addr,binding,summary,params,secrets}:
#   actions,actions:rebuild,shell,Rebuild the deck index,,
#   crm,crm:enrich,agent,Enrich a lead,lead_url,CLEARBIT_KEY

zz tool show crm:enrich
# tool[1]{addr,binding,summary,secrets}:
#   crm:enrich,agent,Enrich a lead,CLEARBIT_KEY
# inputSchema[1]{name,type,required,label}:
#   lead_url,link,true,Lead URL
# target (agent): use your browser tool to look up this company…
# open — no run.allow policy declared on this toolkit; shell runs are
# unrestricted beyond the guardrails gate (a deny rule can still block one)
```

Both take `--json` for machine consumption — `tool list --json` emits
`{toolkits: [{module, title, tools: [...]}]}`; `tool show --json` emits one tool's
contract plus its `hitl` note. This is the shape a future real `tools/list` MCP
endpoint would serve; today it's a read-only preview, not a server.

**The HITL note** in `tool show` names a REAL, checkable behavior rather than an
invented `protected: true` flag: if the toolkit's `module.md` declares a
`policy.run.allow` list, every shell run in it is restricted to that allowlist (plus
repo-local scripts) — reported as **protected**. A toolkit with no such policy has
no allowlist axis at all — any shell command may run, subject only to the guardrails
gate's deny rules — reported as **open**. The guardrails gate evaluates every run
either way; the allowlist is an additional, OPTIONAL layer on top of it.

## Dispatch — what actually happens when you run one

`zz act <module> <id>` — and a `note:` composition step, whether in a synchronous
Tier-0/1 workflow (`use/workflow.mjs`) or a Tier-2 durable run (`grow/run.mjs`,
[Workflows](Workflows.md)'s third tier) — all resolve through the exact same
`act()`, so no composition path can bypass binding dispatch:

- **`shell`** (default) — the path that already existed: the guardrails gate, then
  the `run.allow` command-axis, then a clamped timeout, then the run is logged. See
  [Workflows](Workflows.md) and [Two Lanes](Two-Lanes.md) for the full safety floor.
- **`mcp`** — **STUBBED.** Returns `{ok:false, error:'mcp binding: client not yet
  implemented (follow-on build)'}`. No fake success, no silent no-op. The MCP client
  (dialing an actual server, mapping inputs to its tool args) is a separate,
  follow-on build — this rung only declares and validates the `mcp: {server, tool}`
  shape.
- **`agent`** — **HONESTLY SCOPED, not stubbed-fake.** The design calls for
  delegating the tool's prompt to the host agent over the ACP lane (the session
  transcript becomes the run log). Today, **ACP is daemon-only**
  (`web/src/server/acp.ts` / `web/src/server/acp-routes.ts` — there is no ACP client
  reachable from this CLI process). So `zz act` on an agent-binding tool returns:
  ```json
  { "ok": false, "ran": false, "needsHost": true,
    "error": "agent binding requires a host session — run via the workbench / zz host …" }
  ```
  This is a deliberate boundary, not a bug: zuzuu's interactive-first doctrine means
  the CLI never headless-spawns a host session behind your back. A hosted daemon
  (the workbench, `zz host`) is where the ACP lane lives — that's the documented
  follow-on that actually dispatches an agent-binding tool.

## What's built vs. deferred

| Piece | Status |
|---|---|
| `binding` field + per-binding write-door validation | **built** |
| `secrets: [name]` declaration + shape validation | **built** (declaration only) |
| `zz tool list` / `zz tool show` (the read-only view) | **built** |
| shell binding dispatch | **built** (pre-existing, unchanged) |
| mcp binding dispatch | **stubbed** — clean `{ok:false}`, no client |
| agent binding dispatch (CLI) | **scoped honestly** — `{needsHost:true}`, no ACP client in-process |
| agent binding dispatch (hosted daemon) | **not yet built** — the ACP lane exists daemon-side; wiring it to the tool-binding dispatch is a follow-on |
| secrets RESOLUTION (env / secrets-file / fly / oidc) | **not built** — declared metadata only today |
| a real MCP server (`tools/list`/`tools/call` served over HTTP/SSE) | **not built** — `zz tool list`/`show` is the CLI-side preview of that future shape |
