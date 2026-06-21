# 08 · The cull

> Seven lessons built a new core beside the old one. This one is about deleting the old one — safely. The interesting part isn't the `git rm`; it's everything that had to be true *before* it.

## Why the cull was blocked

The v2 kernel (lessons 02–07) replaced v1's **data model and verbs**. But v1 was still the shipped product, and a lot of it — session management, live capture, host enablement, the workbench launchers — sat *on top of* the v1 core. A dependency scan made the danger concrete: the surviving surfaces imported `module/`, `knowledge/`, `core/`, `home/`, `capture/`. Delete those and you don't slim the repo, you amputate working features.

So the rule was: **reabsorb first, cull last.** Rebuild every surface that v1 still owned onto the v2 kernel, prove it green, and only then delete.

## Reabsorb, in dependency order (rungs 8a–8d)

- **8a — the session record** moved into `sessions/record.mjs`: the lifecycle state machine + the `sessions.json` index — minus the OTLP trace fields, which die with the trace layer. *(Postscript: a 2026-06-22 YAGNI pass found nothing in v2 ever wrote that index — the git branch already **is** the session record — so `record.mjs` and `sessions.json` were cut. The branch is the truth.)*
- **8b — session management** was the pleasant surprise. The safety-critical `sessions/` engine (the session-as-git-branch machinery) had *exactly one* import from the v1 core. Re-point those two lines at the kernel and it's v2-native. **All 87 of its characterization tests passed unchanged** — the strongest possible evidence that the re-point changed nothing it shouldn't.
- **8c — live hooks + enable**: a v2 hook that maps every host's lifecycle onto open/turn/end and routes `PreToolUse` through the v2 gate. Its end-of-session step is the payoff of the whole rebuild — it calls `observe`, mining the just-finished session into proposals.
- **8d — doctor/status/explain + the launchers**: the porcelain, re-pointed.

Each rung was *additive* — v1 stayed running the whole time, so the suite stayed green at every step. That's the discipline that makes a big migration safe: never have a broken `main`.

## Drop, don't port: the OTLP layer

The single biggest deletion wasn't reabsorbed at all. v1 parsed transcripts into **OTLP trace blobs** for observability — ~1.7k lines of adapters, span builders, and trace plumbing. v2's observe mines transcripts *directly* into proposals (lesson 06); it never needed traces. So that entire layer was **deleted, not rebuilt**. The lesson: a rewrite is a chance to notice what you were only carrying out of habit.

## The cut (rung 8e)

With every surface green on v2, the delete was mechanical and safe:

- `bin/zuzuu.mjs` repointed to the v2 router.
- `~12.6k lines` removed: a dozen v1 directories, the old command surface, 85 v1 test files, the OTLP playgrounds.
- A `migrate` command, written and tested *first*, upgrades any existing v1 home (`module.json` → `module.md`) so installs survive the cut. *(It served its purpose during the transition and was itself removed in the 2026-06-22 pass — v1 is long gone.)*

```
~13,000 lines  →  3,765 lines of product code
```

What's left is one coherent stack — `notes · use · loop · guardrails · hosts · sessions · cli · serve`. One parser (the envelope), one CLI (the veneer over `api`), one capture path (observe). The published binary does the whole loop end to end: `init → enable →` the gate denies `rm -rf /` `→ observe` mines real sessions `→ review → act`.

## What made it safe (the transferable part)

1. **Map dependencies before deleting** — the scan turned "delete v1" from a guess into a plan with a known blast radius.
2. **Reabsorb additively** — build the replacement beside the original; keep the suite green at every commit.
3. **Re-point over rewrite** where coupling is thin — 87 tests passing unchanged beats 800 new lines.
4. **Characterization tests are the safety net** for the scary code — they let you move session-git without fear.
5. **A rewrite is a chance to drop, not just move** — the OTLP layer was the biggest win precisely because it wasn't ported.

That's the whole rebuild: eight rungs, one envelope, a brain that grows from real work through a human gate — and now, nothing left to cull.

---

This is the last lesson in the build sequence. From here the book tracks the product as it evolves; the [code tour](reading-the-code.md) stays current as the map.
