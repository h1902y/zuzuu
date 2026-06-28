# The Module Home (`zz init`)

`zz init` scaffolds **`.zuzuu/`** — your agent's home, **hidden like `.git` and just as yours**. It's a **git-citizen**: it plants `.zuzuu/` at your repo root and **never `git init`s** its own. It stays out of your file tree (no name clashes, no clutter), but nothing about it is opaque — everything inside is plain text you can read, edit, and version, and the CLI is the porcelain (`zz status` / `zz explain` / `zz digest` show exactly what the agent knows and what's pending your approval). The only *visible* change `init` makes is a few `.gitignore` lines for the ephemeral paths. It is **idempotent** and **brownfield-safe** — it writes each file once, clobbers nothing, and reports what it skipped.

## The five modules

| Folder | Module | What belongs there |
|---|---|---|
| `knowledge/` | semantic — what's TRUE | verified project facts/entities |
| `memory/` | episodic — what HAPPENED | curated session recollections |
| `actions/` | procedural — how to DO | named, runnable procedures |
| `instructions/` | directive — who to BE | project steering |
| `guardrails/` | protective — what NOT to do | **enforced** tool-call rules — see [[Guardrails]] |

Each module is just a `module.md` manifest + `items/` + `proposals/`. They're generic — the difference between them is the manifest (its `note_type`, `enhance.goal`, the capabilities it exposes, and an optional typed-column **schema** that validates the module's notes — see [[Module Standard|Module-Standard]]). `init` seeds the guardrails module with the hard-won rules (no-root-wipe, no-secret-reads, confirm-force-push).

## See it explained, any time
```bash
zz explain [home|loop|modules|verbs]   # what this home is, in plain words
zz digest                              # the session-start brief — what's learned + what's pending
zz review                              # the gate: approve/reject mined proposals (each approval mints a generation)
zz gen list <m>                        # the lineage you can roll back to
```

`.zuzuu/` also holds the loop's machinery, dot-prefixed + git-ignored: `.live/` (transient session state), `.generations/` (content-addressed snapshots), and the per-module `proposals/` queue (tracked). The durable brain — your notes and the module manifests — is plain tracked markdown.
