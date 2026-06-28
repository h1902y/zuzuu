# The Module Home (`zz init`)

`zz init` scaffolds **`.zuzuu/`** — your agent's home, **hidden like `.git` and just as yours**. It's a **git-citizen**: it plants `.zuzuu/` at your repo root and **never `git init`s** its own. It stays out of your file tree (no name clashes, no clutter), but nothing about it is opaque — everything inside is plain text you can read, edit, and version, and the CLI is the porcelain (`zz status` / `zz explain` / `zz digest` show exactly what the agent knows and what's pending your approval). The only *visible* change `init` makes is a few `.gitignore` lines for the ephemeral paths. It is **idempotent** and **brownfield-safe** — it writes each file once, clobbers nothing, and reports what it skipped.

## The modules

`init` doesn't prebuild a brain. It seeds **one** module — `instructions/` (the enforced safety floor + a little best-practice guidance) — and lets the rest **grow on demand**: a content module's `module.md` is minted the first time the loop routes a proposal to it. The standard *kinds* a module can be:

| Kind | Sense | What belongs there |
|---|---|---|
| knowledge | semantic — what's TRUE | verified project facts/entities |
| memory | episodic — what HAPPENED | curated session recollections |
| actions | procedural — how to DO | named, runnable procedures |
| instructions | directive — who to BE | project steering **+ the enforced rules** |
| guardrails | protective — what NOT to do | **enforced** tool-call rules — see [[Guardrails]] |

These are *examples with sensible defaults*, not a closed set — a module is generic (any goal-shaped collection of notes), so you can grow custom ones too. **Guardrails are folded into `instructions`**: the gate enforces every `type: rule` note wherever it lives, and `init` seeds that one module with the hard-won rules (no-root-wipe, no-secret-reads, confirm-force-push, plus the brain-write protections) alongside a few best-practice instruction notes — see [[Guardrails]].

Each module is just a `module.md` manifest + an `items/` folder of notes + a `staged/` queue of pending changes awaiting the review gate. They're generic — the difference between them is the manifest (its `note_type`, `goal`, the capabilities it exposes, and an optional typed-column **schema** that validates the module's notes — see [[Module Standard|Module-Standard]]).

## See it explained, any time
```bash
zz explain [home|loop|modules|verbs]   # what this home is, in plain words
zz digest                              # the session-start brief — what's learned + what's pending
zz review                              # the gate: approve/reject mined proposals (each approval mints a generation)
zz gen list <m>                        # the lineage you can roll back to
```

`.zuzuu/` is almost entirely **tracked** plain text — your notes (`items/`), the module manifests, each module's `staged/` queue, its `generations.json` lineage and `log.jsonl` mutation journal — so the brain round-trips across machines in git. The only git-ignored entries are `worktrees/` (live session checkouts) and each module's `runs.jsonl` (local run telemetry). Transient session + gate state lives **outside** the repo, in your XDG cache/state dirs — not in `.zuzuu/` at all.
