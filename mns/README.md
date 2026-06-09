# mns — the motors & sensors CLI

Verb-first, entire.io-style, **zero dependencies, no build**. The user-facing surface over the trace core.

```bash
mns status                  # detected hosts + recorded sessions
mns capture [--host NAME]   # capture a session → git-native trace + index entry
mns trace [--last | FILE]   # print a captured trace's span tree
mns doctor                  # environment + session health
mns version | help
```

Run as `mns <cmd>` after `npm link`, or `node bin/mns.mjs <cmd>`, or `npm run mns -- <cmd>`.

> Named `mns` (not `mas`) on purpose — `mas` is Homebrew's Mac App Store CLI; we don't shadow it.

## Git-native storage

Mirrors entire.io's split so trace blobs never pollute your working diff:

| Path | Tracked? | What |
|---|---|---|
| `.mns/sessions.json` | **tracked** | the session index — small, diff-friendly, each entry links to the `git commit` it was captured at |
| `.mns/traces/*.otlp.jsonl` | git-ignored | the bulky OTLP blobs (regenerable); Phase 2 moves these to an orphan `mns/traces` branch |

## The Session primitive (`session.mjs`)

The lifecycle model: `opening → active → completed | abandoned | crashed`. A killed terminal sends no clean "end", so lost sessions are *reconciled* (entire's approach), not signalled.

**Phase 1 (today):** post-hoc transcript capture records every session as `captured` (lifecycle-unknown snapshot). The full state machine is defined and tested now so Phase 2 can drive it live.

**Phase 2 (next — `experiment-2-live-sessions`):** `mns enable` installs background agent hooks → sessions open/close live across the terminal lifecycle; `mns doctor` reconciles abandoned/crashed ones via a liveness heartbeat. See [QUICKSTART.md](../QUICKSTART.md) → "Where this is headed".

## Layout

- `bin/mns.mjs` — dispatch (in repo root `bin/`).
- `mns/session.mjs` — the Session primitive + lifecycle state machine.
- `mns/store.mjs` — the git-native `.mns/` store + git linkage.
- `mns/commands/{status,capture,trace,doctor}.mjs`.

Reuses Experiment 1's `core/` + `adapters/` in place; re-points to `app/` at harvest.
