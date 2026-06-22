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
| 01 | ✅ [The mental model](01-mental-model.md) | The three primitives (note · module · project), the mechanical/agentic operations, the one-substrate idea |
| 02 | ✅ [The seed in one file](02-the-seed-in-one-file.md) | Read a real note — inert, then runnable — the same file, two jobs |
| 03 | ✅ [How a note becomes queryable](03-how-a-note-becomes-queryable.md) | The index, query-on-demand, why it's context-frugal |
| 04 | ✅ [How an act runs safely](04-how-an-act-runs-safely.md) | Why an act is gated + allowlisted, not OS-sandboxed — the gate + `run.allow` |
| 05 | ✅ [How the system grows](05-how-the-system-grows.md) | The growth loop: observe → propose → review → snapshot, the human gate, generations |
| 06 | ✅ [Observing a host](06-observing-a-host.md) | Design B · the adapter (transcript→signals) · capture-core · observe routes corroborated candidates to modules |
| 07 | ✅ [The CLI veneer](07-the-cli-veneer.md) | The thin router over api · AXI/TOON output · git-citizen idempotent init · the loop from the command line |
| 08 | ✅ [The cull](08-the-cull.md) | Reabsorb the surviving v1 surfaces onto the kernel, drop the OTLP layer, delete v1 — ~13k → 3.8k |
| 09 | ✅ [The workbench](09-the-workbench.md) | The folded web package — the binary terminal + flow control, why the daemon was ported not rewritten, the de-bloat |
| 10 | 🚧 Extending zuzuu | Add a module, a note type, a host — by hand |
| 11 | 🚧 The decisions & why | The forks we faced and how we resolved them (links to the design specs) |

Read any time:
- [Reading the code](reading-the-code.md) — how the repo is organized, and the rules that keep it navigable.

## The discipline

The book is coupled to the build. A rung isn't done until its lesson is written. The path fills in as the system is built, never after, and a page describes only what exists. Design *intent* lives in `docs/specs/` and `docs/DESIGN.md`; this book teaches what's *real* and how to read it. A page that would teach something unbuilt stays 🚧.

## Where it sits

- **`docs/learn/`** (here) — the teachable path. Source of truth; mirrored to the wiki.
- **`docs/specs/`** — design intent for work in flight (the thesis, risk register, build blueprint).
- **`docs/DESIGN.md`** — the formal canonical design.
- **`docs/LOG.md`** — the build journal (what shipped, when, verified).
