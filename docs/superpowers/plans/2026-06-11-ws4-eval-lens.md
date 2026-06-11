# WS4 — The Eval Lens — Implementation Plan

> Part of the Faculty+Evolution Program. TDD; zero-dep; Node ≥22; deterministic (no clock/LLM in the hermetic suite — inject `now`); commit per task; trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`; explicit `git add`. Baseline: 264 tests.

**Goal:** Add the missing "evaluate" step — a mechanical, deterministic scorer that **ranks** proposals for the human (never auto-approves). Swappable behind `getScorer(name)` so an LLM-judge can plug in later. Human approval stays mandatory; the lens orders the queue + flags low-signal items. Proposer ≠ scorer (separate modules).

## Task WS4-T1: the eval lens core
**Create** `mns/eval/{score,signals,rank}.mjs`; **Test** `tests/unit/eval-lens.test.mjs`.
- `signals.mjs` — `extractSignals(proposal, { now, sessionMtimes = {} })` → normalize the heterogeneous `evidence` bag + `analysis.er` + `provenance` into a common vector: `{ occurrence, corroboration, recency, failureReduction, erNovelty }`, each in `[0,1]` (bounded: `min(count/threshold,1)` style; recency from provenance session mtimes vs injected `now`; erNovelty: new=1, enrich=0.5, duplicate=0).
- `score.mjs` — `mechanicalScore(proposal, opts)` → weighted sum (occurrence .30, corroboration .30, recency .15, failureReduction .15, erNovelty .10) → `{ score: 0..1, confidence: high≥.66|med≥.33|low, rationale: string, signals }`. `SCORERS = { mechanical }`; `getScorer(name='mechanical')`. Pure, deterministic.
- `rank.mjs` — `rank(proposals, scorer, opts)` → each proposal annotated with its score, sorted high→low, bucketed; returns the ordered list (does NOT mutate stored files).
- Golden TDD: fixed proposals + injected `now`/mtimes → exact scores/ranks/confidence; a duplicate-ER proposal ranks below a new high-occurrence one; all-empty evidence → low. No clock, no LLM.

## Task WS4-T2: wire ranking into review + `mns eval`
**Modify** `mns/commands/review.mjs`, `mns/faculty/proposal.mjs` (or distill) to persist score; **Create** `mns/commands/eval.mjs`; **bin** wiring.
- `review.mjs`: before walking a faculty's proposals, `rank(...)` them (sort the DISPLAY order high→low; storage order untouched). Add an `eval:` line to each card: `eval: 0.78 [high] · occ=12 sessions=3 · recurring + cross-session`. Low-confidence → a `⚠ low-signal` marker. Use injected `now` = `Date.now()` at the command boundary (keep the pure fns clock-free).
- Persist `proposal.score = {...}` when distill/eval computes it (so it's git-diffable + a future generation can record the eval delta). Add it in `mns distill` (where proposals are created) and/or `mns eval`.
- `mns eval [--faculty f]` (new, non-interactive): print the ranked table (id, score, confidence, one-line rationale) across faculties — for inspection/CI. Mirror `mns distill`'s thin command shape. Wire `case 'eval':` + help.
- TDD: `mns eval` on a temp home with proposals prints them highest-first; `review` shows the eval line (test via the card function or a small render unit, not console scraping); `review-actions`/`knowledge-pipeline` stay green (ranking is a display concern — don't change approval behavior or the generation mint).

## Verification
- `npm test` green each task (264 + new; deterministic). `mns eval` end-to-end ranks real proposals; `mns review` shows eval lines + low-signal flags; approval/mint behavior unchanged.

## Risks
- Recency = clock dependency → inject `now` + sessionMtimes everywhere; golden tests pass fixed values.
- Proposer ≠ scorer: keep miner (distill) and scorer (eval) in separate modules.
- Don't let ranking change WHICH proposals exist or auto-approve — display + persisted score only; human still gates every one.
