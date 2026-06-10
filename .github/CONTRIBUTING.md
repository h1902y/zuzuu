# Contributing

Early-stage and moving fast — issues and small PRs welcome.

- Zero runtime dependencies is a hard rule (`node:test`, `node:sqlite`, hand-rolled OTLP).
- The method: capabilities start as experiments with a hypothesis, get **verified against real sessions/wire data** (never invented fixtures), and land with their record in `experiments/LOG.md`.
- `npm test` must be green; goldens (deterministic ids) are pasted from real runs, never hand-computed.
- Docs are deliberately few: README (front door), docs/DESIGN.md (canon), experiments/LOG.md (journal). Module knowledge goes in code comments.
