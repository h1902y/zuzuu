# Research: Opinionated git commits + sessions — semantic episode boundaries, the Jujutsu verdict

> Persisted prior-art research synthesis (workflow `wf_46a2337d-e9b`). Background reasoning for the zuzuu redesign specs — not canon. Source-of-truth decisions live in `docs/specs/`.

---

This is a synthesis task — I have all 8 research angles in the prompt. Let me produce the design brief directly.

# Opinionated-Commit + Session-Management Model for zuzuu
## A design brief — semantic episode boundaries, and the Jujutsu verdict

---

## 1. Core verdict: semantic boundaries win, and a typed commit IS the episode

**Yes — replace the every-20-turns mechanical cut.** An opinionated commit (one logical unit of work + a typed/scoped message) can *be* the episode boundary and *be* the summary. Across all eight angles the prior art converges on one principle: **semantic episode boundaries are declared, not detected.** Every production pattern — jj intent-capture, GitButler named virtual branches, [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) type prefixes, gated/green-build commits, [stacked diffs](https://graphite.com/guides/stacked-diffs) — requires the agent to *name the unit of work* before/during it; tooling then enforces or curates the boundary. Auto-detecting task switches from file-set cohesion alone is unvalidated and expensive (no production tool does it).

**The recommended boundary signal is a two-tier declared signal, not a single heuristic:**

- **Primary (highest confidence): green-build / passing-test gate.** A green build after a red sequence is the cheapest locally-checkable signal that carries genuine semantic weight — binary, no NLP, no LLM ([gated commits](https://dev.to/david_ojeda/gated-commits-with-git); RGRC). zuzuu should record `Zz-Tests: green|red` in each checkpoint and treat *first-green-after-red* as the strongest episode-cut anchor. **Soft, not hard:** a session must still proceed if tests are red (many coding sessions never go green); log the state, don't block.
- **Secondary (label): Conventional-Commit landing.** When the agent declares `feat(scope): …` or `refactor(scope): …` (a new type/scope after a run of `fix:`/`chore:`), that declaration *is* the episode boundary, and the subject line *is* the episode title the enhance step reads with zero parsing. The one-sentence atomic test ([atomic-commit definition](https://medium.com/@sandrodz/a-developers-guide-to-atomic-git-commits-c7b873b39223)) is the completeness gate: *if the change can't be described in one sentence without "and," split it.*

**Fallback when no clean signal fires** (the long, never-closed, multi-day session — the real-world common case): keep the **mechanical cut as a last resort only**, but enrich it. Use the per-turn **intent sidecar** ([Ian Bull jj plan-apply-curate](https://ianbull.com/posts/jj-vibes/)): at each turn write `.zuzuu/.live/intent-<turn>.md` capturing the agent's stated goal (git-ignored). The idle-gap *between intent files* becomes a far better task-switch proxy than raw clock time, and the intent text is the raw material the enhance step summarizes — the agent already wrote the "why," so no post-hoc summarization is needed. Optionally gate the mechanical cut on a structural signal (entity-diff threshold via [sem](https://github.com/Ataraxy-Labs/sem) as an `optionalDependency`) so even the fallback cut lands at a code-structure boundary, not mid-thought.

> Net: episode = *declared logical unit*, anchored by green-build where available, labeled by the Conventional-Commit type/scope, and only mechanically cut (intent-file-gap + entity-threshold) when the agent never closes the unit cleanly.

---

## 2. Jujutsu verdict: BORROW THE PATTERNS over plain git; jj is OPTIONAL-DETECT, never a core dep

[Jujutsu (jj)](https://github.com/jj-vcs/jj) maps almost 1:1 onto zuzuu's hand-rolled machinery, and that's exactly why it's tempting — and exactly why the dependency is wrong for the core:

| zuzuu need | jj primitive | verdict |
|---|---|---|
| per-turn checkpoint | [working-copy-as-commit](https://docs.jj-vcs.dev/latest/working-copy/) — every command auto-snapshots; no `git add`/`commit` | **borrow the model** |
| session journal + crash recovery (doctor) | [operation log](https://docs.jj-vcs.dev/latest/operation-log/) — every op recorded, `jj undo`/`op restore` any state; crash leaves repo at last op | **borrow the model** |
| episode identity surviving squash | [change-ID](https://docs.jj-vcs.dev/latest/tutorial/) — stable UUID in commit extras, survives amend/rebase while SHA churns | **borrow as plain-git trailer** |
| concurrent sessions (Wave B worktrees) | [workspaces](https://www.joshualyman.com/2026/02/demystifying-jujutsu-jj-workspaces/) — sibling dirs, shared history, no single-working-branch invariant | borrow *if* jj present |
| lost-file recovery | [evolog/obslog](https://docs.jj-vcs.dev/starlight/guides/divergence/) — recovers deletes never sealed in a commit | use *if* jj present |
| semantic episode sealing | [jj squash/split](https://ianbull.com/posts/jj-vibes/) plan-apply-curate | borrow the lifecycle |

**The hard blocker:** jj is **pre-1.0 (v0.42.0, June 2026), Apache-2.0, ~30k stars, with near-every-release CLI breaking changes**, and it's a **Rust binary** — adding it as a hard dep violates zuzuu's zero-runtime-dep core guarantee and would break on CLI churn. It also cannot run in non-colocated mode without breaking the user's existing git tooling/CI/GitHub (zuzuu is a transparent git-citizen of the host repo).

**Concrete decision — three-part:**

1. **Reimplement jj's two load-bearing patterns over plain git (default path, zero dep):**
   - *Change-ID → trailer.* Write a stable `Zz-Episode-Id: <uuid>` footer on every turn-checkpoint commit (the [Gerrit Change-Id](https://gerrit-review.googlesource.com/Documentation/user-changeid.html) convention, 15-year proven, ~2 lines in a `prepare-commit-msg` hook). Carry it forward into the squash commit. This solves episode-identity-after-squash with no binary.
   - *Operation log → append-only ops ledger.* Structure `doctor` recovery to read an append-only `.zuzuu/.ops.jsonl` (open/turn/end entries) rather than inferring from transcript. This is the op-log pattern ported to JSON; the journal becomes the source of truth, transcript-parse becomes the fallback.
2. **Detect jj at runtime as an opt-in accelerator** (`which jj`): if present, `jj git init --colocate` (idempotent, no migration ceremony), use `jj workspace add` for Wave B, `jj op log`/`jj evolog` for recovery, `jj squash`/`split` for episode sealing, and add `[[ -d .jj ]] && jj status` to SessionStart/PreCompact hooks for free snapshots at high-risk moments. Pin the version; never parse output without a version check.
3. **Don't depend on it, don't fork it, don't drive it.** Same posture zuzuu already takes with hosts.

> Trade-off in one line: hand-rolling turn-checkpoints + ledger recovery is ~200 lines of `node:child_process` shell-out you fully control and that never breaks; depending on jj buys a richer recovery story (evolog) at the cost of a pre-1.0 Rust binary churning under you. **Hand-roll the patterns; use jj only where it's already installed.**

---

## 3. Recommended commit model for agent turns

**Cadence: per-turn checkpoint (safety) + per-unit-of-work episode (meaning) — two timescales, two data models, never conflated.**

- **Per-turn checkpoint = the industry convergence point.** [Aider](https://aider.chat/docs/git.html) commits once per turn (per LLM response, covering all edits from that turn — *not* per file edit), and [GitHub Copilot's coding agent](https://github.blog/news-insights/product-news/github-copilot-meet-the-new-coding-agent/) commits per plan-step into a draft PR. One LLM response cycle = one turn-checkpoint commit. This aligns commit granularity with the unit of *intent* naturally.
- **Stage only the turn's touched files** — never `git add -A`. This is a documented failure mode ([Codex issue #8548](https://github.com/openai/codex/issues/8548) stages unrelated files). Drive staging from the turn's file-change manifest.
- **Commit atomically *after* the turn's tool calls complete, never mid-tool-call** — [Cordon](https://arxiv.org/html/2606.17573v1) formalizes why: mid-turn commits capture half-applied state.

**Reconciling thousands-of-safe-checkpoints with a-few-clean-episodes — the WIP-then-squash answer (git-native, zero dep):**

The git community already solved this exact tension: *commit freely for safety, present cleanly for meaning.* The canonical mechanism is [`git commit --fixup` + `git rebase --autosquash`](https://blog.gitbutler.com/git-autosquash) (git ≥ 1.7.4, GPLv2, zero dep):

1. Turn-checkpoints commit with a `fixup!` prefix keyed to the nearest semantic anchor (or a simple `chk:`/`zz: turn-N` prefix scannable like [git-wipsquash](https://blog.charlesdesneuf.com/articles/a-clean-commit-history-with-git-wipsquash/)).
2. At a semantic boundary (§1), the accumulated checkpoints autosquash into **one episode commit per logical unit**.
3. Run non-interactively in the daemon: `GIT_SEQUENCE_EDITOR=true git rebase --autosquash` (interactive `-i` opens an editor and blocks a daemon — avoid).
4. **Enable `git config rerere.enabled true`** in the session branch at init: the rebase over many checkpoints hits repeated conflict hunks (e.g. `package.json` version lines); [rerere](https://git-scm.com/docs/git-rerere) auto-replays resolutions. One config line, pure correctness win.
5. **Keep checkpoints on a hidden/shadow branch** until the squash succeeds (the [ckpt](https://dev.to/moo_moo_5f1e2b4306785a535/i-built-ckpt-automatic-checkpoints-for-ai-coding-sessions-44gl) model) so a mid-rebase failure can't lose data — zuzuu's `zz/session-*` branch already is this.

**If jj is present**, this entire dance collapses: jj auto-snapshots every turn (no explicit checkpoint commits at all), and `jj squash`/`split` at close produces the clean episodes directly. That's the accelerator payoff.

**Message generation.** The squash/episode commit message is the durable artifact. Mandate Conventional-Commits header + a **WHY-not-WHAT body** structured as [`what / why / tried / next`](https://dev.to/henrywangxf/using-git-commits-as-claude-codes-memory-48e3): the diff already says *what*; the body records rationale, the `tried` field (rejected alternatives — the highest-signal input for the enhance step's proposals), and `next` (seed for the next session's digest). Turn-checkpoint messages can stay terse (`chk: <brief>`, `--no-verify`). If LLM-assisted messages are ever added, use the bounded three-stage pipeline (summarize-diff → title → format) from [CodeGPT](https://github.com/appleboy/CodeGPT), not one-shot — but zuzuu's own digest/summary is usually sufficient and needs no extra dep.

---

## 4. Git-native session/episode metadata: **trailers, not notes**

**Verdict: git trailers are the right and effectively only viable primary store.** Trailers travel with the commit message through rebase, amend, cherry-pick, **and squash** — because they *are* the message ([git-interpret-trailers](https://git-scm.com/docs/git-interpret-trailers), git core, zero dep).

**git notes have a fatal gap for zuzuu specifically:** `git merge --squash` does **not** trigger `notes.rewrite`, so any enhance-status or episode metadata written to [git notes](https://git-scm.com/docs/git-notes) *before* the session-close squash is silently orphaned — and zuzuu's session close *is* a squash. Notes also require explicit `fetch = refs/notes/*:refs/notes/*` config on every clone/CI, invisible by default (and unrendered in GitHub/GitLab UI). Avoid notes as the primary store.

| field | mechanism | survives squash? |
|---|---|---|
| `Zz-Session: <id>` | trailer, injected at checkpoint via `prepare-commit-msg` hook (Gerrit model) | ✅ (carry into squash msg — zuzuu controls the squash command) |
| `Zz-Episode: <uuid>` | trailer (the change-ID port) | ✅ |
| `Zz-Tests: green\|red` | trailer (boundary signal, §1) | ✅ |
| `Zz-Remember: <slug,…>` | trailer (what-to-remember) | ✅ |
| `Zz-Enhance: pending\|done\|skip` | trailer | ✅ |
| `Zz-Rejected / Zz-Constraint / Zz-Directive` | trailers ([Lore](https://arxiv.org/html/2603.15566v1) vocabulary) | ✅ |

Where notes are *appropriate*: **post-squash, post-merge annotations** that don't need squash-survival — e.g. stamping the merged-into-main commit with enhance results *after* the merge, or attaching bulky raw turn transcripts out-of-tree under `refs/notes/zuzuu` ([Memento](https://github.com/mandel-macaque/memento) pattern, MIT — keeps `git log` clean, not cloned by default).

**Extraction at enhance time is pure shell, no DB, no tooling:**
```
git log --format='%H%x09%s%x09%(trailers:key=Zz-Episode,valueonly)' <session-range>
```
[release-please](https://github.com/googleapis/release-please) (Google, Apache-2.0) proves at scale that pure git-log trailer-scanning is production-viable — *the git log IS the episode index*. The [Lore protocol](https://arxiv.org/html/2603.15566v1) (arXiv 2603.15566, March 2026) is an **unvalidated preprint with no working code** — borrow its `Rejected/Constraint/Directive` field *names* as inspiration only; the real prior art is native trailers, not Lore.

---

## 5. Adopt / Adapt / Avoid (mapped to zuzuu)

**ADOPT (zero-dep, git-native, do now):**
- **Conventional-Commits** typed/scoped messages on episode commits — `feat(knowledge)`, `refactor(session)`, `fix(guardrails)`; the type is a free episode classifier (the enhance step prioritizes `feat`/`fix` for distillation, defers `chore`/`docs`/`test` — the [semantic-release](https://github.com/semantic-release/semantic-release) type-significance map, ~10 lines, not the 40-dep package).
- **`fixup!` + `--autosquash` + `rerere`** for turn-checkpoint → clean-episode compression (`session-git.mjs` session-close path; `GIT_SEQUENCE_EDITOR=true`; shadow-branch-protected).
- **Trailers** (`Zz-Session`, `Zz-Episode`, `Zz-Tests`, `Zz-Remember`, `Zz-Enhance`) injected via `prepare-commit-msg` hook; carried into the squash commit (zuzuu owns the squash, so it writes them directly).
- **`what/why/tried/next` body** on episode/squash commits — git history becomes the memory surface the next digest reads (`git log -5 --format='%s%n%b'`).
- **green-build trailer** as the primary boundary signal (§1); **intent sidecars** in `.zuzuu/.live/` as the fallback signal + enhance raw material.
- **Append-only `.zuzuu/.ops.jsonl`** as `doctor`'s journal (op-log pattern ported to git); transcript-parse becomes the fallback, not the primary.

**ADAPT (opt-in, detect-don't-depend):**
- **jj** as a runtime-detected accelerator: colocated init, workspaces for Wave B concurrency (replaces the single-working-branch invariant), `op log`/`evolog` for richer recovery, `squash`/`split` for episode sealing, snapshot hooks. Plain-git remains the default everywhere.
- **[sem](https://github.com/Ataraxy-Labs/sem)** (entity-level diff, npm-distributed Rust binary) as an `optionalDependency` for the structural episode-boundary signal in the fallback path only.
- **[ckpt](https://dev.to/moo_moo_5f1e2b4306785a535/i-built-ckpt-automatic-checkpoints-for-ai-coding-sessions-44gl)'s `try`** concept (branch a speculative experiment mid-session → `zz session try <label>`) — borrow the idea, not the package.
- **[git --update-refs](https://andrewlock.net/working-with-stacked-branches-in-git-is-easier-with-update-refs/)** (git ≥ 2.38, zero dep) + **stacked-diffs mental model** *if/when* zuzuu moves to per-episode branch stacks for multi-day cross-session consolidation (one branch-layer per day/sub-task; the branch name + Conventional-Commit message *is* the cross-day narrative, no NLP).

**AVOID:**
- **jj/Sapling/git-branchless as hard deps** — pre-1.0 / heavy Python / Rust binaries; break the zero-dep core.
- **[ghstack](https://github.com/ezyang/ghstack) / [spr](https://github.com/ejoffe/spr)** — require live GitHub + PR creation; violate local-first.
- **git notes as the *primary* metadata store** — squash-merge orphans them (zuzuu's exact close gesture).
- **`git add -A`** ([Codex bug](https://github.com/openai/codex/issues/8548)) and **deferring commit cadence to the host agent's self-assessment** ([Claude Code's unpredictable auto-commit/push](https://bleepingswift.com/blog/claude-code-auto-commit)) — the session-git layer must OWN cadence externally, driven by hook signals.
- **gitmoji** as the primary type system — emoji-first messages parse inconsistently across terminals and double-prefix when stacked with Conventional Commits; map type→emoji at render time in the workbench UI instead.
- **One giant session commit** — destroys per-episode granularity; the enhance step gets one structureless diff.
- **Interactive `rebase -i`** in the daemon — blocks on an editor.

---

## 6. Open risks

1. **We OBSERVE the host; we may not control how/when it commits.** This is the deepest tension. The entire opinionated-commit model assumes zuzuu's session-git layer owns the commit cadence — but zuzuu's stated posture is *wrap, serve, observe, evolve a host we never drive*, and hosts auto-commit unpredictably ([Claude Code commits + pushes 4× unprompted, uncontrolled](https://bleepingswift.com/blog/claude-code-auto-commit); [Codex `git add -A`](https://github.com/openai/codex/issues/8548)). **Resolution: separate the two layers.** zuzuu's per-turn checkpoint fires off the **lifecycle hook signal** (Design B — `SessionStart`/`Stop`/turn events), on zuzuu's own `zz/session-*` branch / worktree, *independent of whatever the host does in the working tree*. The opinionated *episode* commit is produced at session-close (enhance step) by zuzuu squashing its own checkpoints — it never requires the host to author Conventional-Commit messages. The semantic boundary is then a signal zuzuu *reads* (green-build state, intent-file content, entity-diff), not discipline zuzuu *forces on the host*. The risk that remains: if the host commits to the user's working branch mid-session, zuzuu's worktree/branch model must not collide — the `inSessionWorktree` deferral and single-working-branch invariant already address this, but it needs characterization tests against each host's real commit behavior (real-wire-data rule: observe what each host actually commits *before* wiring).

2. **Asking the agent to "declare" units of work is itself host-dependent.** Instructing the agent via `.zuzuu/instructions/` (AGENTS.md pattern) to write `feat(scope):` and run tests before declaring a boundary works only as far as the host honors instructions — it's directive, not enforced. The green-build signal is the hedge (it's observable regardless of whether the agent cooperates); the mechanical+intent-file fallback is the floor.

3. **jj dep-footprint and churn.** Even as opt-in, jj's pre-1.0 CLI breaks frequently; any `jj`-path code must be version-pinned and behind `which jj` + version check, with the plain-git path always exercised in CI. The surface of users *without* jj is large — the plain-git path is the contract, the jj path is a bonus that must never become load-bearing.

4. **Squash erases the per-turn recovery trail.** Squashing checkpoints into episodes loses the SHAs `doctor` might need. Mitigated by (a) the `.ops.jsonl` ledger as the durable journal, (b) the `Zz-Episode-Id` trailer carried through squash, and (c) keeping checkpoints on the shadow branch / out-of-tree notes until enhance completes — but the ordering (journal-write *before* squash) must be invariant.

5. **Episode-boundary quality for coding transcripts remains empirically unvalidated** — the original problem statement. None of the borrowed conventions has been measured *specifically* on agent coding sessions for episode-summary quality. The brief de-risks by preferring *declared* signals (which can't be "wrong" mid-thought) over detected ones, but the green-build-as-boundary and intent-file-gap heuristics should be validated in `~/Documents/zuzuu-experiments/` against real captured sessions before becoming the default, with findings graduated to `docs/LOG.md`.

6. **rerere cross-session state.** `rerere` resolutions live in `.git/rr-cache/` and aren't shared across clones — fine for local-first, but means recovery on a different machine won't have the cached resolutions; acceptable, just noted.
