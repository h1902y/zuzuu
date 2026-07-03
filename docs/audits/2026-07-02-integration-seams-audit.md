# Integration-seams audit — first-hand findings from the first root-mode consumer (02-07-2026)

> Provenance: NOT an agent sweep — these are the seams actually hit while building against zuzuu v1.8.0 all day as its first root-mode production consumer: migrating ~/Documents/personal (277 notes, 5 modules) off Obsidian, wiring the /hi handler suite to zz verbs, and building the startpage galaxy + bridge on top of the index. Every claim below was verified against the code the same day. Companion docs: `2026-07-02-backend-audit.md`, `2026-07-02-frontend-merge-audit.md`.

## Verified friction points

1. **JSON output is inconsistent across the CLI surface: 22 of 47 verbs are `json: false`** (`src/cli/commands.mjs`). Consequence: neither frontend could treat the CLI as a uniform machine API — the bridge fell back to importing `src/notes/index.mjs` directly; the vault's handler docs shell only the verbs known to emit JSON. A personal-app platform needs `--json` everywhere or a single JSON-native transport.

2. **No cross-module search from the surface.** `zz query <module>` requires the module positional, so "search my whole vault" = loop 5 modules × full index open each. The omnibar's fuzzy search bypassed the CLI entirely (direct sqlite). The primitive supports empty-module search; the verb doesn't expose it.

3. **No `note create` verb → the direct-write + provenance recipe.** The vault's /hi flows (journal, captures, social) are human-actor writes that shouldn't need the propose-approve round trip. Workaround shipped in the vault's CLAUDE.md: Write tool + `logMutation()` import one-liner to keep `zz check`'s ungated count honest. That recipe existing at all is the gap: an operator-actor `note create` (validated, minted, logged, `agentInvokable: false`) would delete it.

4. **Date-window queries live in the caller.** `actions` uses `start_date` + `duration_days`; "active today" (start ≤ today < start+duration) cannot be expressed in `--where` (equality-only EAV), so /hi fetches all activities `--json` and filters in the handler. Same for "expired but still status=active" flags.

5. **The bridge opens+closes the index per request, paying the corpusSig stat-walk each time.** `dbAll()` in `bridge/server.mjs` wraps open→query→close; a single /dashboard render triggers several full-corpus stats. Invisible at 277 notes; a wall at 10k. A resident handle (or daemon) amortizes it.

6. **Bare-id addressing is a latent collision footgun across the stack.** The galaxy keys nodes and positions.json by bare id; `module:id` is the true address. Two modules sharing an id (nothing prevents it) would silently merge nodes/positions. Related: the backend audit's bug 1 (bare-id relation mis-qualification) is the same root cause — id-vs-addr discipline.

7. **YAML-subset friction during migration.** Hand-written or imported flow arrays (`[a, b]`) parse as strings, not lists — cost one debugging round during the Obsidian migration (tags rendered as one string). A `zz lint`/normalize verb for imports would have caught it; conventions now live in the vault's CLAUDE.md instead of tooling.

8. **No attachments story.** The vault's carousel PNGs / render outputs had nowhere first-class to live; resolution was "attachments/ is gitignored regenerable output only, sources live in note bodies." Works for regenerables; breaks the day a note needs a durable binary (photo, PDF).

9. **Counting is awkward.** `--limit 0` is the natural "count only" gesture and it's broken at the CLI layer (handler coerces to 50 — backend audit bug 3). /hi's handler docs resort to "--limit 0 style counts" language that doesn't actually work; the bridge counts via direct SQL.

10. **Two sanctioned-consumer patterns diverged in one day.** The daemon shells the catalog (safe, slow, JSON-inconsistent); the bridge imports internals (fast, unversioned, fragile). Both exist because there is no middle: a versioned programmatic core (`@zuzuucodes/core` export or a resident local API). This is the same conclusion both companion audits reached from their own directions.

## What worked beautifully (keep these properties)

- **Root-mode migration was clean**: `project.md` marker + modules-at-root felt native; `.zuzuu/` ephemera separation kept the vault's git history pure.
- **The envelope's tolerance** (unknown keys round-trip) made the 55-note ops-file conversion a two-hour job including provenance.
- **`zz note rename`/`fold` repointing backlinks** meant zero broken-link debt through aggressive restructuring.
- **The gate as UX for agent flows is right**: digest staging proposals + one-word approval feels correct in conversation — the moat should stay for agents; it's only the *operator* path that needs directness.
- **Provenance/actor stamping** (human/operator/agent/migration) gave an honest `ungated` integrity signal through the whole migration.
