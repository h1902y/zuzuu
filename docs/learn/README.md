# Learn zuzuu

The book. Understand zuzuu from first principles — whether you've never seen it or you're about to change its core. Read it in order, like a text.

It lives in the repo, not a separate wiki, on purpose: a lesson and the code it explains ship in the same commit, so the teaching can't drift. The GitHub wiki is a rendered mirror — read here if you're in the code, read the wiki if you just want to learn.

## Who it's for

- **First-time reader** — start at `00`, walk forward.
- **Contributor about to touch the code** — read `00`–`02` for the model, then the code-tour page for your area.
- **Engineer studying filesystem-native agent design** — the whole path is the case study; the *why* is in the specs it links to.

You shouldn't need the source to follow the path. You should be able to read the source easily after it. That's the bar; `reading-the-code.md` holds it.

## Reading order

Each page builds on the last. **✅ written · 🚧 planned** (a page is written when its build rung ships — see *the discipline* below).

| # | Page | What you'll understand |
|---|---|---|
| 00 | ✅ [Motivation](00-motivation.md) | Why this exists — the problem with how agents remember and act, and the bet zuzuu makes |
| 01 | ✅ [The mental model](01-mental-model.md) | The three primitives (zu · module · project), the mechanical/agentic operations, the one-substrate idea |
| 02 | ✅ [The seed in one file](02-the-seed-in-one-file.md) | Read a real zu — inert, then runnable — the same file, two jobs |
| 03 | 🚧 How a zu becomes queryable | The index, query-on-demand, why it's context-frugal |
| 04 | 🚧 How an act runs safely | The tiered containment model and the policy block |
| 05 | 🚧 How the system grows | The session, the objective stack, episodes → enhance → the human gate → the right module |
| 06 | 🚧 Observing a host | The capture plugin and why it solves the loop's cold-start |
| 07 | 🚧 Walk the kernel | A guided, file-by-file tour of the host-neutral core |
| 08 | 🚧 Walk capabilities & pipelines | How verbs and processes compose over the kernel |
| 09 | 🚧 Extending zuzuu | Add a module, a zu type, a host — by hand |
| 10 | 🚧 The decisions & why | The forks we faced and how we resolved them (links to the design specs) |

Read any time:
- [Reading the code](reading-the-code.md) — how the repo is organized, and the rules that keep it navigable.

## The discipline

The book is coupled to the build. A rung isn't done until its lesson is written. The path fills in as the system is built, never after, and a page describes only what exists. Design *intent* lives in `docs/specs/` and `docs/DESIGN.md`; this book teaches what's *real* and how to read it. A page that would teach something unbuilt stays 🚧.

## Where it sits

- **`docs/learn/`** (here) — the teachable path. Source of truth; mirrored to the wiki.
- **`docs/specs/`** — design intent for work in flight (the thesis, risk register, build blueprint).
- **`docs/DESIGN.md`** — the formal canonical design.
- **`docs/LOG.md`** — the build journal (what shipped, when, verified).
