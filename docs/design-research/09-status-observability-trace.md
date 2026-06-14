# 09 — Status, Observability & Trace Detail

Design research mined from Mobbin (web platform). Lane: **status, observability & trace detail**. Every observation below is from the actual screenshots examined, not app reputation.

## Brief

**The zuzuu surface this informs:** the **SESSIONS list** (a history of past agent coding sessions) and the **session-inspect / trace-detail view**. zuzuu captures every session as an OTLP trace — a tree of spans (tool calls, turns, durations). The product goal is to render this richly yet *calmly*: a readable activity timeline, not a Datadog wall of noise. Target feel: Notion-calm, Duolingo-progression, welcoming, uncomplicated.

**Design questions this research answers:**
1. How do best-in-class tools present a *list of runs/sessions* so it scans fast and feels light, not like a log dump?
2. How is a *span tree / waterfall* made legible to a non-SRE — what makes durations readable without a Datadog learning curve?
3. How do activity feeds turn dense chronological event streams into something calm and narrative?
4. What status, color, and density conventions read as "consumer SaaS" rather than "ops console"?
5. What to deliberately *avoid* from the observability genre (the noise traps).

## Studied

### Sentry (replay, breadcrumbs, trace waterfall)
- [Session Replay — breadcrumb event list with player](https://mobbin.com/screens/773f755a-fb69-41da-b630-2a65fe5afad2)
- [Session Replay — playback speed & timestamp menu](https://mobbin.com/screens/c18407dd-7a80-4af7-ba79-bcd821b4fa36)
- [Session Replay — console log tab beside player](https://mobbin.com/screens/bd17e9f4-1fc4-410b-8343-e08baef240e2)
- [Issue Details — trace waterfall with side span panel](https://mobbin.com/screens/f39fcbfd-d377-4bc0-beb1-92bee2598a28)
- [Replay — trace tab, nested span tree](https://mobbin.com/screens/b18d83e1-7711-4b57-8498-633de4848ce9)
- [Issue — breadcrumbs + trace preview stacked](https://mobbin.com/screens/a5f7099b-06fd-4ef1-82ec-a1bde861ce9c)
- [Issue — trace preview with hidden-spans collapse](https://mobbin.com/screens/16987d18-5642-44bf-a645-4b326df775a6)
- [Explore — Traces, charts over span samples table](https://mobbin.com/screens/6ab05b5f-3384-492f-882b-bf2aa462a2f8)
- [Explore — Traces query builder + span samples](https://mobbin.com/screens/03ec235b-0e50-4698-9b80-2994c5f312b7)

### Braintrust (LLM logs, trace tree, monitor)
- [Logs — traces table with duration/token columns](https://mobbin.com/screens/3f6f5937-8ae6-4ab1-b6de-c18034e68a20)
- [Logs — single-trace empty/filtered state](https://mobbin.com/screens/45884f4b-ec96-473d-8a8c-5054bce15803)
- [Logs — wide traces table, timeline header chart](https://mobbin.com/screens/16fc833f-6d16-4385-aa12-b845670e0891)
- [Logs — span detail panel (metrics, tokens, cost)](https://mobbin.com/screens/eeca0b54-0262-4eef-8a76-f548fe84a384)
- [Trace — span metrics header (duration, tokens)](https://mobbin.com/screens/a5c47246-f508-4ead-9cb6-5489c6bd9dec)
- [Monitor — small-multiple metric cards dashboard](https://mobbin.com/screens/bb0174f4-60aa-4e30-ac5f-73679b160f38)

### Cursor (agent run history)
- [Automations — run history table with status menu](https://mobbin.com/screens/8a1c7ab7-54f3-4284-bb15-b929555ef3da)
- [Automations — run history, mixed status badges](https://mobbin.com/screens/3a3842b1-f95f-4e4e-aec9-893fa8563a33)
- [Automations — run history, all-succeeded state](https://mobbin.com/screens/8c9f4c28-46ed-4b65-acd9-e0a3762d33e4)
- [Automations — status filter dropdown](https://mobbin.com/screens/0a1be4e8-0af1-43fc-b5cc-66826b8e85da)

### Attio (workflow run history)
- [Workflow Runs — run list + node canvas + overview rail](https://mobbin.com/screens/d8d6c229-4909-490c-83a1-a84958f82b83)

### Better Stack & incident.io (incident timelines)
- [Better Stack — incident timeline, dark, icon-led](https://mobbin.com/screens/c422bb62-e37b-43e3-a35f-afda363b18d3)
- [Better Stack — incident timeline with comment composer](https://mobbin.com/screens/2749fa0d-db70-4cf6-ac48-47e4311bb8a6)
- [incident.io — incident timeline, status-change cards](https://mobbin.com/screens/0b441174-3405-416f-a142-dfbb383d21f9)
- [incident.io — timeline with inline comment thread](https://mobbin.com/screens/8d27748b-e522-40ba-a951-f718beb76799)

### Vercel & Cloudflare (deploy activity, logs)
- [Vercel — Activity feed, plain-text event log](https://mobbin.com/screens/76997138-2ebb-4d1b-ae54-22485d3a9138)
- [Vercel — Monitoring query builder](https://mobbin.com/screens/6fba4421-7f21-474e-b4b8-078952d64808)
- [Cloudflare — Observability events log + bar chart](https://mobbin.com/screens/cbf28d46-8663-4731-a826-179bc4f0fb16)

### Other run/log lists & light dashboards
- [Airbnb — All activity feed (calm, consumer)](https://mobbin.com/screens/d4d97280-b2f8-41e0-8671-66fa030ad6c9)
- [n8n — Executions list, status + run time + ID](https://mobbin.com/screens/6947469e-9c8c-4644-8cae-56a1250195da)
- [Databricks — Job Runs, status + duration bar chart](https://mobbin.com/screens/1bd9f80c-3c2d-46ba-bd06-b6177a78ebdb)
- [WRITER — Observability Performance, KPI cards + line chart](https://mobbin.com/screens/32414e6a-da6f-44d3-bf38-bcf415fb544f)
- [WRITER — Activity log, status-pill table](https://mobbin.com/screens/262e03a6-99a8-48b1-8925-2ff6df0d23ad)
- [Adaline — trace list + inline waterfall popover](https://mobbin.com/screens/85e692f8-e7c5-4cce-ae0e-681d50e1f3f8)
- [StackAI — Run Details, node waterfall + I/O panel](https://mobbin.com/screens/5ef8b027-f8ea-4a46-9c11-ab04084430c2)
- [Relevance AI — agent run timeline, narrative steps](https://mobbin.com/screens/db919f38-24cb-4151-b995-2781392d7db2)

## Patterns

**Layout & grid.** Two dominant shells. (1) **List + detail rail**: a left column listing runs/replays, a center canvas, and a right panel that holds the *event stream* or *span metadata* (Sentry replay, Mixpanel, Braintrust logs, Attio, StackAI). The right rail is where dense data lives so the center stays calm. (2) **Full-width table** for run history (Cursor, n8n, Databricks, WRITER logs) — no chrome, just rows. The strongest detail views (Braintrust, StackAI, Sentry) put the *trace tree on the left/center and a single selected-span inspector on the right* — you never see all attributes at once, only the span you clicked.

**Spacing & density.** The calm references (Airbnb activity, Cursor run history, Vercel activity, WRITER) use **generous row height and lots of whitespace** — Airbnb's feed is one event per ~3 lines with a thin connector line and a date header, almost no borders. The noisy references (n8n executions, Sentry Explore traces, Braintrust wide logs) are **compact zebra/grid tables** packing 15-30+ rows. zuzuu wants the former's breathing room with the latter's column discipline.

**Hierarchy.** Date/section headers ("19 JUN 2023", "August 2024", "Today / This Week") chunk long lists into scannable groups (Airbnb, Vercel, Relevance AI sidebar). Within a row, the **primary label is bold/dark, metadata is small and gray** (timestamps, "by Jane Smith", durations). Trace trees use **indentation + connector rails** to show parent/child span nesting (Sentry waterfall, StackAI, Braintrust trace tree).

**Color usage.** Color is **reserved almost entirely for status**, everything else is neutral gray/black on white. Status semantics are consistent across apps: **green = success/completed, red = error/failed, amber/yellow = in-progress or "to be completed", blue/gray = neutral/info, purple = running** (Cursor, n8n, WRITER, Fresha, incident.io). Errors get a **tinted red row background** (n8n, Braintrust) so failures pop in a long list without you scanning a status column. Sentry's waterfall uses a single accent (red bar) for the slow/critical span and muted bars for the rest — color marks *what matters*, not everything.

**Type treatment.** Sans throughout. **Monospace appears only for IDs, durations, code/JSON I/O, and span ops** (Braintrust trace tree, Sentry attributes, StackAI I/O, OpenAI logs). Durations are right-aligned and terse ("204ms", "1.42s", "7m 33s", "<1m"). Numbers in metric cards are large and light-weight (WRITER "Total requests 26", Braintrust span "Duration 2.028s") — a Notion-calm KPI treatment, not a dashboard-gauge treatment.

**Iconography.** Small, single-color, consistent. Event-type glyphs lead each timeline row (Better Stack incident, Airbnb, GitLab) — a click icon, an email icon, an error icon. Status uses a tiny dot or check/x circle (n8n green check, Cursor pill, Attio green dot + "Completed"). Sentry breadcrumbs prefix each event with a typed colored icon (navigation, user-click, error) so the *kind* of event is pre-attentive.

**Motion / interaction cues.** Replay tools share a **scrubber/timeline at the bottom with event markers (colored dots) plotted along it** (Sentry, Mixpanel, Amplitude, Hotjar, Sprig) — clicking a marker or event-list row jumps the playhead; the event list and the scrubber are **bi-directionally linked**. Span rows expand/collapse ("47 hidden spans", "Collapse all"). Hover/click on a run opens a context menu (Cursor "View details / Cancel run") or a detail popover (Adaline inline waterfall, Attio node tooltip with status+runtime+credits).

**How dense data is made calm.** Five recurring techniques: (a) **progressive disclosure** — collapse deep spans, show "N hidden spans", expand on demand (Sentry); (b) **summary-first** — an AI/text summary or KPI header before the raw stream (Sprig "Summary" tab, Braintrust metrics header, incident.io); (c) **the detail rail** — attributes live in a side panel revealed per-selection, not inline; (d) **section chunking** by date/status; (e) **a tiny header sparkline/bar chart** over the list giving volume-over-time context without a full dashboard (Braintrust logs header, Cloudflare, Databricks duration bars).

**State handling.** Empty states are gentle and centered ("No data", Braintrust single-trace). In-progress runs show a live pill ("Running", purple) and a live toggle (Attio "Live", Cloudflare "Live"). Mixed-status lists are legible because failed rows are tinted, not just badged. Counts are summarized up top ("0 / 2 Successful", "61 Completed / 0 Failed", "3 REPLAYS").

## For zuzuu

**SESSIONS list — adopt:**
- A **full-width but airy table** (Cursor/WRITER density, Airbnb breathing room): columns = session name/intent, started-at (relative: "5h ago"), duration, status, maybe tool-call count. Right-align durations in mono.
- **Section headers by recency** ("Today / Yesterday / This Week") à la Relevance AI sidebar + Airbnb — this alone makes a long history feel organized, not endless.
- **Status as the only saturated color.** One pill per row: green completed, red crashed/failed, amber/purple active. **Tint the whole row faintly red for failed sessions** (n8n pattern) so problems surface at a glance — this is the single highest-value, lowest-noise move.
- A **slim header sparkline** of sessions-over-time or duration-per-session (Braintrust/Databricks) — gives "progression" energy (Duolingo) without a dashboard.
- **Counts summary strip** above the list ("12 sessions · 11 completed · 1 crashed") for instant orientation.

**SESSIONS list — avoid:**
- The n8n/Sentry-Explore compact zebra grid and the Vercel/Cloudflare raw-log firehose — they read as "ops console," the exact feeling to escape.
- A query-builder front door (Vercel Monitoring, Sentry Explore). zuzuu's user shouldn't compose a query to see their own sessions; default to a curated, sorted list.
- More than ~4-5 columns. Push everything else into the detail view.

**Trace-detail view — adopt:**
- **Three-zone layout** like Braintrust/StackAI/Sentry: a **span tree** (indented, connector rails, collapsible) as the spine; a **per-span inspector rail** on the right showing that span's metrics (duration, tool name, tokens if relevant) and its I/O — never dump all attributes inline.
- **A readable activity-timeline framing** of the span tree borrowing incident.io/Better Stack/Relevance AI: each top-level turn/tool-call is a **narrative card with a typed icon + relative timestamp**, so the trace reads like a story of what the agent did, then expands to span depth on demand. This is the bridge between "OTLP tree" and "Notion-calm."
- **Progressive disclosure**: collapse leaf spans by default, show "N more spans," and surface only the slow/critical span with an accent duration bar (Sentry's single-red-bar trick). Don't paint every bar.
- **Summary-first header**: a one-line AI/deterministic recap of the session + KPI chips (duration, # turns, # tool calls, # errors) before the tree — mirrors Braintrust's metrics header and Sprig's Summary tab.
- **Mono only for** span ops, IDs, durations, and code/diff I/O; everything else sans and gray.

**Trace-detail view — avoid:**
- A literal Datadog/Sentry-Explore **waterfall as the default** view. The waterfall is powerful but reads as expert tooling; offer it as a secondary toggle ("Timeline / Tree" like Braintrust's tabs), with the narrative timeline as default.
- Showing the full attribute table inline (Sentry's attributes grid) — keep it in the rail, collapsed.
- Multi-series latency line charts (P90/P95/P99 — WRITER/Sentry). Right concept for fleet-level metrics, wrong altitude for a single session; reserve for a future aggregate dashboard.

**Why:** the consistent lesson across every calm reference is *neutralize everything, colorize only status, and reveal detail per-selection in a rail*. The consistent failure mode of the genre is *uniform dense grids + color everywhere + all attributes always visible*. zuzuu wins by taking the observability *structure* (span tree, status, durations) and dressing it in *activity-feed* clothing.

## Standouts

1. **[Braintrust — Logs span detail panel](https://mobbin.com/screens/eeca0b54-0262-4eef-8a76-f548fe84a384)** — the cleanest "trace tree + per-span inspector rail with Metrics (duration, tokens, cost) and I/O" in the set. This is the closest existing analog to zuzuu's trace-detail target; nearly directly adoptable, just swap LLM metrics for tool-call metrics.
2. **[incident.io — incident timeline](https://mobbin.com/screens/0b441174-3405-416f-a142-dfbb383d21f9)** — the gold standard for making a chronological event stream read as a calm, narrative, card-based timeline with status-change chips and a quiet right rail of metadata. This is the *feel* to chase for the session timeline.
3. **[Cursor — agent run history](https://mobbin.com/screens/3a3842b1-f95f-4e4e-aec9-893fa8563a33)** — the most directly transferable SESSIONS-list reference: an agent-coding-tool run history that is airy, 4-column, status-pill-led, with a per-row context menu. Mirror this for zuzuu's sessions list, then add recency section headers and the failed-row tint.
