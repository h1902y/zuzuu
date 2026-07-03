# The daemon & its API

`zz host web` starts a long-lived local daemon (Hono + WebSockets) that serves the workbench and is **the one sanctioned programmatic surface** over a Project. Frontends never import zuzuu's internals — the daemon shells the `zz` CLI through a typed command catalog, so it can only ever run verbs the CLI actually has.

## Security model

- Binds **127.0.0.1 only** (a non-loopback bind is refused outside an isolated sandbox).
- The printed URL carries a one-time **token** → exchanged for an HttpOnly `SameSite=Strict` cookie (a stateless hash, survives daemon restarts).
- **Host-header allowlist** (DNS-rebinding defense) + **Origin allowlist** (CSRF/WS-hijack defense); WebSocket upgrades are gated identically.
- The write routes shell the gated CLI — the browser physically cannot bypass the review gate, and the agent's ACP lane routes every tool call through the guardrails gate.

## HTTP routes (`/api/zuzuu/*`)

Reads:

| Route | What |
|---|---|
| `GET /overview` | every module: counts, pending proposals, top titles, enabled |
| `GET /module/:key` | the table read — `?text= &type= &status= &tag= &where=k<op>v &sort= &limit= &offset=` (repeat `where`) |
| `GET /module/:key/item/:id` | one full row (lossless envelope) |
| `GET /module/:key/schema` | the declared columns |
| `GET /module/:key/generations` | the lineage + active generation |
| `GET /graph?props=a,b` | the whole project as addr-keyed nodes + links (the World's document) |
| `GET /flow` | every `type: workflow` note + its run-count/latest-status summary (the [Flow view](Flow-View)'s picker) |
| `GET /readiness` | `zz doctor` + `zz digest` as text (the session kickoff brief) |
| `GET /held` | code-side sessions awaiting the merge gate |
| `GET /project-state` | the composite "what needs me" home signal |

Writes (each shells the CLI; CLI absent → 503):

| Route | What |
|---|---|
| `POST /module/:key/row` `{id, change?, force?}` | **the operator lane** — direct row create (instant, validated) |
| `DELETE /module/:key/row/:id` | direct row delete |
| `POST /module/:key/stage` | stage a proposal (the agent-shaped write) |
| `POST /staged/:id/approve` · `/staged/:id/reject` | the review gate |
| `POST /module/new` · `POST /module/:key/enabled` | module lifecycle |
| `POST /module/:key/generation/mint` · `…/generation/:id/rollback` | versions |
| `POST /session-label/:id` | name a session |

## WebSockets

| Channel | What |
|---|---|
| `/ws/term/:id` | live PTY terminals (binary frames, flow-controlled, replay on reconnect) |
| `/ws/acp/:id` | the structured agent conversation (ACP lane) |
| `/ws/fs` | explorer directory watching |
| `/ws/zuzuu` | **the brain push** — `{module, kind: items·staged·schema}` the moment a file lands; the UI invalidates on it, so an agent's mid-turn proposal appears live |

## Building on it

Treat the daemon as the local API: authenticate once (token → cookie), read `/graph` and `/module/:key`, write through `/module/:key/row` (your lane) or `/module/:key/stage` (the gated lane), subscribe to `/ws/zuzuu` for liveness. The CLI's `--json` output is the same data if you'd rather shell `zz` yourself.
