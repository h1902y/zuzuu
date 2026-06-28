# The Module Standard — one envelope

Everything in zuzuu is an **envelope**: a markdown body + YAML frontmatter, distinguished by `type`. A **note** is an envelope; a **module**'s manifest is the same envelope. There is no second format.

```markdown
---
type: rule                       # the ONLY required field (OKF rule)
title: No destructive delete at filesystem root
action: deny
tool: Bash
pattern: rm\s[-\w\s]*\s['"]?/['"]?(?=\s|$|[;&|'"])
---
Blocks `rm -rf /` (bare root) and its long-flag/quoted/tab variants;
allows deletes under a path like `/tmp/x`.
```

- **Only `type` is required**, and **unknown keys are always preserved** — so the brain can learn new vocabulary without migrations. The frontmatter we emit is the JSON-compatible subset of YAML (so a real YAML parser can read it), but zuzuu parses it itself, with **zero dependencies**.
- **The id is the filename**, never a frontmatter field: `.zuzuu/<module>/items/<id>.md`.
- **Why markdown + frontmatter, not JSON?** It's where the agent ecosystem converged (SKILL.md, AGENTS.md, rules files), it diffs beautifully in git, and one-file-per-note makes concurrent hook writes safe. JSON stays where it belongs: the index and the transport.

## note › module › project

| level | what it is | on disk |
|---|---|---|
| **note** | the atom — one fact, optionally runnable | `<module>/items/<id>.md` |
| **module** | a goal-shaped collection of notes | `<module>/module.md` (the manifest) + `items/` (notes) + `staged/` (pending changes) |
| **project** | the home for one repo | `.zuzuu/` (git-citizen, at the repo root) |

A **module is generic** — it differs from another only by its `module.md` manifest, which declares its `note_type`, a `goal`, and which **capabilities** it exposes. There is no per-module code: adding a module is dropping a `module.md` in.

A **runnable note** carries a `run` (and an optional `policy` with a `run.allow` allowlist) — that's how `zz act` executes a curated procedure. See [[Knowledge]] and [[Guardrails]] for typed examples.

## A module is a table (optional schema)

Think of a module as a **table** and each note as a **row**. A module's `module.md` can declare a typed-column **schema** — a `fields` block naming each column and its type (one of the eight: `text`, `longtext`, `select` with a fixed option list, `multi`, `link`, `date`, `number`, `bool`) and whether it's required:

```yaml
fields:
  - { name: status,  type: select, options: [open, done], required: true }
  - { name: due,     type: date }
  - { name: effort,  type: number }
```

When a schema is present, **every note in the module is validated against it** — a write with the wrong type or a missing required field is **rejected at the review gate**, so the table stays clean. Declare no schema and the module is **schemaless** — any column is allowed, fully flexible (the default). The [[Workbench]] grid renders typed inputs (a dropdown for `select`, a date picker, …) for any module that declares a schema.

```bash
zz module schema <m>                 # view a module's columns
zz module add-column <m> <name> <type> [--required] [--options a,b]
zz module alter-column <m> <name> [--type t] [--required] [--options a,b]
zz module drop-column <m> <name>
```

## Inspect it
```bash
zz module list                       # the modules + their capabilities
zz query <module> [text]             # search notes (FTS + a typed link graph)
zz check [module]                    # integrity: broken links · orphans · stale
```

## Generations are per-module

Each module owns its **generation** lineage — approving a proposal advances *that* module, independent of the others. Rollback restores note bytes exactly by flipping a pointer — never a `git revert`; roll the whole brain back by rolling each module.

```bash
zz gen list <m>                      # the lineage (● = active)
zz gen rollback <m> <n>              # restore a pinned moment
```
*(The older `zz module <m> generations|rollback` forms still work as aliases.)*
