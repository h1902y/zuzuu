# 07 · The CLI veneer

> Six lessons built a brain: an envelope, an index, a registry, a gate, a loop, an observer. This one is the **front door** — how a person (or an agent) actually *uses* it. The surprise: it's the thinnest layer in the whole system, and that's the point.

The code is `cli/init.mjs` (`zz init`) and `cli/index.mjs` (the router). The entry is `bin/zz-next.mjs`.

## The router owns no logic

`cli/index.mjs` is a flat `switch` over the verb, and every case is a one-liner onto the `api` façade (lesson on `api.mjs`):

```js
case 'query': { const r = open(cwd).query(module, opts); log(toon('zus', r.value.rows, …)); }
case 'act':   { const r = open(cwd).act(module, id, inputs); … }
```

That's deliberate. The dependency rule is `kernel ← capabilities ← pipelines ← hosts/cli` — the CLI is the **outermost** ring and imports only inward. It parses argv, calls the façade, renders the result. If logic ever creeps into the router, it's in the wrong place — it belongs in a capability, where every host (the web daemon, a plugin) gets it too. The CLI is a *veneer*: thin, swappable, opinion-free.

## Written for an agent to read (AXI)

The agent is the primary user of `zz`, so the output obeys the [AXI](https://axi.md) principles:

- **TOON, not JSON** — `zus[3]{addr,type,title,status}:` then one terse line per row. ~40% fewer tokens than JSON for the same rows (no repeated keys, braces, quotes). Every turn the agent spends reading output is a turn it isn't thinking; keep it cheap.
- **Brief by default** — a query returns handles (`addr`, `title`), not full bodies. `--full` opts into the rest. Content-first, no ceremony.
- **No blocking prompts.** The one interactive verb in the whole system is `review`, and even it isn't a wizard — it's explicit subcommands (`zz review approve <m> <id>`), so a script or an agent drives the gate without a TTY. The human decision stays mandatory; the *blocking* doesn't.
- **Structured errors** — a failure is `error[1]{message}:` and a non-zero exit, not a stack trace. Parseable, one line.

The verbs read as the sentence the whole system is built around: *you **query** what's true, **act** on it, zuzuu **observes** and **enhances**, you **review*** — plus the lifecycle handful (`init · check · module · digest`).

## `zz init` — a brain into any repo

`init` is the one onboarding step, and it embodies two hard rules:

- **Git-citizen.** It resolves the *host* repo root (`git --show-toplevel`) and plants `.zuzuu/` there. It **never** `git init`s — zuzuu lives *inside* your project's history, it doesn't start one. (Lesson `01`.)
- **Idempotent + brownfield-safe.** It writes each file *once* — a second `init`, or an `init` over an existing home, creates nothing and clobbers nothing (it reports what it skipped). Onboarding an existing project is safe.

It scaffolds the five standard modules — each a `module.md` envelope written with the kernel's *own* `serialize` (the home is dogfood from byte one), declaring its `capabilities` and `enhance.goal` — plus the seed guardrail rules as real `type: rule` zus (the hard-won `no-root-wipe` negative-lookahead among them, lesson `04`).

## The whole loop, from the command line

Because every layer underneath is real, the loop you've been reading about runs as a sequence of shell commands — verified end-to-end on a real project:

```bash
zz init                                  # scaffold the brain (git-citizen)
zz observe                               # mine real sessions → 2 proposals
zz review                                # see them, ranked
zz review approve actions <handle>       # the gate → writes the zu + mints a generation
zz act actions <handle>                  # run the just-learned command
zz module actions generations            # the snapshot that approval pinned
```

`observe` watched real Claude sessions, found a command that recurred, and proposed it as a runnable action. You approved it. Now `zz act` runs it, and a generation pins the moment. The brain grew, from work, through the gate, and you can roll it back. Seven lessons, one working system.

---

**Next:** `08` · The cull — retiring the v1 substrate now that the kernel replaces it. *(Written when the cull lands.)*
