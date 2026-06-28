# Host guide — Claude Code

**The richest host, and the verified one.** Everything works here.

| Capability | State |
|---|---|
| observe (mine sessions) | ✅ rich — commands · files · failures · 2-gram sequences · corrective turns · destructive failures |
| lifecycle hook | ✅ `SessionStart` / `Stop` / `SessionEnd` (`zz host enable`) |
| guardrails gate | ✅ `PreToolUse` — deny/ask before the tool runs |

## How observe works (Design B)
Claude Code writes transcripts to `~/.claude/projects/<encoded-cwd>/<sessionId>.jsonl`. `zz observe` **re-parses that transcript** (it never drives the agent): `tool_use` blocks pair with `tool_result` by id, so a failed `Bash` is tagged, files touched by Read/Write/Edit are mined, and corrective user turns ("no, don't… / always…") are flagged. Recurring signals across sessions become proposals you review.

## Live mode (`zz host enable`)
Writes a hook block into `.claude/settings.json` (tagged `#zz-hook`, idempotent, removable with `zz host disable`). Every hook command ends `|| true` — if zuzuu is ever missing, your agent is unaffected. It adds **no** settings-level deny rule: zuzuu's run-state + gate log live outside the repo (in your XDG dirs), so there's nothing inside `.zuzuu/` to self-deny, and the brain's write-protection is instead carried by the seeded guardrail rules (the note folders stay readable). On a session: **OPEN** grounds (writes the digest) + opens the session branch; **TURN** checkpoints; **END** holds the branch for the merge gate (`zz session land` to land it — or set `"autoMerge": true` in `.zuzuu/agent.json` to land on exit as before) + runs `observe`. *(`zz enable` / `zz disable` / `zz session merge` still work as aliases.)*

## Worth knowing
- `Stop` fires **per turn**, not at session end; `SessionEnd` is the real end.
- A killed terminal emits nothing — `zz doctor` surfaces the leftover session branch (the recovery path), and `zz observe` still mines the transcript on disk.
