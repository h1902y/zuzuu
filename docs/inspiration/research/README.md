# Research syntheses

Persisted prior-art research that informed the zuzuu redesign. These are **background reasoning**, not canon — the source-of-truth decisions live in `docs/specs/` (thesis-and-risks, cli-revamp) and the teaching in `docs/learn/`. Kept here so the *why* behind the design survives, with citations.

Each file is a multi-angle research fan-out (8–10 web-research agents) synthesized into an adoption brief.

| # | File | Question it answered |
|---|---|---|
| 01 | [Session management](01-session-management.md) | lifecycle, crash reconciliation, episode segmentation — what to borrow |
| 02 | [Project / module / zu boundary](02-project-module-boundary.md) | where one bounded container ends; goal-modules vs capability-modules |
| 03 | [Opinionated git + sessions](03-opinionated-git-sessions.md) | semantic (declared) episode boundaries; the Jujutsu borrow-patterns-not-binary verdict |
| 04 | [Harness experience](04-harness-experience.md) | session-conversation structure, root steering, task branch/merge, conversation↔git↔module linkage |
| 05 | [Conversation-planning validation](05-conversation-planning-validation.md) | does the intent-stack / episode / steering direction hold up vs compound-engineering, spec-driven dev, plan-execute agents, compounding loops, HITL gates — verdict + corrections |

Two earlier runs (shell **containment** + **OKF/AGE**, and the **filesystem-native prior-art** brief) were folded directly into `docs/specs/thesis-and-risks.md` and `docs/specs/cli-revamp.md`; their raw form was not preserved.
