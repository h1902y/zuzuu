# 00 — Design Directions (North Star)

> The synthesis of 14 Mobbin research lanes into one brief for zuzuu's visual redesign. Read this first, then `tokens-candidates.md`, then the per-surface lane file. Every claim here is grounded in the lane research; the strongest exemplars are cited by name.

---

## Vision

The zuzuu workbench should feel like **a calm, premium instrument that visibly makes your agent smarter** — Notion's quiet confidence, Duolingo's sense of earned progression, the warmth of a game you want to return to, but the seriousness of a tool that touches your codebase. Three references anchor the tone the whole way through: **Notion-calm** (90%+ neutral pixels, generous air, color rationed to meaning), **Duolingo-progression** (levels, streaks, counts that grow — but the *mechanic*, never the *costume*), and **serious-not-toylike** (the line where Tiimo/Tangerine confetti and Duolingo mascots tip premium into childish). Today the workbench reads like a VS Code terminal: dense monospace, file-type glyphs, raw logs as the default surface. The redesign retires that face without losing the substance underneath it.

The single insight that recurred across every lane: **calm is not the absence of information — it is information rendered with discipline.** The same data (a span tree, a credit balance, an allow/deny policy, an agent transcript) reads as "ops console" or as "consumer SaaS" depending entirely on three moves the references make again and again — *neutralize everything, colorize only state, reveal detail per-selection in a rail.* Lane 09 said it for traces, lane 12 said it for billing, lane 10 said it for policy, lane 13 said it for the whole token system: same numbers, but hierarchy + whitespace + color-discipline decide whether it feels like a tool you babysit or a product you trust. zuzuu's advantage is that its "XP" is *real* — the agent measurably learned things — so it can build motivation on facts and skip the artificial sweeteners that make consumer apps feel like toys.

The throughline that ties the surfaces together is **the agent that learns, made visible.** A newcomer must come away understanding "my agent is getting smarter" without opening docs (lane 14). That means every surface carries a faint progression signal — generations as levels, learned-counts as the loudest number, a graduation moment when a proposal mints into the active generation — woven *into* the work, never bolted on as a separate gamification layer.

---

## Principles

Nine named principles, distilled across lanes. These are the load-bearing decisions.

**1. Color only for state.**
The default surface is neutral — warm near-black in dark mode, warm off-white in light. Color earns its place by *meaning something*: a status (success/warn/error), a faculty identity (the five hues), or a thing that needs action (pending proposals, a guardrail denial). Nothing is colored for decoration; every calm-premium reference is ~90% neutral pixels. *(Lanes 03, 09, 10, 12, 13 — Modal reserves green/yellow/red exclusively for status; Plane tints only the status tiles.)*

**2. Receipts, not logs.**
A tool call, a file edit, a command run, a guardrail decision each collapse to a single line with a leading glyph ("Edited store.mjs", "Ran npm test", "Guardrail: blocked rm -rf"), expandable on click. What would be 40 lines of terminal becomes a one-line receipt in a legible timeline. This is the single most important move to turn terminal noise into conversation — and it maps onto zuzuu's faculty vocabulary (a receipt can cite `from knowledge: <id>`). *(Lanes 02, 09 — Replit's "Edited db/schema.ts" line items.)*

**3. Real XP, never fake currency.**
Borrow the dopamine *structure* of progression — generations-as-levels, streaks of clean sessions, learned-counts, graduation moments — and dress it in the *Brilliant + Me+ + Stripe* costume: abstract glyphs, embossed neutral medals, sparkline dashboards, numerals-as-hero, sentence-case copy. Never gems, coins, mascots, full-screen confetti, exclamation-heavy copy, or coercive streak-loss guilt. zuzuu's currency is its real artifacts — facts learned, actions graduated, generations minted. *(Lane 06 — the central thesis; Mimo proves it works for a dev audience.)*

**4. Preview the filled state.**
An unavoidably-empty first screen is never a void — it shows a faint rendered preview of what it *will* look like once populated, under a warm second-person headline and one CTA. Future-tense, value-first copy ("every run becomes something it can learn from") frames emptiness as the start of a trajectory, not "nothing here." *(Lane 14 — ClickUp's empty-Goals preview; Instacart's "Reordering will be easy"; lanes 01, 03, 04, 08 all reinforce gentle explicit empties.)*

**5. Two type registers, strictly bounded — mono = machine data only.**
A humanist sans (Geist) for *all* product chrome and prose; monospace (JetBrains) *only* for machine-produced data — ids, paths, durations, span ops, log lines, code, diffs. The moment mono leaks into nav, labels, buttons, or headings, zuzuu reads as a terminal — the exact failure we're fixing. Code blocks invert to a contained dark slab even in light mode so code reads as a discrete object. *(Lanes 02, 09, 13 — Modal/Vapi reserve mono for machine values; lane 13 codifies the boundary as a rule.)*

**6. Detail in a rail, revealed per selection.**
Dense data lives in a right-hand inspector that shows only the *one thing you selected* — a span's metrics, an item's properties, a checkpoint's composed state — never all attributes inline at once. The center stays calm; the rail absorbs the complexity. *(Lanes 04, 09, 10 — Braintrust's span-detail panel; Linear's properties rail; Attio's typed-value inspector.)*

**7. Calm by default, color-on-action.**
The resting state of every surface is monochrome and quiet. Affordances ("+" to propose, "···" overflow, ✓/✕) appear on hover; status color appears only when there's status to convey; a meter stays neutral/green until it nears a limit, then warms to amber/red. This is the difference between reassurance and anxiety. *(Lanes 01, 03, 12 — YNAB/Plane in-row state; Kajabi's bar flips red only at the cap; lane 01's hover-only affordances.)*

**8. Levels, not commits.**
Versioning is framed as progression, never a git log. Generations are an ordinal ladder (Gen 1 → Gen 2 → Gen 3, Confluence-style), checkpoints are plentiful safe save-states (Gamma's "7 snapshots"), and rollback is *append-not-destroy*: "make Gen 4 active again," logged as a new event, with the reassuring sentence "This won't delete Gen 5." Reserve the GitLab SHA-lane rendering and the word "revert" for never. *(Lane 05 — the core metaphor swap; lane 06 reinforces generations-as-levels.)*

**9. Finishable ceremonies, warm finishes.**
A pile of decisions (review/approve) is shown one-at-a-time with a "3 of 7" counter so it feels small and finishable, never an infinite feed. Each unit answers WHAT / WHY / WHAT-HAPPENS, with the consequence stated in micro-copy under the primary button ("Approve — mints Gen N+1"). Confirmation is a quiet toast + state flip + count decrement, and the queue ends on a warm empty state ("All caught up — you taught the agent 4 things today"). *(Lane 07 — Hex's self-describing actions, Cleo's one-at-a-time ceremony, Miro's empty-state finish.)*

---

## Workbench-wide language

The shared grammar every surface inherits.

**Layout grammar.** Two shells, chosen per surface, never mixed:
- **Calm product shell** for human-facing surfaces (faculty grid, digest, onboarding, knowledge detail, settings): a single ~240px left rail of grouped text rows + a generous main canvas capped to a ~640–720px reading measure, optionally a right rail for properties/history/inspector. This is the Notion/Linear shell.
- **Conversation-rail + work-pane split** for the session: a prose transcript carries the narrative; the embedded terminal becomes *one tab in a work pane*, demoted from default surface to on-demand. Raw monospace lives in that tab, never in the conversation.

The persistent frame is: **left sidebar (faculty/file explorer + workspace switcher) · center (the active surface) · right rail (context: properties, history, inspector, review — appears per surface, not always-on).** A Cmd-K palette overlays everything.

**Density.** zuzuu sits **one notch calmer than Linear** — between dev-tool tier and calm-app tier. Use dev-tier compact density *only* inside genuine data tables (the trace tree, the sessions list, the span inspector). Use calm-tier generous spacing (tall rows, real air between groups, ~20–24px card padding) for everything human-facing. Resolve the lane tension explicitly: lane 01 wants tall calm rows for the faculty rail, lane 09 wants compact discipline for the trace table — **both are right, scoped to their surface.**

**The calm-by-default / color-on-action rule.** Codified from Principle 1 + 7: surfaces rest neutral; the five faculty hues live only on icon chips, faculty badges, the active spine, chart series, and proposal-type tags — never as card backgrounds or large fills; semantic status colors (green/amber/rose) stay separate and appear only on state. A faculty card with nothing pending shows *no color*; an amber "3 pending" dot appears only when review is needed.

**Progressive disclosure.** Everywhere: collapse leaf spans ("N hidden spans"), keep diff behind a "Highlight changes" toggle (off by default), keep the active onboarding step expanded and others collapsed-with-check, keep WHY collapsed on a proposal card, keep the raw provisioning log one click away. The user never faces the firehose unless they ask.

**Keyboard model.** Cmd-K is the spine — one blended command-first palette (no mode switch), grouped by kind with quiet uppercase labels, never-blank open state (recent sessions + suggested actions), two-line rows with descriptions, leading kind-icons per faculty, right-aligned shortcut hints, and a persistent footer legend (↑↓ navigate · ↵ run · esc close). Teach power use passively via Superhuman-style one-time coach-marks ("G then E — here's the shortcut for next time"); never permanent instructional chrome. *(Lane 11.)*

---

## Current → Target, per surface

| Surface | Today (terminal-ish) | Target | Best references |
| --- | --- | --- | --- |
| **Left sidebar / nav** | Dense monospace tree, chevrons, file-type glyphs (IDE explorer) | Notion's **two-tier rail**: quiet top group of porcelain verbs (Digest, Search, Status) → five faculties as collapsible section headers, tall calm rows, one Lucide line-icon per faculty, in-row state badge ("Knowledge · 3 pending"), hover-only affordances | Notion "top groups + collapsible Private tree"; Notion workspace-switcher popover; monday.com "recently-visited cards" |
| **Workspace / vault picker** | Buried / plain dropdown | Top-left identity row opening a **popover** (current workspace + Starred/Recent split + "+ Add folder"); a "Recently visited" card strip on the home | Notion workspace-switcher popover; Jira Starred+Recent; monday.com switcher |
| **Session pane** | Raw xterm terminal as the whole experience | **Conversation-rail + work-pane split**: prose transcript of one-line tool *receipts* and bordered cards for substantial events; terminal demoted to one tab; green-check/spinner step lists; paused-for-input banner | **Replit agent session** (receipts + checkpoint + Rollback + paused banner); Lindy green-check step checklist; v0 paired panes |
| **Composer** | Plain prompt, no host context | Quiet host pill summarizing the choice (Claude Code / Codex / …), checkbox dropdown with brand glyphs + one-line descriptions, mode chips beneath the input, send→stop morph while running, warm empty state (greeting + faculty-seeded suggestion chips) | **Cursor composer** (selected-state summary); Fabric provider-grouped picker; Gemini/Grok greeting + chips |
| **Module grid + pulse** | N/A (terminal panel) | **Copy.ai card model** (5 large icon-led cards, count embedded in the verb, name primary / count secondary) + a Plane-style **pulse strip** above (compact stat tiles: sessions, proposals pending, active generation, guardrail activity); a 6th ghost/affordance card; per-card "Gen N" chip for progression | **Copy.ai Configuration**; **Plane "Your work"**; Duolingo profile-statistics (dialed down) |
| **Module / knowledge detail** | JSON-ish dump | **Linear/Reflect hybrid**: centered body (large title + fact text, generous line-height) + right **properties rail** (type/source/generation/confidence as label+value rows, colored pills only for enums) + **quoted-context backlinks** at the bottom ("Related (3)" showing the *sentence* that connects them) | **Reflect quoted-context backlinks**; **Linear sub-issues (0/4) + properties rail**; Fibery type-icon rows |
| **Generations / versioning** | (would be a git log) | **Right-rail history per faculty**, date-grouped two-tier rows with provenance ("minted from proposal #12 · you · 2h ago"), explicit "Active generation" badge, generations numbered as **levels**, diff behind a "Highlight changes" toggle; checkpoints as **Gamma snapshots** with a Pitch-style scrubber; rollback as append ("make Gen 4 active") | **Gamma "7 snapshots"**; **Linear milestones "70% of 5" + highlight toggle**; **Notion append-safe restore modal**; Pitch snapshot scrubber |
| **Review / NEEDS-YOU** | N/A | **One-at-a-time card** ("3 of 7" counter) structured WHAT / WHY (collapsible evidence + "seen in N sessions" chip) / WHAT-HAPPENS (consequence micro-copy); three actions (Approve / Not yet / Reject, reject de-emphasized); quiet toast + auto-advance; warm zero-state. NEEDS-YOU = counted entry point grouped by faculty | **Hex review panel** (self-describing actions); **Workable inline-expanding card**; **Cleo one-at-a-time ceremony**; Airwallex "Pending your approval (1)" |
| **Sessions / trace** | Raw log firehose | **Sessions:** airy 4–5-col table, recency section headers, status as the only color, **faint-red tint on failed rows**, slim header sparkline, counts strip. **Trace:** narrative timeline of typed-icon cards → span tree on demand → per-span inspector rail; summary-first KPI header; waterfall as secondary toggle | **Braintrust span-detail panel**; **incident.io narrative timeline**; **Cursor agent run history** |
| **Guardrails / settings** | JSON config feel | **Vanta three-state palette** (green=allow / amber=ask / red=deny as one token per row); bold-label / muted-description / segmented-control-right rows grouped in cards; **plain-English summary sentence** with chips; literal pattern as a small mono chip; "enforced by guardrails gate" locked note. Schema viewer = Fibery type-icon rows; Instructions = calm document, not code editor | **Vanta permission matrix**; **ClickUp plain-English rule summary**; **Fibery typed-record viewer** |
| **Command palette** | (would be terminal commands) | One blended command-first overlay, grouped by kind, never-blank, two-line rows, kind-icons, footer legend, one-time coach-mark, optional knowledge preview pane | **Linear palette**; **Superhuman command** (progression coach-marks); **Replit palette** |
| **Onboarding** | CLI scaffold + CLAUDE.md block | **Graphite auto-advancing accordion checklist** (active step only, copyable mono CLI inline, grey+strike completed), progress in words + slim bar + time estimate, genuine completion moment (digest preview), one optional dev-flavored personalization question; cloud = Replit segmented stage bar + opt-in log | **Graphite "Get started"**; **Replit Provision/Build/Promote**; **Vercel collapsible stages** (error handling) |
| **Cloud / billing** | (would be an ops console) | Instance = **Neon dashboard** model (headline metric strip + status dot + region, one collapsible trend chart). Wallet = one hero balance + one "Top up" button; usage as a thin `used / total (%)` bar, neutral/green until near-limit; plain-language billing line; **plan tiers as Duolingo progression** (credits/month headline, "Most Popular", monthly/yearly toggle) | **OpenAI usage** (budget ring + spend chart); **Neon project dashboard**; **ElevenLabs plans** |
| **Empty / educative** | Bare terminal, no scaffolding | Centered single-column with **product preview** (not just a mascot), warm second-person future-tense copy, icon-row-triplet faculty explainers, anchored coach-marks with "N of M" counters (finite + relaunchable), a **persistent collapsed progression pill** ("Your agent: Gen 2 · 4 facts · 1 pending") | **ClickUp empty-Goals preview**; **Sentry annotated empty + relaunchable tour**; **Pipedrive two-tiered checklist** |

---

## The biggest moves

The highest-leverage changes, ranked. Each is the difference between "VS Code terminal" and "consumer-SaaS-grade."

1. **Demote the terminal; render the session as a conversation of receipts.** The terminal becomes one tab in a work pane; the default surface is a prose transcript where every tool call is a one-line receipt (Principle 2) and substantial events (plans, diffs, checkpoints) are bordered cards. *Why:* this is the literal fix for the core complaint — it turns the wall of monospace into a legible, welcoming timeline, and every receipt can speak zuzuu's faculty vocabulary. *(Lanes 02, 09.)*

2. **Enforce the mono boundary and the warm-neutral ramp across all tokens.** Mono = machine data only (Principle 5); the structural work is done by a 5-step warm-charcoal dark ramp (elevation-by-lightness, no drop-shadows) mirrored by a warm off-white light ramp; never pure black/white or cool Tailwind grays. *Why:* this single token discipline is what separates "premium tool" from "terminal" and "unfinished" — it touches every pixel. *(Lane 13.)*

3. **Make the five faculties a calm card grid with a progression pulse.** Copy.ai-style large icon-led cards (name primary, count in the verb) over a Plane-style pulse strip, with per-card generation chips and color *only* on action. *Why:* this is the new home of the workbench — it must read as *living capabilities that grow*, not folders or settings, and it's where the "agent is learning" story first lands. *(Lanes 03, 06, 14.)*

4. **Reframe versioning as levels + safe save-states.** Generations as an ordinal ladder, checkpoints as plentiful snapshots, rollback as append ("make Gen 4 active again — this won't delete Gen 5"). *Why:* versioning is the scariest, most git-like part of zuzuu's model; this reframe converts fear into progression and is exactly zuzuu's real pointer-flip mechanic. *(Lanes 05, 06.)*

5. **Build the review ceremony as a finishable one-at-a-time flow.** WHAT / WHY / WHAT-HAPPENS card, three softened actions, consequence micro-copy, quiet toast + auto-advance, warm zero-state — entered from a counted NEEDS-YOU surface. *Why:* the human gate is zuzuu's defining interaction; making it feel like a satisfying, bounded ceremony (not a chore queue) is what makes the whole evolve-loop inviting. *(Lane 07.)*

6. **Cmd-K as the spine, teaching progression as it goes.** One blended palette that folds navigate/search/run/switch-session into a calm overlay, with Superhuman-style coach-marks that graduate the user from clicking to chords. *Why:* the palette is the highest-leverage *single element* for the premium feel and the cheapest way to make keyboard mastery feel like leveling up. *(Lane 11.)*

7. **Narrate every empty surface and keep an ambient progression signal.** Preview the filled state (Principle 4), teach the new nouns with icon-row-triplets, and float a persistent collapsed "Your agent: Gen 2 · 4 facts · 1 pending" pill. *Why:* zuzuu is conceptually new and empty-by-definition on day one; this is how a newcomer learns "my agent is getting smarter" without docs — the throughline of the whole vision. *(Lane 14.)*
