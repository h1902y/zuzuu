# 05 · How the system grows

> This is the part that makes zuzuu more than "files in a folder." The brain *grows* from how you work — and it grows safely, because **nothing is written without your yes.** This page is the loop that does it.

The code is `loop/enhance.mjs` (mine), `propose.mjs` (the queue), `review.mjs` (the gate), and `loop/snapshot.mjs` (versioned, rollback-able state).

## The loop

```
observe (session + event log)  →  enhance  →  propose  →  review  →  write + snapshot
                                   (mine)     (queue)     (you)      (the brain grows)
```

Read it as a sentence: *zuzuu watches what happened, suggests changes, you approve them, and the brain pins a new version.* Every arrow is one small, testable piece.

## The feedback edge: the event log

Recall from lesson `04` that a note never records its own outcomes — the *module's log* does. That log (`runs.jsonl`) is what makes growth smart. `enhance` doesn't mine what you *said*; it mines **what actually ran and worked.**

The deterministic signal built today is **co-invocation**: if two actions get run together across several sessions, they're probably related — so `enhance` proposes a `related-to` edge between them, with the evidence (`run together in N sessions`) attached. It only proposes past a **corroboration threshold** (don't act on a single coincidence — the Generative-Agents lesson). Richer signals — a procedure repeated enough to crystallize into an action, a reverted experiment worth remembering as "avoid X" — come from the session *conversation*, which the observe pipeline (lesson `06`) feeds in. The deterministic core stands on its own; the conversation mining plugs into the same proposal pipeline.

## Proposals: staged, never applied

`enhance` never touches the brain. It produces **proposals** — evidence-backed, typed changes (`create`, `update`, `delete`, `relate`, `deprecate`) that sit in a queue (`<module>/proposals/`). A proposal carries its `rationale`, its `evidence` (the exact log events that justify it), a confidence, and a score. They're **ranked by score**, and **deduped** by content — re-proposing the same change does nothing, so the queue doesn't fill with noise.

This staging is the whole safety story: observation produces *suggestions*, and a suggestion is inert until a human acts on it.

## The gate: the one door to the brain

`review.mjs` is the only code that *writes* to the brain, and it only runs on your decision. Approving a proposal does three things atomically:

1. **The mechanical CRUD** — write/update/delete the note, or add the relation. (A `create` writes a new file; an `update` *merges* the edit onto the current note, keeping fields you didn't touch.)
2. **Log the mutation** — a `create`/`update`/`delete` event into `log.jsonl` (the tracked, durable provenance), referencing the proposal id. A closed audit chain: signal → proposal → approval → write.
3. **Mint a generation** — snapshot the new state (below), so this exact moment is rollback-able.

Rejecting archives the proposal (never deletes it — the audit trail) and writes nothing.

> This gate is the moat. Every *automated* memory system — the ones that let an agent write its own memories — eventually poisons itself with confident-but-wrong reflections. The human gate is the one defense, and it's the thing competitors structurally lack. The cost is your attention, so the design keeps it cheap: proposals are batched and ranked, not fired one at a time.

## Snapshots: growth you can undo

Every approved change mints a **generation** (`loop/snapshot.mjs`) — an immutable pin of the module's notes. The mechanism is the one git taught us (lesson on `git-from-scratch`): content-addressed blobs (identical content stored once), an integer-counter chain per module, and **rollback as a pointer-flip + content restore** — never a `git revert`.

```bash
zz module knowledge generations      # the lineage (● = active)
zz module knowledge rollback 3       # restore that pinned moment
```

And because each module pins independently, a **whole-brain checkpoint** composes every module's active generation into one pin — so you can roll the *entire* brain back to a coherent moment, not just one module. (The same Merkle-of-pins idea, one scope up.)

The discipline is the same one running through the whole system: **immutable definitions, append-only history, growth by adding objects and moving pointers — never mutating in place.** A note is immutable until CRUD'd through the gate; the log is append-only; a generation is a frozen snapshot. Nothing is ever quietly overwritten, so nothing is ever quietly lost.

---

**Next:** `06` · Observing a host — how zuzuu captures the sessions that feed this loop, and why that solves the cold-start. *(Written when the observe pipeline ships.)*
