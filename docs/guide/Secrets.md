# Secrets — declarations only; the value is terminal-managed, never zuzuu-stored

`docs/specs/2026-07-02-polish-showcase-experience.md` §J.3/§J.5. A `type: secret`
note is a **declaration**: it names an env var, who may resolve it, and how strictly
— never the credential itself. The value lives on the **host** (your shell's env, a
`fly` app's injected secrets, a keychain export, …), read at run time. zuzuu governs;
the host stores; a terminal call manages.

**The one invariant, enforced at three separate layers, not just documented:**
*the value never enters a note, `runs.jsonl`, or an agent's context* — see
"How the invariant is enforced" below for exactly where each layer lives.

## The declaration shape

```yaml
---
type: secret
name: OPENAI_API_KEY            # the env var name the value lives under
scope: [module:library, tool:digest-fetch]   # allowlist of who may resolve it
actor: operator-only             # operator-only | agent-allowed (default operator-only)
resolves_from: env               # env | secrets-file | fly | oidc (default env)
rotation_note: rotate quarterly · owner: hkc   # free text (Vercel's rotation-note pattern)
sensitive: true                  # default true (opt-in-sensitivity fails — be default-secure)
last_used: 2026-07-03T12:00:00Z  # audit — updated by an OPERATOR run that resolves it
---
```

| Field | Required | Notes |
|---|---|---|
| `name` | yes | the env var name — uppercase/digits/underscore, not starting with a digit (e.g. `OPENAI_API_KEY`) |
| `scope` | no (but inert without it — see below) | a list of `module:x` / `tool:x` / `module:tool` strings |
| `actor` | no | `operator-only` (default, fail-closed) or `agent-allowed` |
| `resolves_from` | no | `env` (default) / `secrets-file` / `fly` / `oidc` |
| `rotation_note` | no | free text — a reminder, not enforced |
| `sensitive` | no | boolean-ish, default `true` |
| `last_used` | — | audit only — never hand-set; the resolver's own operator-lane touch writes it |

**What a declaration may NEVER carry**: `value`, `secret`, `key`, `token`,
`password`, `credential` — case-insensitive, exact field-name match. Any of these on
a `type: secret` note fails `zz validate`/the write door, full stop. This isn't a
convention — see below.

## The `secrets` module (a documented convention, not a hard requirement)

Declarations live in a dedicated `secrets` module by convention — §J.3's own
framing ("a `secrets` module of DECLARATIONS"). `use/secrets.mjs`'s resolver only
ever looks there; a `type: secret` note minted elsewhere is still write-door-safe
(the value-refusal + shape checks are per-**type**, not per-module — the same design
every other type-keyed invariant in `notes/validate.mjs` uses) but the resolver
won't find it.

Mint the module once for the nicer typed-column CLI sugar (`--field scope=a,b`
coerces to a list instead of landing as one string):

```bash
zz module new secrets --title Secrets --tagline "Declared secrets — the value lives on the host, never here"
zz module add-column secrets scope multi
```

Then declare one — through the SAME two paths every other note uses, no special
verb:

```bash
# the operator lane — instant, still validated + logged + minted
zz note create secrets openai-key --type secret \
  --field name=OPENAI_API_KEY --field scope=module:library,tool:digest-fetch --field actor=operator-only

# or the agent lane — a proposal a human approves. NOTE: zz stage's --field sugar
# does NOT schema-coerce (unlike note create's) — scope needs --change JSON so it
# lands as a real list, not the string "module:library".
zz stage secrets --op create --target openai-key \
  --change '{"type":"secret","name":"OPENAI_API_KEY","scope":["module:library"]}'
zz review approve secrets openai-key
```

Either path runs through `notes/validate.mjs`'s write door — a `value:` field on the
`--change`/`--field` payload is refused before it ever becomes a note, whichever lane
it arrived by.

## Setting the VALUE — a terminal call, per `resolves_from` (never a zuzuu command)

There is no `zz secret set`. The value is a host thing:

| `resolves_from` | Set it with | Read it with |
|---|---|---|
| `env` (default) | `export OPENAI_API_KEY=…` (or your shell profile / `.env` loader) | `process.env[name]` |
| `fly` | `fly secrets set OPENAI_API_KEY=… -a <project-app>` | `process.env[name]` — fly injects at boot; there's no separate "get" call |
| `secrets-file` | add `NAME=value` to `.zuzuu/secrets.env` (gitignored) | the SAME file — **dev fallback only**, never the primary mechanism |
| `oidc` | nothing to set — a short-lived, per-run token minted at the host | not resolvable from the local CLI (see below) |

`zz secret check` names the exact fix-it command for whatever's missing.

## Scope + actor — who may resolve it, and under what trust context

**Scope** is an allowlist checked against the **caller** — the tool asking, as a
`module:tool` address (e.g. `library:digest-fetch`, what `use/act.mjs` supplies as
its own address when a tool resolves its declared secrets). Three entry shapes:

- `module:library` — any caller IN the `library` module
- `tool:digest-fetch` — any caller whose tool/leaf id is `digest-fetch`, in ANY module
- `library:digest-fetch` — an exact `module:tool` address match

**No scope, or no matching entry, resolves NOTHING** — fail-closed by construction,
not an oversight. An unlisted caller gets a resolution *error*, never a value.

**Actor** is the second, independent gate: `operator-only` (the default) refuses to
resolve for an `agent`-actor run, full stop — mirrors the guardrails execution gate's
own fail-closed posture for an unattended agent. `agent-allowed` resolves for either.
Both gates must pass; neither substitutes for the other.

## Placeholder injection — the browser-use pattern

When a `type: action` tool declares `secrets: [name]` and runs (`zz act` / `zz tool`
composition), `use/act.mjs` resolves each name **before** the run starts (a failure
refuses the WHOLE run — never a partially-secreted one) and substitutes the real
value into the child process's env as `ZZ_<NAME>`. The caller — an agent's context,
the tool's own `inputs`, its return value, `runs.jsonl` — only ever sees the **name**.
The tool layer is the only reader of the value; it never rides back up.

```yaml
---
type: action
title: Enrich a lead via Clearbit
run: node scripts/enrich.mjs
secrets: [CLEARBIT_KEY]
---
```

`scripts/enrich.mjs` reads `process.env.ZZ_CLEARBIT_KEY` — the agent that triggered
this run never held that string.

## How the invariant is enforced — at EACH layer, not just documented

1. **The write door** (`notes/validate.mjs`'s `validateNote`, reached by every path —
   `note create`, `note set`, `review approve`, `module import` — because they all
   route through `notes/repo.mjs`'s `writeNote`, the ONE place a note becomes bytes):
   a `type: secret` note carrying `value`/`secret`/`key`/`token`/`password`/
   `credential` (any case) fails validation. **The value can never be written to a
   note.**
2. **The resolver** (`use/secrets.mjs`'s `resolveSecret`) is the ONLY reader of the
   host store. It's pure and fs-only (no sqlite index dependency), gated by scope
   then actor, and returns the value **only** to its direct caller — never persisted,
   never logged by this file.
3. **The injection site** (`use/act.mjs`): the resolved value goes straight into the
   child process's env, never through `inputs` (which IS logged). `notes/log.mjs`'s
   `logRun` additionally extends its redaction set with whatever the note's OWN
   declared secret names resolved to in `process.env` — so even if a value coincidentally
   rides in under an unrelated input key, it's masked in `runs.jsonl` too
   ("redact at the injection site" — transformation defeats post-hoc masking).
4. **The read surfaces** (`zz secret list`/`show`/`check`) never call the resolver
   with intent to obtain a value — `list`/`show` only report metas + a ✓/✗
   availability probe; `check` only asks "is it present", never "what is it".

## What's deferred

- **`resolves_from: oidc`** is accepted at the write door (a valid declaration can
  say it) but the resolver honestly refuses to resolve it locally — it's a per-run,
  host-side lane with no local "get" step; wiring it up is remote/hosted-arc work
  (§J.1).
- **`resolves_from: fly`** reads `process.env` today (fly injects secrets at VM boot,
  so there's no separate "get" call) — this is correct for a Fly-hosted deployment;
  it's indistinguishable from `env` when run locally, which is also correct (nothing
  to fake).
- **No cross-project secret sharing** — scope is `module:x`/`tool:x` WITHIN one
  Project; a registry-level secrets story (sharing a declaration's *shape*, never its
  value, across subscribed modules) is unbuilt.
- **A staged proposal's transient JSON file**: `zz stage` doesn't itself run the
  write-door check (only `review approve` → `commit` does) — so a poisoned proposal
  with a `value:` field sits, briefly, in `<module>/staged/<id>.json` until a human
  reviews and it's refused. It never becomes a note or reaches `runs.jsonl`/agent
  context, but a hardened future rev could refuse it at `stage` time too.
