# Troubleshooting

**Start with `zz doctor`** — it checks Node, git, the `.zuzuu/` home, integrity (broken links), detected hosts, whether the hooks are installed, and surfaces a crashed session's leftover branch (the recovery path).

| Symptom | Cause / fix |
|---|---|
| `no host detected` | No supported agent has data on this machine. Use one once (in any project), then retry. |
| `zz observe` finds no sessions for this repo | The agent must have run *in this project* at least once (Claude scopes transcripts by directory). `zz status` shows what's visible. |
| `zz observe` proposed nothing | Proposals are **corroboration-gated** — a command must recur (≥3× across ≥2 sessions), a file ≥5 touches. One sighting proposes nothing. Keep working, then re-run. |
| A session is stuck / its branch is left over | A killed terminal emits no end signal. `zz doctor` surfaces the leftover `zz/session-*` branch; recover with `zz session resume \| land \| drop` (the old `continue \| merge \| discard` still work). |
| Guardrail didn't block | Rules **fail open** by design: check the rule note parses (`zz check`), the `tool` matches, and the pattern hits the tool *input*. Matched decisions log to a per-session guardrails trail in your XDG state dir (outside the repo), not inside `.zuzuu/`. Note the gate is currently installed for **Claude Code** (`zz host enable`); other hosts are observe-only for now (see [[Roadmap]]). |
| `zz query` returns nothing for a known note | The index rebuilds on file change; if a write kept the same mtime+size it may lag — touch the file or re-run. `zz check` reports broken links/orphans. |
| Node errors reading OpenCode sessions | Node ≥ 22 required (`node:sqlite`). |
| `zz act` refused a command | The guardrails gate denied it, or it failed the `run.allow` allowlist (an absolute path outside the repo is denied by design). The error names which. |
| The model refused before the gate saw the tool call | Some models self-censor — that's the model, not zuzuu. Confirm the gate with a rule the model won't pre-refuse; real blocks log to the guardrails trail in your XDG state dir (outside the repo). |

Still stuck? [Open a bug](https://github.com/h1902y/zuzuu/issues/new/choose) with `zz doctor` output.
