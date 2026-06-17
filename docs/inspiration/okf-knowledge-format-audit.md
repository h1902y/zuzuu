# OKF (Open Knowledge Format) — vendor-neutral knowledge-bundle spec audit

> **Status:** spec + repo audit, 2026-06-17 (read-only web fetch of the public repo + `SPEC.md`). Source: `GoogleCloudPlatform/knowledge-catalog`, dir `okf/` — a proof-of-concept enrichment agent + the **OKF v0.1** spec. Relevant to zuzuu's **Knowledge module**, the **filesystem module-serving surface** (DESIGN §6), and **marketplace templates (W4)**. (This dir's older audits say "faculty"; OKF is the same concept under the current **module** name.)

## What it is
A spec for representing a **knowledge catalog as plain markdown files with YAML frontmatter, organized in a git-versioned directory tree** — explicitly "independent of any specific agent, framework, model provider, or serving system." A *bundle* is a directory of concept docs; an *enrichment agent* (`src/enrichment_agent/`) produces OKF from BigQuery metadata + web sources; three example bundles ship (GA4, Stack Overflow, Bitcoin). It is an **interchange/serving format**, not an evolution system.

## The format (OKF v0.1, concrete)
- **Concept doc** = UTF-8 markdown, YAML frontmatter + free-form body. **Required:** `type` (concept kind, e.g. "BigQuery Table"; *no central registry* — producers choose). **Recommended:** `title`, `description` (one-sentence, for previews/search), `resource` (URI of the underlying asset), `tags` (list), `timestamp` (ISO 8601). Unknown keys **must be preserved on round-trip**.
- **Conventional body headings** (none required): `# Schema`, `# Examples`, `# Citations` (numbered external sources at the bottom).
- **Reserved filenames:** `index.md` (directory listing, *no frontmatter*, `* [Title](url) - description` entries grouped under headings — enables **progressive disclosure**, auto-generated or synthesized on the fly) and `log.md` (change history, ISO-date headings newest-first, `**Update**`/`**Creation**`/`**Deprecation**`).
- **Links = relationships:** a link from A→B asserts a relationship; **the *kind* is conveyed by surrounding prose, not the link**. Absolute (bundle-root `/…`, recommended) or relative. Consumers **must tolerate broken links**.
- **Conformance is deliberately loose:** valid iff every non-reserved `.md` has parseable frontmatter with a non-empty `type`, and reserved files follow their structure. Consumers must not reject bundles for missing optional fields, unknown types, or broken links.

## Convergence with zuzuu (independent arrival at the same substrate bets)
| OKF v0.1 | zuzuu today |
|---|---|
| markdown + YAML frontmatter as the unit; required `type` | `.zuzuu/knowledge/items/` with kinds `fact/entity/command/decision`; the auto-memory files use the same `name`/`description`/`metadata.type` shape |
| git-versioned, vendor-neutral, plain text directory tree | the `.zuzuu/` `.git`-model home (transparency via porcelain + plain-text files; DESIGN §6 filesystem/smfs serving surface) |
| auto-generated `index.md` for progressive disclosure | the session-start `digest.md` + per-module `README.md` explainer |
| `log.md` change history | `docs/LOG.md` + the per-module audit trail |
| links assert relationships | knowledge `--rel type=target`, memory `[[wikilinks]]` |

This is **external validation** (from a GoogleCloudPlatform spec) of zuzuu's riskier serving bets: filesystem-as-API, markdown+frontmatter, git-native, index-for-progressive-disclosure.

## Honest assessment (the divergence from zuzuu's thesis)
- **OKF stops exactly where zuzuu starts.** It is a *static* format — produced once by an enrichment agent, then served/consumed. It has **no eval, no proposals, no human gate, no generations**. zuzuu's whole differentiator (DESIGN §2: *grow* knowledge from the trace, graduate it human-gated across versioned generations) is the layer OKF lacks. OKF is the "*configure* the catalog" the field already has; the loop on top is the wedge.
- **Relationships are untyped** — "the kind is conveyed by the surrounding prose," and consumers "must tolerate broken links." zuzuu has **typed relations + entity resolution + a sqlite index** — a real graph, not prose-implied edges. Adopting OKF's link model would be a downgrade for the internal substrate.
- **`type` has no registry**; zuzuu pins kinds per-module schema (`module schema <m>`). OKF's looseness is right for interchange, wrong for the governed internal store.
- So: a **format to be *compatible with at the boundary*, not a design to adopt wholesale.** Adopting it means *exporting/serving modules as OKF bundles*, not changing what the evolve loop does internally.

## Learnings for zuzuu (tagged)
1. **[knowledge/interop]** Add **`module export`/`import` to/from OKF bundles** for the Knowledge module — interop with a vendor-neutral ecosystem at the boundary, while the internal sqlite/typed-relation substrate stays ours. Fits "enhance, never reinvent" + W5's "never a bespoke format."
2. **[marketplace/W4]** A persona template (accountant, CEO) is **basically an OKF bundle** (`.zuzuu/` layout + seed modules). Shipping templates *as* OKF bundles would let them ride an external format instead of a proprietary one — a concrete W4 distribution path.
3. **[serving]** Mirror the **auto-generated `index.md` per module dir** convention (progressive disclosure without loading the whole bundle) — complements the digest, which is session-scoped not dir-scoped.
4. **[knowledge/storage]** Borrow the **`log.md` change-log convention** (ISO-date, newest-first, Update/Creation/Deprecation) for per-module history surfaced to humans.
5. **[honesty]** Keep zuzuu's **typed relations + entity resolution** internal; only flatten to OKF's prose-relationship model at the export boundary — don't let interchange looseness leak into the governed store.

## Notes
- Web-fetched (read-only) from the public repo + raw `SPEC.md`; field names quoted from the v0.1 spec — spot-verify against the repo before implementing an exporter. Apache-licensed Google Cloud PoC (confirm the exact license file before vendoring anything).
- OKF validates the *serving/interchange format*; zuzuu's local-first governed substrate + the graduation engine remain the differentiators.
- Link supplied 2026-06-17: `https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/main/okf`
