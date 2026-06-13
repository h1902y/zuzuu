# File Tree & Workspace Navigation — Mobbin design research (web)

> Research lane: **File tree & workspace navigation.** Informs the zuzuu workbench **left sidebar** (file/module/faculty explorer) and the **workspace/vault picker**. Goal: move from a VS-Code-terminal feel toward a Notion-calm, Duolingo-progression, game-like, welcoming, uncomplicated consumer-SaaS surface. All screens below were examined as inline images on web platform.

## Brief

**zuzuu surfaces this informs**
- **Left sidebar (file/module/faculty explorer):** the nested tree the agent and human browse — in zuzuu's case the five faculties (Knowledge, Memory, Actions, Instructions, Guardrails) plus the hidden `.zuzuu/` internals surfaced as porcelain, and the user's own project files.
- **Workspace/vault picker:** the top-of-sidebar control to switch between projects/folders ("any folder-based work, coding is the first vertical").

**Design questions**
1. How do calm, consumer-grade products render a nested tree without feeling like an IDE explorer (dense monospace rows, chevrons, file-type glyphs)?
2. Where does the workspace/project switcher live, and what does its open state show (recents, starred, account, "add workspace")?
3. How are sidebar sections grouped and collapsed so a 5-faculty + files structure reads as organized, not crowded?
4. How is in-sidebar search/filter surfaced inline vs. as a command palette?
5. What spacing, type, color, and iconography choices separate "developer tool" from "welcoming product"?

## Studied

### Notion (the calm-tree benchmark)
- [Notion — sidebar with Recents / Agents / Private / Teamspaces / Notion apps groups](https://mobbin.com/screens/03c9e00d-9d01-4f50-90e4-04f969e0442e)
- [Notion — same sidebar, page with full-bleed cover](https://mobbin.com/screens/f2dcf700-2fe5-4633-a706-e0391c025432)
- [Notion — Search/Updates/Settings top group + Workspace + collapsible Private tree](https://mobbin.com/screens/d8223bc0-27ad-4ed1-9e4b-bb351132c3aa)
- [Notion — workspace switcher popover open (account, switch, Add workspace)](https://mobbin.com/screens/eb0b0242-8e97-41c0-b2b0-f7446a6f7b3c)
- [Notion — dark-mode Home with "Recently visited" card row + sidebar tree](https://mobbin.com/screens/162fae1f-956f-4c9e-8582-d098ebf35038)
- [Notion — nested toggled pages (Getting Started / Quick Note / Journal) with chevrons](https://mobbin.com/screens/aaa51c05-c3cc-4737-b7c3-545ba0babd6c)
- [Notion — workspace switcher with "Mobbin Team (Suggested) · Join"](https://mobbin.com/screens/7d92c438-ee81-4dda-8eaf-f7ee1ffb4ed3)
- [Notion — Teamspaces home with Suggested/Trending/Learn cards](https://mobbin.com/screens/c82e9357-50f8-4841-9bd7-8ac72dc701f1)

### Dropbox (file tree + breadcrumb + detail pane)
- [Dropbox — left tree (All files → John Smith → Design Resources → Avatars) + main list + detail pane](https://mobbin.com/screens/3fa8d65c-789b-4940-9067-3b58ffb1619f)
- [Dropbox — view-mode menu (Grid / Large grid / List / Large list)](https://mobbin.com/screens/5dcfb9ab-6224-4e19-9f9d-39c4090107e2)
- [Dropbox — collapsed tree state (Avatars folded away)](https://mobbin.com/screens/97a98052-6c82-4879-813b-cfeb372e9dba)

### Developer / build tools (the IDE-feel baseline to soften)
- [GitHub Codespaces (VS Code web) — EXPLORER tree + tabs + terminal panel](https://mobbin.com/screens/7018ee13-f8ed-4aff-8ec2-d235ab296827)
- [Vercel — Source/Output file tree of a build (`.next`, static, chunks)](https://mobbin.com/screens/90c37e80-4db1-4ad8-83e1-be939f21de43)
- [Replit — right-hand Files tree (folders + typed files) beside agent chat + preview](https://mobbin.com/screens/cdb8d6bb-c0d0-4dae-b8e0-d563ac5d0633)
- [Mintlify — light Files tree (README, ai-tools, snippets…) with "Select a file to edit" empty state](https://mobbin.com/screens/8084b2a3-1555-4d6a-bfd3-d86e147a7329)
- [Base44 — light Code files tree (entities / src / pages) beside chat + syntax view](https://mobbin.com/screens/a6f49f0c-5f81-40f4-b4e3-0e6f570feb99)
- [Base44 — in-tree "Search in files…" field with helper text](https://mobbin.com/screens/140f7004-3147-4a61-8167-32d753f74bb8)
- [Lovable — dark Files tree + Search field + tabbed code pane](https://mobbin.com/screens/43a94ab5-9627-4b46-9006-21a21b620fc0)
- [Codecademy — three-pane (Files / editor / preview) with active-file highlight](https://mobbin.com/screens/4fda87af-1dd4-417a-87f9-1d9bfbc3e22b)

### Grouped / collapsible navigation sidebars
- [Zoho CRM — collapsible groups (Sales / Activities / Inventory) with chevrons + icons](https://mobbin.com/screens/5da66ee2-7366-470b-bc39-ffa47c81b7fc)
- [GitBook — Docs sites + Spaces grouped tree with section labels](https://mobbin.com/screens/fd51f33a-6e83-47fa-9ef6-1e2a5c2902ed)
- [Fibery — left tree (Top Requests / Backlog / views) + "Select Database" picker](https://mobbin.com/screens/7f9247fd-7537-48fe-bfc4-206c1360129f)
- [YNAB — accounts grouped (Starred / Cash) with running balances in the tree](https://mobbin.com/screens/62817fae-ab1b-43cf-a15d-3d372afd32ca)

### Workspace / project switchers
- [Jira — Projects dropdown (Starred + Recent + View all / Create project)](https://mobbin.com/screens/5a321cfa-4c6c-4be2-b92b-1564e78a92b5)
- [Airtable — "All workspaces" sidebar entry + recents list in main pane](https://mobbin.com/screens/426d3df1-3c09-4ae1-bf5d-fb7bd4e76ba0)
- [monday.com — "Main workspace" switcher with inline sidebar search + Recently visited cards](https://mobbin.com/screens/06ee9b9d-4ba3-4337-8816-5c32f8d04d85)
- [Runway — "Select a Workspace" modal (plan badges, "Don't show again")](https://mobbin.com/screens/228d6f10-a4f2-45e9-82c8-a46cf52f1bde)
- [Hex — workspace command palette over the sidebar tree (Projects + Recent data)](https://mobbin.com/screens/9b8b928c-3fd7-48f1-82a9-97140d853f9f)

### Inline sidebar search / filter
- [Grain — top-of-sidebar Search nav item, results in main pane](https://mobbin.com/screens/9bab0d84-e9aa-4437-a16b-3296755417aa)
- [Hashnode — "Search articles" field + Filter popover with live-narrowing list](https://mobbin.com/screens/4afb3457-f0af-45f9-b783-2dd2491380e4)
- [Dovetail — inline filter chip ("Title contains Interview") editing in place](https://mobbin.com/screens/78123cdc-7b95-44f1-aafb-d9fb7a41e32c)

## Patterns (what the images actually show)

**Layout / grid.** Two dominant shells. (1) **Calm product shell** (Notion, monday, GitBook): a single ~240px left rail of grouped text rows, generous main canvas, no persistent third pane. (2) **IDE/build shell** (Codespaces, Replit, Base44, Lovable, Codecademy): three columns — narrow file tree, code/editor, preview — tree rows tight and monospace-adjacent. Dropbox is a hybrid: tree rail + list + a right **detail pane** that appears on selection. The calm shell is what zuzuu should converge on; the IDE shell is the current "VS Code terminal" feeling to retire.

**Spacing & density.** The clearest tell between welcoming and developer-y. Notion/monday rows have tall line-height, comfortable left padding, and air between groups — each row reads as a tappable object. Codespaces/Vercel/Replit trees pack rows tightly with small glyphs and thin indents — efficient but cold. Dropbox sits in between: roomy rows but a classic chevron+folder tree.

**Hierarchy.** Nesting is shown three ways: (a) **chevron disclosure triangles** + indentation (Notion, Dropbox, Zoho, Codespaces) — the universal tree affordance; (b) **labeled section headers** that themselves collapse (Notion's "Recents / Private / Teamspaces"; GitBook's "Docs sites / Spaces"; Zoho's "Sales / Activities / Inventory") — grouping by *kind* before depth; (c) **breadcrumb in the header** (Dropbox "Mobbin / Design Resources") to show location without forcing the tree open. Notion's two-tier model — semantic group headers up top (Search/Inbox/Settings), then the actual page tree below — is the strongest organizing idea seen.

**Color usage.** Calm tools are near-monochrome: grey text on white, a single accent (Notion grey/black; monday's restrained purple; GitBook's green only on the active item). Selection = a soft grey/tinted fill behind the row, not a hard border. The IDE tools lean dark with syntax color, which reads technical. YNAB shows a useful exception: small **color-coded balances/status** living inside tree rows to convey state at a glance.

**Type treatment.** Product shells use a clean sans at a readable size for *every* row, including the tree (Notion, monday, GitBook). IDE shells shrink tree text and tilt monospace. Group headers are smaller, uppercase or muted, and visually quiet so the items stand out.

**Iconography.** Two schools. Notion uses **emoji/page-icons per item** — warm, personal, recognizable. Zoho/monday/GitBook use a **consistent line-icon set** (one icon per nav item, same weight) — tidy and calm. The IDE tools use **file-type glyphs** (`.tsx`, `.json`, folder) — informative but busy. Lucide-style line icons recur across the welcoming examples.

**Motion / interaction cues.** Chevrons rotate on expand; sections collapse smoothly; the workspace switcher is a **popover anchored to the top-left identity row** (Notion, Jira) rather than a full nav change. Hover reveals row affordances (a "+" to add, a "···" overflow) only on the hovered row (Notion, Fibery, Dovetail) — keeping the resting state clean. monday/Notion surface a **"Recently visited" card strip** in the main pane as a softer, more visual recents than a dropdown list.

**State handling.** Active item = filled/tinted row. **Empty states are friendly**, not blank: Mintlify "Select a file to edit", Base44 "Type at least 2 characters to search", Notion's onboarding checklist. Recents/Starred are first-class (Jira Starred+Recent split; Notion Recents group; Dropbox Recents/Starred/Shared). Collapsed groups persist. Search has a clear typed-feedback state.

## For zuzuu

**Left sidebar (file/faculty explorer) — adopt**
- **Notion's two-tier sidebar** for the faculty home: a quiet top group of porcelain verbs (Digest, Search, Status) → then a grouped, collapsible tree where the **five faculties are labeled section headers** (Knowledge / Memory / Actions / Instructions / Guardrails), each expanding to its items. This makes the 5+anatomy legible without an IDE feel.
- **Calm density:** tall rows, generous left padding, real air between faculty groups, one clean sans for every row (no monospace in the rail). This is the single biggest lever away from "VS Code terminal."
- **Consistent Lucide-style line icons**, one per faculty (and a distinct mark for Guardrails so "enforced" reads visually). Reserve emoji/page-icons for user-created items (Notion-style warmth) if/when relevant.
- **State in the row, YNAB-style:** show faculty health/generation or a tiny proposal-count badge inline (e.g. "Knowledge · 3 pending") — surfaces the evolve loop and adds the Duolingo-progression cue.
- **Hover-only affordances:** show "+" (propose to inbox) and "···" overflow only on hover; resting state stays minimal.
- **Friendly empty states:** an un-initialized faculty should read like Mintlify/Notion ("No actions yet — propose one with `zz act propose`"), never a blank pane.
- **Breadcrumb in the content header** (Dropbox-style) so deep navigation doesn't require keeping the whole tree expanded.

**Left sidebar — avoid**
- The **three-pane IDE shell** (tight tree + code + preview) and **file-type glyph clutter** of Codespaces/Replit/Vercel — that *is* the look we're leaving. The embedded terminal stays the host surface in the middle pane; the faculty rail must read as product, not explorer.
- Dark + syntax-color as the default chrome; keep the rail near-monochrome with one accent. Soft tinted-fill selection, never hard borders.

**Workspace / vault picker — adopt**
- **Top-left identity row that opens a popover** (Notion/Jira pattern): current workspace + avatar, then a list to switch, **Starred + Recent split** (Jira), and a clear **"+ Add workspace/folder"**. Keep it a popover, not a route change.
- A **"Recently visited" card strip** on the workbench home (monday/Notion) as the welcoming, visual entry into recent vaults — warmer than a bare dropdown and on-brand for "any folder-based work."
- For first run, a **"Select a workspace" modal** (Runway) is acceptable as a one-time chooser with a "don't show again."

**Workspace picker — avoid**
- Burying the switcher in a settings menu, or a plain text dropdown with no recents/starred — it should feel like picking a save-file, not editing a config.

## Standouts (revisit first)

1. **[Notion — top groups + collapsible Private tree](https://mobbin.com/screens/d8223bc0-27ad-4ed1-9e4b-bb351132c3aa)** — the exact two-tier model (semantic verbs up top, grouped tree below) zuzuu should map the five faculties onto. The calm-density and icon discipline reference.
2. **[Notion — workspace switcher popover](https://mobbin.com/screens/eb0b0242-8e97-41c0-b2b0-f7446a6f7b3c)** — the cleanest top-left identity → switch → "Add workspace" pattern for the vault picker.
3. **[monday.com — switcher + inline sidebar search + Recently-visited cards](https://mobbin.com/screens/06ee9b9d-4ba3-4337-8816-5c32f8d04d85)** — shows the welcoming, game-like "recents as cards" entry plus an in-rail search, both directly reusable for the workbench home.
