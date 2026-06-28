# Guardrails — enforced, not advisory

Rules evaluated **on every tool call** before it runs (the host's `PreToolUse` hook, installed by `zz host enable` — still aliased as `zz enable`). A rule is just a **note** (`type: rule`) in the guardrails module — so guardrails grow and version exactly like everything else.

## A rule note

`.zuzuu/guardrails/items/<id>.md`:

```markdown
---
type: rule
action: deny                     # deny | ask | allow
tool: Bash                       # exact tool name, or *
pattern: rm\s[-\w\s]*\s['"]?/['"]?(?=\s|$|[;&|'"])
reason: destructive delete at filesystem root
---
```

`zz init` seeds three: **no-root-wipe** (deny), **no-secret-reads** (deny — `.env`, `id_rsa`/`id_ed25519`/…, `*.pem`/`*.p12`/`*.crt`, `credentials`), and **confirm-force-push** (ask). Edit, commit, done — rules are plain data, versioned in git.

## How matching works
- **Severity wins**: deny > ask > allow — rule order can never silently disarm a deny.
- The pattern matches over the **raw string values of the tool input** (the actual command/path) — *not* a JSON-escaped form, so real whitespace works and `rm⇥-rf⇥/` can't slip past a deny rule.
- **Tool names are canonicalized across hosts** — a `tool: Bash` rule fires on a host whose shell tool is named `bash`/`shell`/`exec_command`, not just Claude's.
- A rule pattern with a catastrophic-backtracking (ReDoS) shape is **rejected at compile**, so a bad rule can't hang the synchronous gate.

## Design guarantees
- **Fail-open:** a malformed rule, bad regex, or missing file blocks **nothing** — a guardrail bug must never break your agent. An engine error means the host's normal permission flow applies.
- **`act` is gated too:** a runnable note's `run` passes the same gate before `zz act` executes it (plus a `run.allow` allowlist that only exempts repo-local scripts — an absolute path outside the repo is denied).
- **Observed:** every matched decision is logged to `.zuzuu/.live/guardrails-<session>.jsonl` — the safety trail.

## Honest scope
A regex gate is a **policy check, not a sandbox** — it's the moat's first layer, but the real moat is the **human review gate** on every write to the brain. An `act` run is **gated + allowlisted** (`run.allow`), not OS-sandboxed — there is no containment backend bundled (a `contained`/srt tier was reserved but never wired, and was removed rather than ship a flag that doesn't isolate). The enforced `PreToolUse` gate is currently installed for **Claude Code** (`zz host enable`); the same engine + the per-host hook wiring for the other four hosts is on the [[Roadmap]].
