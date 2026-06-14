# Hierarchy, Relationships & Knowledge Graph — Web Design Research

*Lane: how items connect. Mined from Mobbin (web), examining actual screenshots. Platform: web.*

## Brief

**zuzuu surfaces this informs:**
- **Knowledge items and their relations** — the faculty stores one-fact items that link to each other, to sessions/traces, and to other faculties (actions, instructions).
- **The module detail page** — a single item shown as a titled body + a **properties** panel + a list of **related items** ("what connects to this").
- **The "how items connect" view** — some way to see the knowledge graph: backlinks, a relations panel, or a node map.

The current web workbench feels like a VS Code terminal. We want it Notion-calm, Duolingo-progressive, welcoming, uncomplicated. The design questions:
1. Where do relationships live on a detail page — inline in the body, in a right rail, or a dedicated tab?
2. How do we show backlinks ("mentioned in") without overwhelming a single fact?
3. Is a force-directed graph map worth it, or do plain-language relation rows read calmer?
4. How do properties (type, source, generation, confidence) sit beside the content without looking like a database admin panel?

## Studied

### Reflect (backlinks + minimal graph)
- [Note detail with typed properties + "Incoming backlinks (1)" panel](https://mobbin.com/screens/9d0db79a-cef1-4b10-b7c6-a06ba916c0d6)
- [Note showing a single incoming backlink rendered as a quoted sentence](https://mobbin.com/screens/fdacd3ac-a6a7-45e9-b6dc-98a47338c16f)
- [Daily note with inline `[[wiki-link]]` references in body text](https://mobbin.com/screens/1ab13734-291f-46f7-8843-9240c70c0325)
- [Daily note with bulleted link list + published-URL note actions](https://mobbin.com/screens/a2c5fe18-668a-4f0d-b6a7-917421fba32e)
- [Map view — sparse force-directed graph with filter popover](https://mobbin.com/screens/bcf9fd6e-05ba-4fef-ab8b-6a61d3b86d5d)

### Frame (wiki node + inline mention chips)
- [Wiki doc detail: breadcrumb, tree sidebar, inline page-reference chip](https://mobbin.com/screens/ef537f92-af66-4f28-8f2c-9105c50d3cad)
- [Same doc with hover state on the inline reference chip](https://mobbin.com/screens/05dfb723-c79d-4478-90b0-5552f13bd2ba)
- [`@`-mention autocomplete dropdown for linking another page](https://mobbin.com/screens/8ebf420f-0a6c-4a38-a9ea-7b8e6bb4fca0)

### Fibery (relations, workspace map, database tree)
- [Workspace Map — cards of databases with field chips, dotted connectors](https://mobbin.com/screens/c8802ed3-80a8-4af0-986b-2a5fe00996c3)
- [Relations editor — single entity (USER) with `+` connect affordances on each side](https://mobbin.com/screens/0faf78da-f474-4e06-9f9f-c08ff615389d)
- [Workspace Map (cleaner) — entity cards with colored type tags](https://mobbin.com/screens/8d9b55e8-241c-417c-ad8d-647b89e58719)
- [Whiteboard "Connections" — boxes + labeled edges as a concept map](https://mobbin.com/screens/dcce4f94-bdb8-4b33-9f54-863362dc7467)
- [Database table view with field columns + tree sidebar](https://mobbin.com/screens/06024252-58ed-405a-8ba2-89a48cd2e6b8)

### Linear (sub-issues, parent, mentions)
- [Issue detail: Sub-issues with N/M progress counter + parent breadcrumb](https://mobbin.com/screens/a9e8ca62-7809-4deb-a861-9524482dbb54)
- [Issue with full sub-issue list, each row showing project/status/assignee](https://mobbin.com/screens/c374e41b-569b-4c33-af23-4a487f00e631)
- [Inline create of a sub-issue under the parent](https://mobbin.com/screens/6cd65ea1-5c42-4193-9656-67a6ee6007ea)
- [Issue with Sub-issues + Links section + right-rail properties](https://mobbin.com/screens/fca1e49a-c6b1-446d-87e8-6f1d94b15e4f)

### Notion (properties on items)
- [Table with multi-select property editor popover (typed, colored tags)](https://mobbin.com/screens/b6e8ee30-5415-4691-9bcf-a8fff6096fb9)
- [Property menu: change type, sort, group, freeze, hide](https://mobbin.com/screens/841ae11d-d9e0-43ce-9d45-0405415af97f)
- [Status property with grouped option editor + color picker](https://mobbin.com/screens/83e2d66a-d836-406f-b72d-d5bc20e1d16f)

### Detail-page patterns (other apps)
- [Plane: work item with Add sub-item / Add relation / Add link + right-rail props](https://mobbin.com/screens/00822f3b-935c-47cc-a4f7-e996bd0a94e6)
- [Customer.io: entity with Overview/Attributes/Relationships tabs + "No relationships" empty state](https://mobbin.com/screens/a4908591-f45a-4e31-a82c-a9fb89a9211f)
- [Salesforce: product with Related tab — collapsible related-list sections + counts](https://mobbin.com/screens/ae6cdc4a-5b08-4d00-980f-67926330e35c)
- [OpenSea: NFT detail with Traits grid + collapsible related sections](https://mobbin.com/screens/4cf9f04b-2df7-418d-bc0f-e7888fa2435b)
- [Dovetail: doc with right-rail "By topics" linked-evidence references (numbered citations)](https://mobbin.com/screens/20c2bacf-8813-4dc4-949c-4453be6201ab)
- [TheyDo: Insights list + right-rail entity panel with typed properties + score](https://mobbin.com/screens/be5978de-879e-4dbf-a943-04561f8ecb20)

## Patterns

**Two layouts dominate the detail page.** (1) A **right rail of properties** beside a centered body — Linear, Plane, TheyDo, Air, Frame.io. Properties are a vertical stack of label + value rows (icon, gray label left, value right): State, Priority, Assignee, Project, Parent, Labels, Due date. Calm because the body stays clean text and metadata is parked to the side. (2) **Tabs across the top** — Customer.io (Overview / Attributes / Relationships / Activity), Salesforce (Configuration / Related / Details), OpenSea. Relationships get their own tab when there are many; the default tab stays uncluttered.

**Relationships are shown three ways, in increasing weight:**
- **Inline reference chips** (Frame, Reflect, Notion) — a linked page appears mid-sentence as a small pill with a tiny icon. Lowest friction; the relationship lives where the thought is. Frame's `@` trigger opens an autocomplete list of pages with type icons.
- **Backlink / "mentioned-in" panels** (Reflect, Dovetail) — a collapsible section at the **bottom** of the note: "Incoming backlinks (1)", then each backlink rendered as the **actual quoted sentence** that mentions this item, with the source note title as a link. This is the standout idea: you see *context*, not just a list of titles. Dovetail does the citation version — numbered chips that map body claims to source evidence in a right rail.
- **Structured relation lists** (Linear sub-issues, Salesforce related lists, Plane relations) — labeled sections ("Sub-issues 0/4", "Links 1", "Categories (1)") each collapsible with a count and a `+` to add. Linear's sub-issue rows carry their own mini-metadata (status dot, project chip, assignee avatar) and a **progress counter** (0/4) — quietly game-like.

**Graph/map views exist but are restrained.** Reflect's Map is a sparse force-directed scatter of small colored dots with labels — colors encode type (daily vs regular, published vs private), and a filter popover toggles "Show unlinked"/"Show blank". It is decorative-leaning; the real work happens in backlinks. Fibery's maps are more useful: **cards** (not dots) on a canvas with colored field/type tags and labeled connector lines — closer to an architecture diagram than a hairball. The lesson: node-as-card with readable labels beats node-as-dot.

**Properties read calm when they are label+value rows, not a grid.** Linear/Plane right rails use one property per line, muted gray labels, small type-specific icons, colored pill values only for enums (status, priority, labels). Notion shows the editing depth (typed properties: multi-select, status with grouped options, per-property color) but the *display* stays as quiet colored tags. Color is used sparingly and semantically — green = validated/done, amber = in progress, by-type tag colors. Type treatment: large bold title, generous body line-height, small (12–13px) gray metadata labels.

**Empty states are explicit and gentle.** Customer.io renders a centered icon + "No relationships" rather than hiding the section — it teaches that the relationship type exists and is currently empty. Linear shows "Sub-issues 0/1" with the slot visible.

**Interaction cues:** hover reveals a `+` add affordance on relation sections and on Fibery's connect points; inline chips get a hover ring/preview; "Saving…" appears briefly in the header; collapse chevrons on every relation section. Motion is minimal — fades and section expand/collapse, no flashy transitions.

## For zuzuu

**Module (knowledge item) detail page — adopt the Linear/Reflect hybrid.**
- Centered body: large title (the fact's headline) + the one-fact text with generous line-height. Keep it readable like a Notion page, never a code panel.
- **Right rail of properties** as label+value rows: `type`, `source` (which session/trace it came from), `generation` (which lockfile it's pinned in), `confidence`/`score`, `faculty`, `created`. Muted gray labels, icons, colored pills only for enums. This is the calm home for all the machine metadata zuzuu carries without making the fact look like a database row. (See Linear/Plane/TheyDo rails.)
- **Avoid** Salesforce/Customer.io's dense multi-tab admin feel as the *default* — tabs are fine to hide overflow (e.g. an "Activity"/"Provenance" tab) but the first thing you see should be the fact + a few relations, not a tab bar.

**"How items connect" — lead with backlinks, not a graph.**
- Adopt **Reflect's quoted-context backlinks** at the bottom of each item: "Related (3)" → each related item shown as the *sentence/snippet that connects them* plus a link to the source. This is the single most zuzuu-aligned pattern: it surfaces *why* two facts relate, which is exactly the provenance story (this fact corroborated by that session). Far more welcoming than a node list.
- Adopt **Linear's sub-relation rows with a progress counter** for structured links: an item can list "Used by actions (2/5)", "Supersedes (1)", each row carrying a status dot + type chip + `+` to add. The N/M counter is the quiet Duolingo-progression beat — it makes faculty health legible at a glance.
- Adopt **Frame's inline `@`-mention chips** for authoring links between facts during a session: type `@`, get a typed-icon autocomplete, drop a pill. Low-friction graph-building that matches zuzuu's "cite in-flight" contract (`from knowledge: <id>`).

**The graph map — ship it later, as cards not dots.**
- If/when a "graph view" lands, follow **Fibery's card-on-canvas** model (readable node labels, colored type tags, labeled edges) over **Reflect's dot-scatter**. A dot hairball is decorative and intimidating for a consumer-grade feel; labeled cards stay welcoming and actually navigable. Gate this behind the simpler backlink/relations views — it is a power feature, not the front door.
- **Avoid** making the graph the primary "how items connect" surface. Every studied knowledge app (Reflect, Fibery) puts the real linking work in backlinks/relations, not the map.

**Empty + onboarding states — copy Customer.io's gentle explicit empties.**
- Render "No related items yet" with a soft icon and a one-line hint ("links appear here as zuzuu corroborates this fact"), never a blank void. This teaches the relationship model and keeps the tool feeling alive on day one — directly serving the "welcoming, uncomplicated" goal.

**Color & type discipline.** Use color only semantically (green validated, amber pending review, type-tag colors for faculties: knowledge/memory/actions/instructions/guardrails). Keep labels small and gray; keep the body the visual hero. This is what separates Notion-calm from VS-Code-dense.

## Standouts

1. **[Reflect — note with Incoming backlinks rendered as quoted sentences](https://mobbin.com/screens/fdacd3ac-a6a7-45e9-b6dc-98a47338c16f)** — the best single idea for zuzuu's "how items connect": show *context*, not titles. This maps 1:1 to provenance.
2. **[Linear — issue with Sub-issues (0/4 counter) + Links + right-rail properties](https://mobbin.com/screens/501142cb-2278-43f7-9d98-c43a3bf75450)** — the gold standard for a calm detail page: structured collapsible relation sections, progress counters, and a quiet properties rail. The template for the module detail page.
3. **[Fibery — Workspace Map with entity cards + colored type tags + labeled connectors](https://mobbin.com/screens/8d9b55e8-241c-417c-ad8d-647b89e58719)** — the model to follow *if* a graph view ships: readable cards over a dot hairball.
