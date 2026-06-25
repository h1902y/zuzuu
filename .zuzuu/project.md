---
type: project
title: zuzuu
format: zuzuu/v2
---
A **Project** is this `.zuzuu/` directory of **envelopes** (markdown + frontmatter),
grown from how you work and **human-gated**. This file (`project.md`) is the Project's
own manifest; each subdirectory is a *module* (its `module.md` is the manifest); each
`items/<id>.md` is a *note* — one fact, optionally runnable. The hierarchy is
**note › module › Project**.

- **query** what's known · **act** on a runnable note · **check** integrity
- zuzuu **observes** your sessions and **proposes** changes you **review**

Everything in `.zuzuu/` is the durable Project (plain text, versioned) — notes,
each module's `generations.json` lineage, and the review queue — so the Project
round-trips across machines. Only `worktrees/` (live session checkouts) is
gitignored; the rebuildable index cache + transient run-state live OUTSIDE the repo
in your OS cache/state dirs. Inspect everything with `zz`.
