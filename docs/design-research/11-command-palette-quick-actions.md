# 11 — Command Palette & Quick Actions

## Brief

**The zuzuu surface this informs:** a Cmd-K command palette for the workbench — one overlay that lets a user jump to a module, run an action, switch session, search knowledge, and trigger `zz` commands. Plus any global-search / quick-switcher overlay. Today the workbench reads like a VS Code terminal; the palette is the single highest-leverage element for making it feel consumer-SaaS-grade — calm like Notion, progressive and game-like, welcoming, uncomplicated.

**Design questions this research answers:**
- One palette or two (command-mode vs. search-mode)? How do the best apps blend "do something" with "find something"?
- How are heterogeneous results (navigation / actions / sessions / knowledge / `zz` commands) **grouped and ranked** without feeling busy?
- What keyboard affordances must be visible (shortcut hints, nav/select/close footer) to teach power use without nagging beginners?
- How calm vs. how game-like — what carries warmth (empty/recent state, coach-marks, motion) without clutter?
- Icon language, density, type scale, and color restraint that read as premium, not IDE.

## Studied

Grouped by app; each is a link to its Mobbin screen.

**Linear**
- [Command palette — issue context, actions with single-key hints](https://mobbin.com/screens/c8989882-c549-4cf7-b57b-26deb3e0a994)
- [Onboarding "try the command menu" — assign / status / priority](https://mobbin.com/screens/8a6d227b-63e6-483c-925f-d256d0989a10)
- [Keyboard shortcuts reference panel (General / Navigation)](https://mobbin.com/screens/06bbb97f-9571-41b3-9a68-1fc66f32f43b)

**Raycast-style / launcher patterns**
- [Fey — command palette with per-row letter shortcut rail (X/A/F/I/E)](https://mobbin.com/screens/ff52ac90-4d18-4765-98da-df1e362a5ee1)
- [Superhuman — Command, typed query "go to done", action list with letter hints](https://mobbin.com/screens/85dc5994-9360-428d-9092-7425e070ed7f)
- [Superhuman — chord teaching ("G then E") inline coach-mark](https://mobbin.com/screens/68b22cd4-b6ef-48ee-a6a9-592e1c460570)
- [Clay — "Type a command", General Actions group + onboarding coach-mark](https://mobbin.com/screens/9112b54f-92d1-4a46-a48f-6f1150b4c03f)

**Notion / docs tools**
- [Notion — global search with scopes (Title only / Created by / In), AI option, preview pane](https://mobbin.com/screens/6573e834-dc7c-42e4-812f-be159ac1f887)
- [Slite — keyboard shortcuts full grid (App / Editor), two-column](https://mobbin.com/screens/2e1cc584-70e7-4698-b1da-bf1e6239b00f)
- [Microsoft Loop — quick switcher, Recent pages / Recent workspaces](https://mobbin.com/screens/24f59200-51a6-4d71-a02d-6428f2ead199)
- [Evernote — search-or-ask, Today/Yesterday date grouping, AI-Powered toggle](https://mobbin.com/screens/3120a6eb-313c-492d-96f2-63b5656c80be)
- [Reflect — search with live preview pane (entity detail on right)](https://mobbin.com/screens/40df0591-51c4-41b0-a14b-9d04e99aa5f3)

**Dev / agent tools (closest to zuzuu)**
- [Replit — command palette, Files/Search/Tools groups, jump-to-tab](https://mobbin.com/screens/6d3bb3c3-ebbe-4376-a8c0-bd8a6727d3fc)
- [Replit — "Run a command" list with descriptions (account/extension/org)](https://mobbin.com/screens/1817a08e-f7da-44f9-b1f4-8a903aefa5fa)
- [Vapi — palette: Actions + All Pages, section labels with sublabels](https://mobbin.com/screens/593d7acd-2e16-4365-bcd6-02ce52f48f3b)
- [GitHub — jump-to switcher, Owners / Repositories groups](https://mobbin.com/screens/7b69b36d-15c3-43c2-9a67-fe19ddbe98ad)
- [Google AI Studio — slash-command launcher (/build /chat /key /shortcuts)](https://mobbin.com/screens/d3212a1c-a0f1-49fb-835c-737c0117c3bd)
- [Langdock — grouped search (Agents / Workflows / Chats / Settings)](https://mobbin.com/screens/9c45e8ef-bc96-4b1c-bd22-f49b9118a7c3)
- [StackAI — palette of Tabs with descriptions + footer hints](https://mobbin.com/screens/bbcc94bb-f535-4dca-8532-56b135fce5c3)
- [Stitch — canvas command palette (Paste/Select/Zoom) with shortcut column](https://mobbin.com/screens/465a40f8-1af9-4969-90a8-aa5a6dbefd7e)

**SaaS search/switcher**
- [Todoist — search-or-command, Recent searches / Recently viewed / Navigation](https://mobbin.com/screens/4121eb20-aa88-4eef-9cc2-dfa7c4ccb4fa)
- [Databricks — search with type chips (Notebooks/Tables/Jobs), "open in full page"](https://mobbin.com/screens/4a532e93-ecd3-4b4d-8c44-68961b40ac06)
- [Lovable — project switcher, Recent projects with thumbnails](https://mobbin.com/screens/31dce00f-7f65-43ab-b819-b298d507362d)
- [Basedash — dark palette, arrow-key nav, "Use arrow keys to navigate" footer](https://mobbin.com/screens/3ef6da6d-d4c3-4f89-a3aa-95f0c477c84c)
- [Shopify — search with count chips per group, "show N more" + scoped fallbacks](https://mobbin.com/screens/e08665e8-5ff2-4750-86f2-e2abdf795d68)
- [Pipedrive — left category rail + results, all-categories filter](https://mobbin.com/screens/56e9d659-8d30-471b-a641-f00e313dca04)
- [Loops — pages list with chevrons + Docs link in footer](https://mobbin.com/screens/d98dc6f9-1154-4190-960c-f1b4d5f47bb4)
- [Revolut Business — Products / Quick actions / Select an issue grouping](https://mobbin.com/screens/69b07fdb-910f-440e-8d34-0834c7808b5d)
- [Sana AI — keyboard-shortcut card grid with chord glyphs + descriptions](https://mobbin.com/screens/cdd5147b-b244-4f90-a2ff-b08bfbc720a9)

## Patterns

What I actually saw in the screenshots.

**Layout & grid.** Near-universal: a centered modal, ~480–560px wide, anchored ~12–18% from the top (Linear, Clay, Superhuman, Todoist, Vapi, Replit, Bonsai). A single column of full-width rows. Search input pinned at the very top (often with a leading magnifier glyph), results below, and a thin footer strip with keyboard legend (Linear, Todoist, Basedash, StackAI, Databricks). Reflect and Notion add a **right-side preview pane** — the left list narrows and a detail/preview renders on selection. Pipedrive is the outlier: a **left category rail** drives a right results column (heavier, more app-shell than overlay).

**Spacing & density.** The premium-feeling ones are generous: Linear, Clay, Superhuman, and Todoist give each row ample vertical padding (~36–44px) so the list reads as a calm menu, not a table. Denser, more "tool" feeling palettes (Slite shortcuts grid, Replit Files list, Shopify results) pack rows tighter — fine for reference grids, but they read busier. The calm/game-like target sits with Linear/Clay/Superhuman density, not Shopify/Slite.

**Hierarchy & grouping.** Two grouping strategies recur:
1. **By kind** — uppercase, muted, small section labels: Clay "GENERAL ACTIONS", Vapi "Actions / All Pages", Replit "Tools", GitHub "Owners / Repositories", Langdock "Agents / Workflows / Chats / Settings", Todoist "Recent searches / Recently viewed / Navigation", Revolut "Products / Quick actions / Select an issue". Sections are separated by whitespace + a faint label, never heavy dividers.
2. **By recency/time** — Evernote "Today / Yesterday", Loop "Recent pages / Recent workspaces", Lovable/Bonsai "Recently viewed".
Most apps lead the empty/just-opened state with **Recent** or **Suggested** items so the palette is never blank — it greets you with your own context (Loop, Lovable, Todoist, Dovetail, Databricks, Slite-search).

**Color usage.** Restraint dominates. Light palettes (Notion, Clay-light?, Todoist, Vapi-pages, Loops, Shopify) are near-monochrome: white surface, gray-900 text, gray-500 sublabels, a single accent only on the selected row's left border or background tint (Todoist's faint red rail, Notion's blue active). Dark palettes (Fey, Superhuman, Basedash, Revolut, Stitch) use deep gray/black surfaces with the same monochrome discipline; Fey's onboarding adds a one-time gradient headline ("It's in your hands"). Selection is shown by a subtle filled row background, not a saturated highlight. Color is reserved for: brand accent on the active row, and small type tags (Bonsai's "Invoice / Project / Contract" right-aligned labels, Notion's entity-type pills).

**Type treatment.** Two-line rows are the workhorse: bold/medium primary label + smaller muted description (Replit "account — Manage your account", StackAI "Projects Dashboard / Overview of all your projects", Sana "Start new chat / Directly open a new chat from anywhere", Revolut quick actions). Single-line rows used when items are self-evident (Loop pages, Clay actions). Input placeholder copy is doing onboarding work: "Type a command or search…" (Linear, Loops, Todoist), "Search or ask a question…" (Evernote), "Search pages…" (Vapi), "What would you like to do?" (Sana). Query terms are **bold-highlighted** inside results in several (Shopify, Hashnode, Langdock, Gusto).

**Iconography.** Every row carries a small (16px) leading line-icon, consistent stroke weight, muted gray (Replit, Vapi, Clay, Langdock, Todoist, Revolut, StackAI). Icons encode the row's *kind* (doc, action, navigation, tool) more than decoration — they're the fastest scan cue. App/integration rows swap line-icons for full-color brand logos (Lindy's Add-action, Replit's My Apps). zuzuu's five faculties map naturally onto five distinct line-icons.

**Result grouping signals.** Beyond labels: Databricks and Shopify put **count chips** on group tabs ("Settings 38 · Orders 4"); Shopify and Databricks offer a **"open in full page / show N more"** escape hatch at the bottom when results overflow. Whop/Hashnode/Notion use **filter tabs under the input** (All / People / Files…) to scope without retyping. Notion exposes scope chips (Title only, Created by, In:) as removable filters.

**Keyboard affordances.** The signature of these palettes is a persistent **footer legend**: "↑↓ to navigate · ↵ Open · ⌘K to open · Esc to close" (Linear, Todoist, Bonsai, StackAI, Databricks, GitBook, Evernote, Basedash). Per-row **shortcut hints** are shown as right-aligned kbd chips: single letters (Linear A/I/S/P/L; Superhuman E/H/S; Clay N/P), chords ("G then E" Superhuman/Todoist, ⌘⇧K), and Fey's dedicated right-edge **letter rail** mapping each visible row to a key. Reference grids (Slite, Sana, Linear shortcuts, Pitch) render keys as styled kbd glyphs in 2–3 columns. Several teach the entry shortcut *in situ*: Gusto "Press ⌘K to access search anytime", Gamma "open this anywhere by pressing ⌘K".

**Motion / interaction & onboarding.** Coach-marks are common on first run: Clay "Hit Command + K… instantly do or search for any action", Superhuman "Here's the shortcut for next time. Think G to go!", Fey "Commands are accessible at any time… navigate even faster by knowing their shortcuts", Gamma tip toast. These are dismissible, gradient-tinted, and appear *once* — teaching the power feature without permanent chrome. The overlay itself fades a scrim over the app (consistent ~40% black/white wash) so context stays visible behind.

**State handling.** Empty (just-opened) → Recent/Suggested. Typing → live-filtered grouped results with term highlighting. No results → scoped fallbacks ("Search for 'custom' in the App Store / Help Center" — Shopify; "Or ask anything to your AI assistant → Try ask" — Slite; "Start a new chat" — Dovetail). Overflow → "show more / open in full page". Selected → filled row + visible Enter affordance.

## For zuzuu

Concrete mapping to the Cmd-K palette. **Adopt** unless noted.

- **One blended palette, command-first (Linear/Superhuman/Clay).** Single overlay, placeholder "Type a command or search…". No mode switch to learn. Map the five faculties + sessions + `zz` commands into one filtered list. *Avoid* Pipedrive's left-rail two-pane — too app-shell, defeats the "uncomplicated overlay" goal.
- **Group by kind with quiet uppercase labels (Vapi/Clay/Langdock).** Suggested order: `Actions` (run zz / faculty ops) → `Go to` (modules, sessions) → `Knowledge` → `Recent`. Whitespace + faint label only, no heavy dividers. This is what makes heterogeneous results legible without feeling busy.
- **Never-blank open state = your context (Loop/Todoist/Lovable).** On open with empty query, show `Recent sessions` and `Suggested actions` (e.g. open digest, recent knowledge). This is also where warmth lives — greet the user with their own work, the calm-Notion feel.
- **Two-line rows: label + muted description (Replit/StackAI/Sana).** Each `zz` command and faculty action gets a one-line plain-language description. Turns the palette into self-documenting onboarding — beginners read, experts skim.
- **Leading kind-icons, one per faculty (Replit/Langdock).** Five consistent 16px line-icons (Knowledge/Memory/Actions/Instructions/Guardrails) + nav/session/command icons. Full-color only for true integrations. Icons are the fastest scan cue and reinforce the faculty vocabulary visually.
- **Right-aligned shortcut hints + persistent footer legend (Linear/Todoist/Basedash).** Show per-row kbd chips for the top actions and a footer "↑↓ navigate · ↵ run · esc close". This teaches power use passively — the Duolingo-progression feel: you graduate from clicking to chords. *Consider* Fey's letter-rail for the visible result set as an advanced touch, but only after the basics — it can overwhelm.
- **One-time coach-mark, dismissible (Clay/Superhuman/Fey).** First time the palette opens (or a banner on the workbench): "Press ⌘K anytime to run any zz command." Gradient-tinted, appears once. Avoid permanent instructional chrome.
- **Term highlighting + scoped no-results fallback (Shopify/Slite).** Bold the matched substring. On no match, offer "Run as zz command", "Search knowledge for '…'", or "Ask the agent" — never a dead end.
- **Restrained color, subtle selected-row fill (Notion/Todoist/Basedash).** Monochrome surface, single accent on the active row and on small type-tags (e.g. a faint pill marking which faculty a result belongs to, like Bonsai's right-aligned kind labels). This is the difference between premium-calm and IDE-busy.
- **Generous row density (Linear/Clay), not Shopify/Slite tightness.** Pick the calmer end of the density spectrum; the palette should feel like a welcoming menu, not a data table.
- **Optional preview pane for knowledge (Reflect/Notion).** When a Knowledge result is highlighted, render the fact/snippet in a right pane so users confirm before acting — strong fit for `recall`. Keep it optional/responsive so the overlay stays light on narrow widths.
- **Avoid:** count-chip-heavy headers (Databricks/Shopify) — useful in dense enterprise search but adds visual noise; for zuzuu's calmer surface, keep groups label-only. Avoid a separate full-page search result view at launch; the overlay should satisfy most jumps.

## Standouts

Three to revisit when building:

1. **Linear command palette** — the reference for command-first, context-aware (it carries the active issue), quiet grouping, single-key hints, and onboarding that *teaches* the menu. The closest spiritual match for a dev-tool palette that still feels premium. [palette](https://mobbin.com/screens/c8989882-c549-4cf7-b57b-26deb3e0a994) · [onboarding](https://mobbin.com/screens/8a6d227b-63e6-483c-925f-d256d0989a10)
2. **Superhuman Command** — best-in-class at *progression*: typed-query narrowing, per-action letter hints, and the "G then E — here's the shortcut for next time" coach-mark that turns every use into a lesson. This is the Duolingo-progression model for zuzuu's keyboard story. [command](https://mobbin.com/screens/85dc5994-9360-428d-9092-7425e070ed7f) · [chord teaching](https://mobbin.com/screens/68b22cd4-b6ef-48ee-a6a9-592e1c460570)
3. **Replit command palette** — the most direct analog for a coding workbench: Files/Search/Tools groups, jump-to-running-tab, two-line rows with descriptions, shortcut column. Shows how to fold "navigate / search / run / switch session" into one calm overlay. [palette](https://mobbin.com/screens/6d3bb3c3-ebbe-4376-a8c0-bd8a6727d3fc) · [run-a-command list](https://mobbin.com/screens/1817a08e-f7da-44f9-b1f4-8a903aefa5fa)
