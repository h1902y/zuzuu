# Session Waves 2/3 — remainder (W2c + Wave-3) — design

Status: DESIGN ONLY. No structural code lands with this doc. The companion
characterization test
(`tests/unit/session-git-single-branch.characterization.test.mjs`) pins the
current single-working-branch invariant so any Wave-3 redesign trips a loud,
conscious failure.

Scope of this doc:

- **W2c** — guardrail badge ("which rule paused this session") + "why it
  paused" (last tool / agent message), surfaced per session.
- **Wave-3 concurrency** — why one working tree cannot hold two sessions, and
  the per-session-worktree change that fixes it.
- **Compare-sessions** — git diff between two sessions' branches/commits.
- **Rollback-to-any-turn** — map a turn to its checkpoint commit and restore.

Every claim below carries file:line evidence from the current tree.

---

## 1. W2c — guardrail badge + "why it paused"

### What already exists (good news: a per-session decision log is already written)

The guardrails gate already records every *matched* decision to a
**per-session JSONL log**. This is the load-bearing fact for W2c — we do **not**
need to add capture, only surface it.

- Gate entry point: `gateDecision()` in
  `zuzuu/commands/hook.mjs:169`. It loads rules
  (`zuzuu/commands/hook.mjs:175`), evaluates the call
  (`zuzuu/commands/hook.mjs:177`), and on a non-null verdict appends a line to
  the per-session log (`zuzuu/commands/hook.mjs:179-187`).
- Log path + record shape: one file per session,
  `.zuzuu/.live/guardrails-<sessionId>.jsonl`
  (name built by `guardrailsLogName()`, `zuzuu/commands/hook.mjs:139-142`;
  written at `zuzuu/commands/hook.mjs:182-185`). Each line is:

  ```json
  { "at": "<ISO>", "host": "claude-code", "tool": "Bash",
    "action": "deny|ask", "rule": "<rule-id>", "reason": "<rule reason>" }
  ```

  (`action`/`rule`/`reason` come from `evaluate()`'s verdict —
  `zuzuu/guardrails/engine.mjs:104-115`.)
- The log lives under `.zuzuu/.live/` — a zuzuu observability internal (the
  agent is told NOT to read it; CLAUDE.md "Do not read .zuzuu/.live"), so any
  surfacing must go through a CLI/daemon reader, not by the agent tailing it.

So the BADGE ("a guardrail fired in this session, rule = X") and the COUNT are
**already fully captured** — every `action:"deny"`/`"ask"` line names its rule.

### What does NOT exist yet

1. **No reader/aggregator.** Nothing reads `guardrails-<id>.jsonl` back. There
   is no `sessionDiffData`-style function for guardrail decisions. (Grep:
   `guardrails-`/`jsonl` appear only at the write site in
   `zuzuu/commands/hook.mjs`; no read site under `zuzuu/commands/` or the
   daemon's `zuzuu-routes.ts`.)
2. **"Why it paused" — the last tool / agent message — is NOT in the
   guardrail log.** The JSONL line carries `tool` and the *rule's static
   `reason`*, but **not** the actual tool input that tripped it, nor the agent's
   surrounding message. That context lives in the captured transcript, not the
   gate log. So "why paused" needs a *join*, not a new log field.
3. **No per-session linkage in the index.** `evaluate()` only emits
   `{action, rule, reason}` (`zuzuu/guardrails/engine.mjs:111`); the session
   index (`.zuzuu/sessions.json`) does not record a guardrails summary.

### Proposed surfacing (minimal, additive)

**A. Reader (CLI-first, pure-ish):** add
`sessionGuardrailsData(cwd, idArg)` next to `sessionDiffData`
(`zuzuu/commands/sessions.mjs:489`). It:

   - resolves the session record via `matchSession`
     (`zuzuu/commands/sessions.mjs:483`),
   - reads `.zuzuu/.live/guardrails-<sessionId>.jsonl` (fail-soft: missing
     file → `{ available:false, fired:0, decisions:[] }`),
   - returns
     `{ sessionId, available, fired, byRule: {<ruleId>:count}, lastDecision }`,
     where `lastDecision` is the most-recent line (the badge's headline: rule +
     tool + ISO time).

   The badge = `fired > 0` plus `byRule` (which rule fired, how often);
   `lastDecision.rule` is the one to show on the card chip.

**B. "Why it paused" — join to the transcript.** For the deny/ask that paused
   the run, take `lastDecision.{tool, at}` and find the matching turn in the
   captured session content. We already have the pieces:

   - `sessionContentData` / `sessionInspectData`
     (`zuzuu/commands/sessions.mjs:388`, `:275`) expose the transcript nodes,
   - `fileAuthorsFromNodes` (`zuzuu/commands/sessions.mjs:556`) is the existing
     precedent for "match a captured node to a fact". A sibling
     `lastAgentMessageBefore(nodes, isoTime)` returns the agent text + the
     tool-call args nearest (and at/just-before) `lastDecision.at`.

   "Why it paused" string = `<rule reason>` (from the log) + `<the tool input
   that matched>` + `<the agent's last message>` (from the transcript join). The
   rule's static reason answers "what policy", the transcript join answers "what
   the agent was trying to do".

**C. Daemon + UI.** Add `GET /session-guardrails/:id` to `zuzuu-routes.ts`
   mirroring the existing `GET /session-diff/:id`
   (`web/packages/daemon/src/zuzuu-routes.ts:397`) — CLI-first via `runZuzuu`
   (`web/packages/daemon/src/zuzuu-routes.ts:20`,`:315`). The web client adds a
   method beside `sessionDiff` (`web/packages/web/src/lib/zuzuu-api.ts:83`).
   The session card (`web/packages/web/src/components/SessionCards.tsx`, logic in
   `web/packages/web/src/lib/session-cards.ts`) gains a guardrail chip: a small
   shield badge when `fired > 0`, label = `lastDecision.rule`, hover/expand =
   the "why it paused" string.

**If we wanted "why" without a transcript join** (smaller, but lossy): add the
matched `tool_input` (redacted) into the JSONL line at the write site
(`zuzuu/commands/hook.mjs:184`). That captures *what the tool was about to do*
at decision time without needing the transcript, but loses the agent's framing
message. Recommendation: do the transcript join (B) — the data is already
captured; only a reader is missing.

---

## 2. Wave-3 — true concurrent sessions need per-session git worktrees

### Why one working tree cannot hold two sessions (the hard wall)

A git working tree has exactly one checked-out branch (one `HEAD`). zuzuu's
model is "one agent session = one `zz/session-*` branch", and `openSession`
enforces a **single-working-branch invariant**: at most one `zz/session-*`
branch may exist at a time.

- The contract is stated in the module header:
  `zuzuu/sessions/session-git.mjs:14-16` ("single-working-branch invariant: at
  most ONE `zz/session-*` branch; a leftover ... BLOCKS new session branches").
- It is enforced in `openSession`: if any `zz/session-*` branch already exists,
  a second open is refused —
  `zuzuu/sessions/session-git.mjs:142-143`:

  ```js
  const existing = listSessionBranches(cwd);
  if (existing.length) return { ok: false, blocked: true, existing: existing[0] };
  ```

- The existing regression pins this ("a second open is blocked, never a second
  branch", `tests/unit/session-git.test.mjs:123-132`), and our new
  characterization test pins it explicitly as the concurrency wall
  (`tests/unit/session-git-single-branch.characterization.test.mjs`).

So even setting the invariant aside, two sessions checking out two branches in
ONE working tree is physically impossible — the second `checkout -b` would move
`HEAD` away from the first session's work. Checkpoints also depend on being *on*
the session branch: `checkpoint` refuses unless `currentBranch` starts with the
`zz/session-` prefix (`zuzuu/sessions/session-git.mjs:201-202`). Two live
sessions would fight over `HEAD` and clobber each other's checkpoints.

The single-active-agent rule in the workbench exists **precisely because** of
this wall: `startAgentSession` focuses the already-alive agent instead of
spawning a second (`web/packages/web/src/lib/agent-launch.ts:38-43`):

```js
const alive = s.tabs.find((t) => t.type === "agent" && t.alive);
if (alive) { s.setActive(alive.id); ...; return; }
```

That UI rule is a *symptom* of the git wall, not an independent product choice.
Removing it without per-session worktrees would immediately hit the
`openSession` block (`zuzuu/sessions/session-git.mjs:143`).

### The fix: one git worktree per session (`git worktree`)

`git worktree add` gives each session its OWN working directory with its OWN
`HEAD`, all backed by the SAME `.git` object store. N sessions = N worktrees =
N independent `zz/session-*` checkouts, no `HEAD` contention.

Sketch (NOT implemented here):

- **session-git.mjs.** Add a worktree-aware open path, e.g.
  `openSessionWorktree(repoRoot, sessionId)`:
  - compute `branch = sessionBranchName(sessionId)`
    (`zuzuu/sessions/session-git.mjs:78`),
  - `git worktree add <worktreeDir> -b <branch> <base>` instead of
    `checkout -b` (`zuzuu/sessions/session-git.mjs:144`),
  - record `zz-base` on the branch as today
    (`zuzuu/sessions/session-git.mjs:146`),
  - the worktree dir is the session's cwd; checkpoint/close run *in that
    worktree's cwd* — `checkpoint`/`closeSession` already take `cwd` and use
    `currentBranch(cwd)`, so they mostly work unchanged once cwd is the
    worktree. Close must `git worktree remove` after the squash-merge (replacing
    the `branch -D` at `zuzuu/sessions/session-git.mjs:334`).
  - The single-branch invariant must change to **single-branch-per-worktree**
    (each worktree still holds exactly one session branch; the *repo* holds N).
    `listSessionBranches` (`zuzuu/sessions/session-git.mjs:84`) becomes
    repo-wide and the block in `openSession`
    (`zuzuu/sessions/session-git.mjs:143`) must scope to "this worktree" — this
    is the change the characterization test will flag.
- **Daemon.** Each agent session already spawns its host with a `cwd`
  (`Session` constructor takes `cwd`, `web/packages/daemon/src/sessions.ts:132`;
  the close hook runs once at exit, `:86`,`:223`). Wave-3 = create a worktree
  dir per session, spawn the host with that cwd, and run `closeSession` against
  it in the `onClose` hook (`web/packages/daemon/src/sessions.ts:89`).
- **UI.** Lift the single-active block
  (`web/packages/web/src/lib/agent-launch.ts:38-43`) to allow N alive agent
  tabs once worktrees back them; the merge-story end card
  (`web/packages/web/src/term/TermView.tsx`,
  `web/packages/web/src/components/SessionCards.tsx`) is already per-session via
  `closeResult` (`web/packages/daemon/src/sessions.ts:109`,
  `web/packages/daemon/src/server.ts:201-202`).

**Safety review required (Wave-3 is the highest-risk change in the project):**
worktree cleanup on crash (orphan worktrees), disk-space (each worktree is a
full checkout — consider `--no-checkout` / sparse for huge repos), the secrets
exclusion (`SECRET_GLOBS`, `zuzuu/sessions/session-git.mjs:155`) must hold per
worktree, and the MERGE_HEAD/operation-in-progress freeze
(`zuzuu/sessions/session-git.mjs:41`) must be evaluated per worktree, not
repo-wide. Ship behind a flag; keep single-active as the default until proven.

---

## 3. Compare-sessions — git diff between two sessions

We already resolve ONE session to a base/tip range; comparing two sessions is a
second range resolution plus a diff between the two tips.

- Range resolution exists: `resolveDiffRange(cwd, s)`
  (`zuzuu/commands/sessions.mjs:438-449`) returns either
  `{kind:'branch', base:<main>, tip:<zz/session-*>}` (live/leftover) or
  `{kind:'commit', base:<commit~1>, tip:<commit>}` (merged/past, from the
  recorded `s.git.commit`). `sessionDiffData`
  (`zuzuu/commands/sessions.mjs:489-515`) wraps it into numstat + name-status.

### Sketch

- **CLI/data:** `sessionCompareData(cwd, idA, idB)`:
  - resolve each side with `resolveDiffRange` (reuse as-is),
  - the comparison tip for each side is `range.tip` (a branch name for live, a
    commit sha for past),
  - diff the two tips: `git diff <tipA>...<tipB>` (three-dot = changes from
    their merge-base, the natural "what differs between these two pieces of
    work"). Reuse `parseNumstat`/`parseNameStatus`
    (`zuzuu/commands/sessions.mjs:458`,`:471`) and the per-file unified-diff
    path (`sessionFileDiffData`, `zuzuu/commands/sessions.mjs:518`, with its
    `MAX_FILE_DIFF` cap, `:435`).
  - Edge cases to specify: one or both ranges unresolvable
    (`{available:false}`); both sessions merged to the same main (their tips are
    commits — `<commitA>...<commitB>` still works); a session that left no
    branch and no recorded commit (unresolvable, surface honestly).
- **Daemon:** `GET /session-compare/:a/:b`, CLI-first, mirroring
  `GET /session-diff/:id` (`web/packages/daemon/src/zuzuu-routes.ts:397`).
- **UI:** a two-session picker on the sessions list; render with the existing
  diff viewer used for `sessionDiff`
  (`web/packages/web/src/lib/zuzuu-api.ts:83`).

**Safety:** read-only (diff only) — low risk. The only sharp edge is
three-dot vs two-dot semantics; pick three-dot and document it (matches
`sessionDiffData`'s existing `base...tip`,
`zuzuu/commands/sessions.mjs:454`).

---

## 4. Rollback-to-any-turn — map a turn to its checkpoint commit, restore

Each TURN produces a checkpoint commit on the session branch
(`checkpoint` → `git commit -m "zz: checkpoint N"`,
`zuzuu/sessions/session-git.mjs:212`). So turn N ↔ the commit titled
`zz: checkpoint N`. Rollback = restore the worktree to that commit.

### Sketch

- **Mapping (turn → commit):** enumerate the session branch's checkpoint
  commits. `countCheckpoints` already counts them
  (`zuzuu/sessions/session-git.mjs:122-128`, `git rev-list --count
  main..branch`). A `listCheckpoints(cwd, branch)` returns
  `[{ n, sha, at }]` from `git log --format=... main..branch` filtered to the
  `zz: checkpoint <n>` subjects. The trace-linked turn data
  (`sessionFileAuthorsData`, `zuzuu/commands/sessions.mjs:585`;
  `fileAuthorsFromNodes`, `:556`) gives the UI the human-readable turn labels to
  hang each commit on.
- **Restore (the dangerous part):** rolling back to checkpoint K while ON the
  session branch. Two flavors, both must be explicit + gated:
  - **soft (recommended default):** `git revert --no-commit <K+1..HEAD>` then a
    new checkpoint — preserves history (nothing destroyed silently — same
    principle as the empty-squash-with-checkpoints branch-keep,
    `zuzuu/sessions/session-git.mjs:318-324`).
  - **hard:** `git reset --hard <commit K>` — destroys checkpoints K+1..N.
    Must require an explicit `--yes`, mirroring `discardSession`'s gate
    (the CLI refuses discard without `--yes`, `zuzuu/commands/session.mjs:90-93`).
  - Either way: refuse on a dirty worktree (reuse the `userDirty` gate concept,
    `zuzuu/sessions/session-git.mjs:182`) and never touch the worktree mid
    operation-in-progress (`zuzuu/sessions/session-git.mjs:41`).
- **CLI:** `zuzuu session rollback <n> [--hard --yes]`, slotting beside the
  existing `merge`/`continue`/`discard` subcommands
  (`zuzuu/commands/session.mjs:65`,`:82`,`:90`).
- **Daemon:** `POST /session/:id/rollback` via `runZuzuuMut`
  (`web/packages/daemon/src/zuzuu-routes.ts:20`,`:331`), like the other
  mutating session routes.
- **UI:** the turn list (built from the trace + checkpoint map) gets a "roll
  back to here" action; default soft, hard behind a confirm dialog.

**Safety review required:** rollback MUTATES the user's repo. Hard reset can
lose work; it must be `--yes`-gated and dirty-refusing, must only ever act on
`zz/session-*` branches (never main — same guard as `checkpoint`'s
`not-on-session-branch` refusal, `zuzuu/sessions/session-git.mjs:202`), and
should be added with its own characterization tests in a hermetic tmp repo
(mirror `tests/unit/session-git.test.mjs`) before any UI wiring. Prefer soft
revert as the only shipped path in v1; gate hard reset behind a flag.

---

## Dependency order

1. **W2c** first — purely additive (a reader + a chip), no git mutation, lowest
   risk, immediate user value.
2. **Compare-sessions** — read-only, reuses range resolution.
3. **Rollback (soft only)** — mutating but history-preserving; needs hermetic
   tests.
4. **Wave-3 worktrees** — last and behind a flag; the structural change the
   characterization test guards. The single-active UI rule
   (`web/packages/web/src/lib/agent-launch.ts:38-43`) lifts only here.
