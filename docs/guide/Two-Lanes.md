# The two write lanes — instant for you, gated for the agent

zuzuu has exactly two ways a row lands in your Project, and **who you are decides which one you get**.

```
   YOU (the operator)                     THE AGENT (any host)
   ──────────────────                     ────────────────────
   zz note create/delete/set/…            zz stage  (a pending proposal)
   zz module import --csv                       │
        │                                       ▼
        ▼                                 zz review approve   ← YOU, the gate
   lands NOW ──────────────┬────────────── lands on your yes
                           ▼
              ONE write boundary (grow/commit.mjs)
              validates · logs provenance · mints a generation
```

## Why a gate at all?

Automated memory systems poison themselves: an agent that can write its own knowledge base will eventually write confident-but-wrong reflections into it, then trust them next session. The review gate is the one defense — **an agent can only propose**. Every proposal is typed, deduped, ranked, and waits for `zz review`.

## Why not gate you too?

Because you're building *your own* application, and this was always the doctrine: operator-initiated writes have been direct since the beginning — `zz note set · append · rename · fold` are recorded in [the model](https://github.com/h1902y/zuzuu/blob/main/docs/MODEL.md) as *"direct edits (outside the loop, operator-gated)"*, and `zz init`/schema changes are themselves gate-events. The operator lane **extends** that recorded doctrine with `create`, `delete`, and bulk import — it doesn't relax the moat, which was always about *agent* writes. Your lane is instant — but it is **not** a back door:

- Every operator write still goes through the **same single write boundary** the gate uses: schema-validated (a malformed row never lands), provenance-logged (the mutation log records actor + source), and minted (a generation = a git commit — everything rolls back).
- `zz check`'s `ungated` count stays honest: a note without a log entry is flagged, whichever lane it came through.

## How the agent is actually stopped

Two independent layers, both generated from the same command table (they cannot drift):

1. **In-process**: the sole writer (`grow/commit.mjs`) refuses any write stamped `actor: agent`. The agent's stamp is applied at the entry boundary (the host hook), never read from agent-controllable input.
2. **At the shell**: the guardrails `PreToolUse` gate denies the agent shelling any write verb (`permission ∈ {write, admin}` and not `agentInvokable`). Add a new write verb to the table and it's denied automatically — there is no second list to forget.

The agent's sanctioned channels are exactly two: `zz observe` (mine sessions → proposals) and `zz stage` (a proposal). `zz review approve` is deliberately not even registered as a capability — approving is a human act.

## Day to day

| You want | You type |
|---|---|
| add a row now | `zz note create <m> <id> --type t --field k=v` |
| bulk rows now | `zz module import <m> --csv file.csv` |
| see what the agent wants | `zz review` |
| let one in | `zz review approve <m> <id>` |
| preview a batch as one change-set | `zz review plan <m>` → `zz review apply <m>` |
| turn one down | `zz review reject <m> <id> --reason "…"` |

In the workbench, the same split is visible in [the World](The-World): your creates appear as solid nodes immediately; the agent's proposals hover as **ghost nodes** until you approve them.
