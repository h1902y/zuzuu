# 05 · How the system grows

> This is the part that makes zuzuu more than "files in a folder." The project's zuzuu *grows* from how you work — and it grows safely, because **nothing is written without your yes.** This page is the loop that does it.

The code is `grow/observe.mjs` (mine), `propose.mjs` (the queue), `review.mjs` (the gate), and `grow/snapshot.mjs` (versioned, rollback-able state).

## The loop

```
observe (mine real sessions)  →  propose  →  review  →  write + snapshot
        (the producer)           (queue)     (you)      (the zuzuu grows)
```

Read it as a sentence: *zuzuu watches what happened, suggests changes, you approve them, and the zuzuu pins a new version.* Every arrow is one small, testable piece. The mining half — how `observe` turns a finished session into routed candidates (a recurring command → a runnable action; a hot file → a knowledge entity) — is lesson `06`; this page is the **propose → review → snapshot** half, where a suggestion becomes a versioned write.

## The feedback edge: the event log

Recall from lesson `04` that a note never records its own outcomes — the *module's log* does. That append-only log (`runs.jsonl` from every `act`, plus the mutation record `review` writes) is the **feedback edge**: the audit trail of what actually ran and what the human approved. `observe` reads what *happened* (the session the host already wrote — lesson `06`), not what you *said*; the log is the durable record that observation and review leave behind.

## Proposals: staged, never applied

`observe` never touches the zuzuu. It produces **proposals** — evidence-backed, typed changes (`create`, `update`, `delete`, `relate`, `deprecate`) that sit in a queue (`<module>/proposals/`). A proposal carries its `rationale`, its `evidence` (what justifies it — a command recurring across sessions, a hot file, corroborated past a **threshold** so a single coincidence never acts), a confidence, and a score. They're **ranked by score**, and **deduped** by content — re-proposing the same change does nothing, so the queue doesn't fill with noise.

This staging is the whole safety story: observation produces *suggestions*, and a suggestion is inert until a human acts on it.

## The gate: the one door to the zuzuu

`review.mjs` is the only code that *writes* to the zuzuu, and it only runs on your decision. Approving a proposal does three things atomically:

1. **The mechanical CRUD** — write/update/delete the note, or add the relation. (A `create` writes a new file; an `update` *merges* the edit onto the current note, keeping fields you didn't touch.)
2. **Log the mutation** — a `create`/`update`/`delete` event into `log.jsonl` (the tracked, durable provenance), referencing the proposal id. A closed audit chain: signal → proposal → approval → write.
3. **Mint a generation** — snapshot the new state (below), so this exact moment is rollback-able.

Rejecting archives the proposal (never deletes it — the audit trail) and writes nothing.

> This gate is the moat. Every *automated* memory system — the ones that let an agent write its own memories — eventually poisons itself with confident-but-wrong reflections. The human gate is the one defense, and it's the thing competitors structurally lack. The cost is your attention, so the design keeps it cheap: proposals are batched and ranked, not fired one at a time.

## Snapshots: growth you can undo

Every approved change mints a **generation** (`grow/snapshot.mjs`) — an immutable pin of the module's notes. The mechanism is the one git taught us (lesson on `git-from-scratch`): content-addressed blobs (identical content stored once), an integer-counter chain per module, and **rollback as a pointer-flip + content restore** — never a `git revert`.

```bash
zz module knowledge generations      # the lineage (● = active)
zz module knowledge rollback 3       # restore that pinned moment
```

Each module pins **independently** — to roll the whole zuzuu back, you roll each module's pointer. (A single whole-zuzuu *checkpoint* composing every module into one pin was built, but it was never wired to any surface, so it was cut in the 2026-06-22 simplification pass rather than carried as dead code.)

The discipline is the same one running through the whole system: **immutable definitions, append-only history, growth by adding objects and moving pointers — never mutating in place.** A note is immutable until CRUD'd through the gate; the log is append-only; a generation is a frozen snapshot. Nothing is ever quietly overwritten, so nothing is ever quietly lost.

---

**Next:** `06` · Observing a host — how zuzuu captures the sessions that feed this loop, and why that solves the cold-start. *(Written when the observe pipeline ships.)*
