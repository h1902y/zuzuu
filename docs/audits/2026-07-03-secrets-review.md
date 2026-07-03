# Secrets-declaration module — adversarial moderation review

- **Scope**: commit series `fd79375..080eeaa` (secrets I–IV + docs) on `feat/personal-app-roadmap`.
- **Invariant under test**: *a secret's VALUE must NEVER enter a note, `runs.jsonl`, or any agent/LLM context.*
- **Design intent**: `docs/specs/2026-07-02-polish-showcase-experience.md` §J.3 + §J.5.
- **Files read fully**: `src/notes/validate.mjs`, `src/use/secrets.mjs`, `src/notes/log.mjs`, `src/use/act.mjs`, `src/serve/api.mjs`, `src/cli/verbs/secret.mjs`, plus the pre-existing paths the work leans on (`src/grow/stage.mjs`, `src/grow/plan.mjs`, `src/grow/review.mjs`, `src/use/diff.mjs`, `src/cli/verbs/evolution.mjs`, `web/src/server/zuzuu-peek.ts`) and all 6 secret test files.

## Verdict: **ship-after-fixes**

The core resolver → injection → log-redaction spine is sound and unusually well-tested on the DENY / never-logged paths (scope fail-closed, operator-only-refuses-agent, no-partial-injection, resolved-value-absent-from-`runs.jsonl`, read-verbs-never-call-the-resolver). But the write-door refusal — the one enforcement the brief calls load-bearing — is **narrower than its own docs claim** and is **bypassed entirely on the `stage` path**, where a plaintext value reaches a git-tracked file AND two rendered surfaces before the late refusal fires. Fix B1/B2 before this fronts any remote/agent surface (which is exactly the §J.4 sequencing requirement: land the value-refusal *by construction* before exposure).

---

## BLOCKER

### B1 — The `stage` door skips the value-refusal entirely; the value reaches git-tracked disk + a CLI render + the daemon HTTP body
`src/grow/stage.mjs:30` (`stageChange`) writes the proposal straight to `<module>/staged/<id>.json` with **no `validateNote` call**. The `type: secret` value-refusal (`validate.mjs:286`) runs only at `commit` time (`grow/review.mjs:28` approve → `commit` → validate). So a poisoned `change: {type:secret, value:"sk-…"}` (staged by an agent — `stage` is `agentInvokable:true`, or a naive human paste) is accepted and then leaks on three surfaces *before* the refusal:

1. **Git-tracked on disk.** `.gitignore` does NOT list `*/staged/` (`git check-ignore secrets/staged/foo.json` → not ignored). The plaintext value sits in the working tree and lands in history on any ordinary `git add . && git commit`. On decision it is **moved to `staged/archive/<id>.json.applied`** (`stage.mjs:63`), also tracked — so *rejection persists the plaintext forever* as the audit trail.
2. **CLI render.** `zz review plan secrets` → `planFor` (`plan.mjs:43`) diffs the projected `after` (which contains `value`) → `renderNoteDiff` (`use/diff.mjs:43`) prints `    + value: sk-…` to the reviewer's terminal.
3. **Daemon HTTP body.** `stagedSummary` (`web/src/server/zuzuu-peek.ts:326`) returns the **entire raw `change`** object — including `value` — into the review-panel REST response.

The test at `tests/unit/secrets-validate.test.mjs:152` proves only the *final* `approve` refusal; it never asserts the value stays off disk / off the render surfaces, and it demonstrably writes the poisoned value to a staged file first. `docs/guide/Secrets.md:167-171` acknowledges the gap but understates it ("transient JSON file… never reaches … agent context") — the file is git-tracked, not transient, and the daemon renders it.
**Fix**: run the `type: secret` forbidden-field check inside `stageChange` (mirror the write door at the stage door) so a poisoned proposal never lands on disk; belt-and-suspenders, redact `change` for secret-typed targets in `stagedSummary` + `renderNoteDiff`.

---

## SHOULD-FIX

### S1 — Write-door forbidden set is exact-key-match; the most common real-world secret keys slip through, and the docs over-claim
`src/notes/validate.mjs:46,287` — `SECRET_FORBIDDEN_FIELDS = {value,secret,key,token,password,credential}` matched by **exact** lowercased key. So `--field api_key=sk-…`, `access_token=…`, `client_secret=…`, `apikey=…`, `pat=…`, `bearer=…`, `passphrase=…`, `privatekey=…`, `val=…`, `pw=…` are **NOT** refused and the value lands in a git-committed `type: secret` note. This is the exact worst case ("value enters a note") for the field names most humans/agents actually reach for. Two aggravators: (a) `docs/guide/Secrets.md:138` claims flatly "The value can never be written to a note" — an over-claim; (b) the redaction path already uses the *right* shape — a substring regex `SECRET_KEY_RE = /(key|token|secret|password|passwd|credential|auth)/i` (`log.mjs:40`) that WOULD catch `api_key`/`access_token` — so the write door (the one that governs durable notes) is strictly *weaker* than the log redactor. The resolver never reads note fields, so the stored value is inert for resolution — that's why this is SHOULD-FIX not BLOCKER — but it is still a durable plaintext-in-git leak.
**Fix**: switch the check to a substring test over the same token set as `SECRET_KEY_RE` (single shared constant), or add the common names + honestly document the boundary; drop the "can never" absolute.

### S2 — The refusal inspects frontmatter top-level keys only — not the body, not nested maps
`src/notes/validate.mjs:287` scans `Object.keys(note)` (top-level frontmatter). A value in the **body** of a `type: secret` note (e.g. "the key is sk-…") or nested under a non-forbidden key (`meta: {token: sk-…}`, `config: {...}`) is written to a git-committed note unrefused. `scope`/`rotation_note` free-text are likewise unscanned. The body case is realistic (people annotate). `docs/guide/Secrets.md:138`'s "can never be written to a note" again over-reaches.
**Fix**: also scan the body (and one level of nested-map keys) for the forbidden set on `type: secret`, or scope the doc claim to "frontmatter keys".

### S3 — `act()` returns unredacted `stdout`/`stderr` to the caller; an agent-actor run that echoes its secret leaks it into agent context
`src/use/act.mjs:201` returns `{ ...r }` where `r.stdout`/`r.stderr` are the child's raw output (`runGated`, `act.mjs:126`). A tool that echoes `$ZZ_<NAME>` puts the plaintext in the return value. `runs.jsonl` is safe (`logRun` never records stdout), but for an `actor:'agent'` shell run reaching `act` via the daemon, that return value is the agent's context — defeating the "agent never sees plaintext" claim (§J.3). GitHub masks stdout; zuzuu does not. The test at `tests/unit/run-redaction.test.mjs:197,206` *explicitly asserts* `r.stdout` contains the real value — i.e. the leak is codified, and there is no test that an agent-actor run's stdout is masked.
**Fix**: when `secretsResolved` is non-empty, redact the resolved values out of `stdout`/`stderr` before returning (reuse `readDeclaredSecretEnvValues` + a replace), at least for `actor:'agent'`.

---

## NIT

### N1 — Redaction is exact-value match only; a transformed secret (base64/url-encoded/substringed) is not masked
`src/notes/log.mjs:57-60` uses `values.has(String(v))` — GitHub's documented masking-defeat (transform then log). Low reach here because the *resolved* value only ever enters the child env, never `inputs` (which is what `logRun` writes), so a transform would have to be deliberately placed in `inputs` by the caller. `run-redaction.test.mjs:58` documents the exact-match limit. Worth a one-line doc note that redaction is exact-match, not transform-aware.

### N2 — The actor gate defaults `operator` (fail-OPEN); it is fail-closed only because every dispatch path stamps `agent`
`src/use/secrets.mjs:91` and `src/use/act.mjs:155` default `actor='operator'`. The scope gate is independently fail-closed (absent scope → matches nothing, `validate.mjs:64`, tested), but the *actor* gate's safety relies entirely on `serve/dispatch.mjs` / `hosts/hook` stamping `'agent'`. A future caller that forgets to stamp gets operator privileges and can resolve `operator-only` secrets. Consistent with the existing moat's fail-open-operator convention, so acceptable — but note it: the actor gate is not self-fail-closed.

### N3 — The daemon-side agent-run (ACP) secret path is unbuilt and therefore unaudited
`src/use/act.mjs:167` returns `{needsHost:true}` for an `agent`-binding tool in the CLI — secrets are resolved only on the shell path. When the daemon's ACP agent-run is built, it must replicate BOTH the tool-side placeholder substitution (agent sees `secret:name`, value substituted after the LLM decision) AND a redaction of the ACP transcript — the CLI-side `logRun` redaction won't cover a daemon transcript. Flagging so the invariant isn't assumed-covered when that arc lands.

---

## Confirmed-sound (positive findings)

- `resolveSecret` returns `value` only on the `ok` path; every error carries `name`/`declaration`/`caller`/`deniedBy` but **never the value** (`secrets.mjs:93-132`).
- Scope fail-closed on absent/empty/no-caller; `operator-only` refuses `agent` on every path including `act()`'s pre-resolve; any single resolution failure refuses the whole run before the lock/spawn — no partial injection (`act.mjs:181-185`; tested `secrets-resolve` + `secrets-act`).
- Resolved value goes ONLY into the child env as `ZZ_<NAME>`, merged after `inputs` so it can't be smuggled via a colliding input key; never on `inputs`, the return, or `runs.jsonl` (`act.mjs:180-184,197,201`; tested `secrets-act.test.mjs:56`).
- The log redaction set is built from **resolved values** (`readDeclaredSecretEnvValues` for env/fly + `readSecretValues` for the dev secrets-file), not just names — so a value riding under an innocuous input key is masked (`log.mjs:155`; tested).
- The `secret` CLI namespace is read-only (`list`/`show`/`check`), never calls the resolver, prints metas + a ✓/✗ availability probe only — no value even under `--json`, even for `sensitive:false` (`cli/verbs/secret.mjs`; tested `secrets-cli.test.mjs:47`).
- `last_used` audit touch writes a timestamp only and no-ops under `actor:'agent'` (commit refuses non-operator) — fail-closed, no value (`serve/api.mjs:104-116`; tested `secrets-last-used.test.mjs:57`).
