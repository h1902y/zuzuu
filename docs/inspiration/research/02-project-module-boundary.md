# Research: Project / module / zu boundary — where one bounded container ends

> Persisted prior-art research synthesis (workflow `wf_bdd78b99-87a`). Background reasoning for the zuzuu redesign specs — not canon. Source-of-truth decisions live in `docs/specs/`.

---

This is a synthesis-only task. I have all 8 research angles; my job is to produce the brief. No file operations needed.

# zuzuu Boundary Brief: project / module / zu

## 1. The convergent boundary principle

Eight independent literatures — PKM, DDD, package-by-feature, PM goal-decomposition, monorepo tooling, productivity taxonomies, agent-memory scoping, plugin ecosystems — converge on **one rule with two faces**:

**A bounded container ends where its *reason to change* ends.** Stated positively: one container = **one coherent goal whose contents change together**, expressed in **one consistent vocabulary**, owned by **one curating intent**. The moment any of those three splits — the goal forks, the vocabulary shifts, or one cluster evolves on a different cadence than another — you have crossed a boundary.

The convergence by name:
- **DDD calls it one ubiquitous language**: the outermost fence inside which every term has exactly one meaning ([Fowler, BoundedContext](https://martinfowler.com/bliki/BoundedContext.html)). Khononov sharpens it to *the largest coherent unit* — as big as it can be while terms stay unambiguous ([Bounded Contexts are NOT Microservices](https://vladikk.com/2018/01/21/bounded-contexts-vs-microservices/)).
- **Package-by-feature calls it the deletion test**: delete the folder, and exactly one capability disappears with no orphaned debris ([Hauer](https://phauer.com/2020/package-by-feature/)); "maximize coupling within a slice, minimize across" ([Bogard, VSA](https://www.architecture-weekly.com/p/my-thoughts-on-vertical-slices-cqrs)).
- **Monorepo tooling calls it substitutability**: a boundary is correct if you can replace all of a unit's internals without touching anything outside its interface ([modular monolith](https://daveamit.com/posts/2026-02-13-modular-monolith/)); Nx/Verraes add **rate-of-change** as the split signal ([Verraes, Splitting a Domain](https://verraes.net/2021/06/split-domain-across-bounded-contexts/)).
- **PKM/PM call it the completion + cognitive-load axis**: PARA's finish-line test (does this *complete* or is it *maintained forever*?) ([PARA](https://fortelabs.com/blog/para/)) and LYT's mental squeeze point (overwhelm is the create-a-container trigger) ([MOCs](https://notes.linkingyourthinking.com/Cards/MOCs+Overview)).
- **Agent-memory calls it context-non-pollution**: a unit is correct when its contents, injected into a sibling's reasoning, would *skew* it ([mem0 entity scoping](https://docs.mem0.ai/platform/features/entity-scoped-memory); [CrewAI role backstory](https://www.digitalocean.com/community/tutorials/crewai-crash-course-role-based-agent-orchestration)).
- **Plugin ecosystems call it independent invocability**: one bundle = one goal a user can activate and benefit from *in isolation* ([Raycast](https://developers.raycast.com/basics/prepare-an-extension-for-store); [MCP elevator-pitch test](https://docs.workato.com/mcp/mcp-server-design.html)).

**The single load-bearing convergence for zuzuu: a container is *one enhance-goal that changes together*.** Every framework's test is a restatement of this — and crucially, all eight reject **capability/layer** as a boundary (DDD's "big ball of mud," Screaming Architecture's "don't name dirs after the framework," MCP's "don't make one tool per entity type"). This directly licenses zuzuu's shift away from fixed faculty modules.

## 2. project vs module vs zu — recommended definition

The three levels map cleanly onto a **borrowed, named hierarchy**: PARA's **Area→Project** distinction draws the project/module line; DDD's **Bounded Context→Aggregate** distinction draws the module/zu line.

| Level | Definition | Borrowed from | The one-line user test |
|---|---|---|---|
| **Project** (`.zuzuu/`) | A **standing domain of responsibility** with no finish line — the working context for this folder/codebase/business. It is *maintained*, never *completed*. It holds the cross-cutting vocabulary and the roster of active modules. | PARA **Area**; DDD **Domain/Subdomain**; Django **project** (config, not behaviour) | "This is the folder I keep coming back to; it has no done." |
| **Module** | A **goal-directed cluster of zus with one enhance goal** that can reach a resting point or be replaced by a new generation. It owns its vocabulary, its zu-types, and its own "grow toward" direction. | PARA **Project**; DDD **Bounded Context**; Linear **Project**; package-by-feature **slice** | "I can name in **one sentence** what this is getting better at — with no *'and also'*." |
| **zu** | The **atomic fused unit**: one fact that optionally carries one runnable act. Single author, single lifecycle (created/updated/deprecated), the smallest thing that serves the module's goal. | DDD **Aggregate** (smallest self-consistent unit); WBS **work package** (one owner, own lifecycle) | "This is one fact or one procedure I'd cite or run by itself." |

**The decision a non-expert applies — three questions, in order:**

1. **New zu vs add to existing?** Is this one self-contained fact/procedure with its own lifecycle? → new zu. (WBS single-owner test.)
2. **New module vs existing module?** Write the home module's enhance goal as *one sentence*. Does this zu serve **that** goal, or does adding it force an "and also"? If the sentence forks, or the new zu uses **vocabulary that means something different** ([DDD language test](https://martinfowler.com/bliki/BoundedContext.html)), it's a **new module**. Also a positive trigger: you're losing track of related zus in a flat list ([LYT mental squeeze point](https://notes.linkingyourthinking.com/Cards/MOCs+Overview)).
3. **New module vs new project?** Apply the **finish-line test** ([PARA](https://fortelabs.com/blog/para/)): can the goal reach a natural resting point and be owned end-to-end without coordinating across domains? → module. If it's **open-ended at the same scope as the whole directory** (needs tending forever, its own instruction-set/vocabulary universe), it's a **new project** ([Claude Projects instruction-set boundary](https://claudecertifications.com/courses/claude-101/introduction-to-projects)). Heuristic ceiling: **past ~7–10 modules**, suspect a module is really its own project ([Johnny.Decimal cognitive cap](https://johnnydecimal.com/documentation/areas-and-categories)).

Note one inversion to keep straight: in PARA, *Project* = the completable thing and *Area* = the standing thing. zuzuu names them oppositely — **zuzuu-project = PARA-Area** (standing), **zuzuu-module = PARA-Project** (goal with a resting point). Borrow the *distinction*, not the labels.

## 3. What makes ONE module — the cohesion test

**The heuristic (the single rule to ship to users):**

> **One module = one enhance goal you can state in a single sentence, where every zu inside changes when that goal changes, and deleting the module removes exactly that one capability with no orphaned zus.**

This fuses the four strongest tests, which all agree:
- **One-sentence goal, no "and also"** (MCP elevator-pitch, Shape Up "can you name its done?", VSA verb+noun).
- **Changes-together** (Verraes rate-of-change; FSD "maximize coupling within").
- **Deletion test** (Hauer): delete the folder → one capability gone, no debris elsewhere.
- **Substitutability** (modular monolith): swap all its zus without editing a sibling module's zus or enhance goal.

Plus two **anti-patterns to reject** (Notion + Airtable converge independently): **do NOT split a module by zu-*type*, *stage*, *status*, or *time period*** — those are *queries/views*, not modules ([Airtable structuring](https://support.airtable.com/docs/structuring-your-airtable-bases-effectively); [Notion teamspaces](https://www.notion.com/help/intro-to-teamspaces)). And reject **generic names** ("research", "notes", "misc") as a boundary smell ([Shape Up §12](https://basecamp.com/shapeup/3.3-chapter-12)).

**Worked examples — ecommerce-management project:**

- **Catalog-building → its own module.** Goal: *"get better at producing SEO-correct, complete product listings."* Coherent vocabulary (SKU, variant, attribute, listing copy), distinct zu set (copy templates + a `generate-listing` act), reaches a resting point per catalog. One sentence, no "and also." ✓ one module.

- **"Catalog facts" + "catalog procedures" → MERGE, not split.** A zu *fuses* fact+act, and Airtable/Notion's rule says type is a view. "Fulfillment knowledge" and "fulfillment procedures" are **one fulfillment module**, queried differently — splitting them is the classic by-layer mistake the whole package-by-feature literature warns against. ✗ do not split by capability type.

- **Social-media-campaigns → SPLIT from catalog.** The enhance goals diverge (*"improve listings"* vs *"improve campaign reach/ROAS"*), the vocabulary shifts (impressions, CTR, audience vs SKU, attribute), and the **context-pollution test** fires: campaign performance facts injected into the catalog enhance step would skew it toward wrong proposals ([mem0](https://docs.mem0.ai/platform/features/entity-scoped-memory)). Different rate-of-change too (campaigns churn weekly; catalog facts are stable). ✓ two modules.

- **Edge case — "product-pricing": module or shared?** If both catalog and campaigns continually propose changes to the *same* pricing zus, that **shared ownership** signal means either (a) they're one module, or (b) pricing is its own module both reference ([Cargo multi-consumer rule](https://reintech.io/blog/cargo-workspace-best-practices-large-rust-projects); FSD shared-extraction). See §4.

## 4. Does goal-oriented (vs capability-oriented) hold up?

**Yes — and the validation is unusually strong.** The shift from fixed faculty modules (a "knowledge" module, an "actions" module) to goal/domain modules is *exactly* the move from **package-by-layer to package-by-feature**, which every source in that angle endorses and none contest:

- Screaming Architecture: top-level dirs should **scream the domain** (`catalog/`, `fulfillment/`), never the framework (`controllers/`, `services/`) ([Uncle Bob](https://blog.cleancoder.com/uncle-bob/2011/09/30/Screaming-Architecture.html)). zuzuu's old `knowledge/` + `actions/` modules are precisely the "screams the framework" anti-pattern.
- MCP names the exact failure: combining unrelated domains or making **one tool per entity type** are both anti-patterns ([Workato](https://docs.workato.com/mcp/mcp-server-design.html)).
- The fused zu makes this *mandatory*, not optional: once a unit carries both fact and act, splitting fact-units from act-units is splitting by layer — the thing to avoid.

**The real risk the shift introduces: cross-module reuse.** A `campaigns` module and a `catalog` module may both need the same `format-price` or `pull-inventory-count` procedure. Goal-oriented modules make this collision *more* likely than capability modules did. Prior art handles it three ways, and they agree on a sequence:

1. **Don't abstract on the first need — wait for the second.** VSA/FSD: extract a shared unit only when **2+ slices demonstrably need it** ([Bogard](https://www.architecture-weekly.com/p/my-thoughts-on-vertical-slices-cqrs); [FSD 2D extraction](https://feature-sliced.design/blog/frontend-monorepo-explained): reuse-count > 1 **AND** high change-frequency).
2. **The cross-import is a structural signal, not a convenience.** FSD's **no-cross-slice-imports** rule: if module A's zus need module B's zus to function, you have exactly two correct moves — **merge** (same goal) or **extract a shared module below both** ([FSD](https://feature-sliced.design/docs/get-started/overview)). Never let one peer module reach into another's internals.
3. **Project-level zus are the shared layer.** Agent-memory gives the cleanest home: cross-cutting facts live as **project-scoped shared "blocks"** (Letta) / the **routing directory** (transactive memory) — not duplicated into each module ([Letta shared memory](https://docs.letta.com/guides/agents/multi-agent-shared-memory/); [transactive memory](https://agentic-design.ai/patterns/memory-management/transactive-memory-systems)).

**zuzuu's mapping:** a shared procedure used by two modules' enhance loops should graduate to a **project-level zu** (the `.zuzuu/` root holds cross-module shared zus), and modules **reference** it via a cross-module relation rather than each owning a copy. The substitutability test is the guardrail: if swapping `catalog`'s zus forces edits to `campaigns`' enhance goal, the shared part wasn't extracted.

## 5. Adopt / adapt / avoid

**ADOPT (ship as-is):**
- **The one-sentence enhance-goal test** as the module manifest's required field and the primary boundary check. No "and also." (MCP, VSA, OKR, plugin ecosystems all converge.)
- **The finish-line test** for module-vs-project: completable/replaceable → module; tended-forever-at-folder-scope → its own project. (PARA, Linear, Jira.)
- **The deletion + substitutability tests** as the `zz` health check: delete a module → one capability gone, no orphaned zus; swap its zus → no sibling edited. (Hauer, modular monolith.)
- **The context-pollution test** as the split signal: would this zu, in a sibling's enhance step, skew its proposals? → separate modules. (mem0, CrewAI.)
- **The anti-pattern bans**: never split by zu-type/stage/status/time (those are *queries*); never name a module generically. (Airtable, Notion, Shape Up.)
- **Emergent creation** (see §6): modules earn existence at the mental-squeeze point, not by upfront declaration. (LYT, Zettelkasten, Claude Code Skills' recurrence-extraction.)

**ADAPT (translate, don't import literally):**
- **PARA labels are inverted** — borrow Area-vs-Project as a *distinction*, present it to users as "standing folder vs completable goal." Don't expose PARA's vocabulary.
- **DDD ubiquitous-language test** → user-facing as: *"do all these zus use words that mean the same thing here?"* A term that shifts meaning = a module boundary.
- **The ~7–10 cognitive cap** (Johnny.Decimal) → a soft nudge in `zz` ("you have N modules; some may be their own project"), never a hard limit on a user-defined system.
- **mem0's user/agent/session scopes** → zuzuu's project(persistent) / module(goal-isolated) / session(ephemeral, never becomes a zu unless human-gated through the enhance loop).

**AVOID:**
- **Capability/layer modules** (`knowledge`, `actions` as separate modules) — the by-layer anti-pattern; the fused zu makes it incoherent.
- **The mega-module** absorbing everything touching one topic (Raycast's explicit warning) — and its opposite, **per-zu over-splitting** (Nx/Cargo/Go all warn: no new container without a *demonstrable* reason).
- **Eager shared abstractions** — extract a shared/project-level zu only on the *second* real consumer, never speculatively.
- **The no-folders extreme** (Roam/Logseq): without module containers there is no coherent enhance goal — the container is **architecturally mandatory** for zuzuu, not optional scaffolding.
- **Importing deadlines** (PARA/Linear) — modules need a *stated goal the enhance step works toward*, not a date.

## 6. Open risks

**Boundary drift over time.** Modules grow until their enhance goal silently forks (the "overgrown bounded context" — same unit serving 4+ unrelated purposes, fear of modification, [Jovanović](https://www.milanjovanovic.tech/blog/refactoring-overgrown-bounded-contexts-in-modular-monoliths)). Mitigation: make the boundary tests **continuous, not one-time** — run deletion/substitutability/context-pollution as a periodic `zz` health signal, and treat a module whose one-sentence goal now needs "and also" as a **split candidate** surfaced to the human gate. The **per-module generation** model already gives a clean re-draw mechanism: re-bound at a generation boundary, don't `git revert`.

**Cross-module zu reuse (the central tension of the goal-oriented shift).** This is the highest-risk area: goal modules collide on shared procedures more than faculty modules did. The literature's answer is a *sequence* (don't abstract until the 2nd consumer; cross-import = merge-or-extract; shared zus live at project level) — but zuzuu must build the **project-level shared-zu layer + cross-module relations** for this to work, or users will duplicate zus and the enhance loops will fight over divergent copies. Open question: should a shared zu be *referenced* (one home, many pointers — Letta's attach model) or *copied* (autonomy, but drift)? Recommendation: **reference** (single home + relation), matching Letta's shared-block model and the substitutability test.

**Rigid taxonomy vs emergent structure.** The strongest cross-cutting finding: **structure should emerge, not be imposed.** Zettelkasten (structure notes appear when search overwhelms), LYT (mental squeeze point), and Claude Code Skills (recurrence-extraction — *"create a skill when a CLAUDE.md section has grown into a procedure"* [Skills](https://code.claude.com/docs/en/skills)) all say: **do not force users to declare module boundaries upfront.** But Roam/Logseq prove the opposite failure: *zero* imposed structure destroys the queryable grouping the enhance loop needs. zuzuu's resolution: **modules are mandatory containers but emergently created** — a user starts with few/one module, and `zz` proposes promoting a cluster to its own module **when related zus exceed working memory** (the squeeze point) or **when the enhance loop detects vocabulary/goal divergence** (context-pollution). The human gate decides. This keeps the structure real (enhance goals stay coherent) without an imposed taxonomy.

**Residual unknowns to flag:**
- The ~7–10 module cap is borrowed from filing systems; its validity for *agent-served* projects is untested — treat as a nudge, measure real projects before hard-coding.
- Whether a module can ever be *truly* completable (PARA-Project-shaped, then archived) or whether all zuzuu modules trend toward standing-domain (PARA-Area-shaped) — if the latter, the module/project line blurs and rests entirely on **scope/vocabulary isolation** rather than completion. Watch which test does the real work in practice.
