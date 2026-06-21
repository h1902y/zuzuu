# Reading the code

> How the repo is organized so you can read it end to end — and the rules that keep it that way. Two readers: someone navigating the code for the first time, and someone writing code that has to fit.

The bar: a first-time reader can read the whole repo. Not skim — read. That works only if every file is small, does one thing, and says what it's for. These rules make it true. They're enforced at review, not aspired to.

## The seven rules

**1. One file, one responsibility.** A file does a single, nameable job. If you can't describe it in one sentence without "and," it's two files. (The `sessions.mjs` split — data / trace / redact / diff — is the example.)

**2. Small by default — a soft cap of ~200 lines.** Past it, find the seam. A few files earn an exception (a host adapter, a dense seed table) and justify it in their header. The cap forces rule 1.

**3. Every file opens with a header: *what · why · how it fits*.** One short comment block — what this file is, why it exists, how it connects to its neighbors. The highest-leverage habit for readability. Already common in the project; here it's a rule. Grasp a file's role before reading a line of logic.

**4. Public surface at the top, helpers below.** Exports first, in the order a caller meets them; private helpers underneath. Interface before machinery.

**5. Names mirror the vocabulary.** The code uses the book's words: `zu`, `module`, `project`, `query`, `enhance`, `act`, `approval`, `session`. If lesson `01` names a concept, the code spells it the same. No synonyms, no drift.

**6. Dependencies point one direction.**

```
kernel  ←  capabilities  ←  pipelines  ←  hosts / cli
(the 3     (verbs over      (processes     (the edges:
 primitives) the kernel)     that compose   observe, drive,
                             capabilities)  the CLI veneer)
```

Inner layers never import outer ones. `kernel/` knows nothing about a host or a command. Read inward and you always stand on solid ground; read outward and you always know what a thing is built from. An import that points the wrong way is a bug, not a shortcut.

**7. Tests read as behavior.** A test is named for the behavior it pins, not the function it calls. The suite is executable documentation. When prose and a test disagree, the test wins. Golden values are pasted from real runs, never hand-computed.

## How to read the whole thing

Follow the grain (rule 6), inside out:

1. **`kernel/`** — the three primitives and the store. Read first; everything builds on these. Start with `item.mjs` (the atom), then `store.mjs`, `index.mjs`, `capability.mjs`.
2. **`capabilities/`** — one file per verb (`recall`, `run`, `gate`, `mine`, …). Each is a self-contained answer to "what can you do to items?"
3. **`pipelines/`** — how verbs compose into processes (`evolve`, `serve`, `observe`).
4. **`hosts/` and `cli/`** — the edges: how the outside world reaches the core.

Lessons `07`–`08` walk these file by file. This page is the map; those are the tours.

## When you add code

You're adding a page to a book someone will read. Before a pull request:

- Does each new file pass the seven rules?
- Does it import only inward (rule 6)?
- If it teaches something new about how the system works, does its build rung's lesson in `docs/learn/` get written or updated in the **same** change? (The coupling rule — see the [README](README.md).)

Readable code is a feature here, equal to correctness. A clever file a newcomer can't follow has failed half its job.
