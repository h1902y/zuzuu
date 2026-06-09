# tests/

The rigorous suite. **Hermetic** (fixtures only — never reads machine/host data), strict pass/fail, CI-safe. Answers *"is the logic correct and unbroken?"* — distinct from [`../playground/`](../playground/), which checks *"does it work on this machine's real sessions?"*

```bash
npm test            # node --test tests/  — runs unit + regression
node --test tests/unit/ids.test.mjs   # one file
```

Zero dependencies: Node's built-in runner (`node:test` + `node:assert/strict`). No build.

## Layout

- **`unit/`** — pure functions of the trace core: `ids` (deterministic W3C ids), `event` (validation/defaults), `spans` (Event→OTel wiring, AnyValue encoding, status/timestamp mapping), `otlp` (envelope nesting, NDJSON).
- **`regression/`** — adapters against committed golden **fixtures**: the normalized tree (kinds, counts, parent links, status) **and the exact deterministic span ids**, so the id algorithm can't silently change.
- **`fixtures/`** — tiny hand-authored host logs (`claude-sample.jsonl`, `gemini-sample.logs.json`) mirroring the real shapes verified in Experiment 1.

## Conventions

- A regression golden id is **derived from an actual run and pasted** — never hand-computed. If the id scheme changes on purpose, regenerate and review the diff.
- Imports currently point at `experiments/experiment-1-trace-capture/{core,adapters}`; they re-point to `app/` when that code harvests in.

## Known-thin coverage (honest gaps to grow)

The fixtures cover the happy path. Not yet asserted by regression goldens — worth adding as the suite hardens:

- **`tool_use.input` as a JSON string.** Real Claude transcripts sometimes serialize `input` as a string (`"input":"{\"command\":…}"`); the adapter handles both, but the fixture only exercises the object form.
- **`isMeta` user entries** being skipped as turns.
- **Multi-turn / parallel tool ordering** (which turn a tool nests under when calls interleave).
- **Malformed / truncated transcript lines** (the adapter drops unparseable lines silently).
