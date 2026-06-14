# Entity Cards & Overview Dashboard — Mobbin Design Research

Lane: entity cards & overview dashboard. Platform: web. Researched 2026-06-13 via Mobbin MCP (deep mode). All observations below are from examining the actual screenshots, not app reputation.

## Brief

This research informs two zuzuu workbench surfaces:

1. **The module tile grid** — the 5 us-owned faculties (knowledge / memory / actions / instructions / guardrails) rendered as a grid of cards. Each card carries an **icon + name + a count** (e.g. "47 facts", "12 actions") and a **status** (healthy / pending proposals / has guardrail denials). This is the home of the workbench.
2. **The dashboard "pulse" header** — a stats strip above the grid summarizing the agent's state at a glance (sessions captured, proposals pending review, last generation, guardrail activity).

The zuzuu workbench today reads like a VS Code panel. We want it to feel **Notion-calm** (generous whitespace, soft hierarchy), **Duolingo-progressive** (status feels like progress, not config), **game-like and welcoming**, and **uncomplicated**. The faculties should read as *living capabilities that grow*, not as folders or settings.

Design questions this research answers:
- How do best-in-class web products lay out a small fixed set of "entity" cards (3–6 of them) so the grid feels intentional, not sparse or templated?
- How is a **count** rendered on a card so it reads as meaningful, not like a debug number?
- How is **status** shown calmly (color, pill, dot) without alarming the user?
- How does a **pulse/stats header** sit above a grid — what's the size relationship, and how is the big-number-vs-trend tension handled?
- What makes the gamified (Duolingo/Brilliant) treatments feel rewarding, and which of those moves are safe to borrow for a developer tool without feeling juvenile?

## Studied

### Settings / category-card grids (closest structural match to the 5-module grid)
- [incident.io — Settings overview, 3-col feature cards](https://mobbin.com/screens/bf51b05f-5c86-4d6c-b914-8d932494f05d)
- [Deel — "Quick access to main settings" curated card grid](https://mobbin.com/screens/8afcb598-b612-4112-a1e8-3af0f0c9bce1)
- [Deel — Organization Settings, cards with icon + description + "View" button](https://mobbin.com/screens/1576ba25-893a-42ca-8c2e-9ef7af75d55f)
- [Remote — Company settings, sectioned cards with sub-links](https://mobbin.com/screens/5c68d413-927d-4902-88d6-ea17f154fee1)
- [Fresha — Workspace settings card grid with tabs](https://mobbin.com/screens/8b220dad-1ee6-43e8-aae3-a0e90fe57be2)
- [Copy.ai — Configuration, 3 large cards each with a "View X (count)" button](https://mobbin.com/screens/37030eec-399c-477f-a82f-87b6d1b86b33)
- [Posh — Settings, dark-mode 2-col cards with icon + description](https://mobbin.com/screens/c1ff4dca-1999-49aa-8fed-b07ccb7bc35d)
- [Chatbase — Integrations grid, icon + status ("Connected") + action button](https://mobbin.com/screens/9d24c903-7050-4e16-b34e-71da42107d2c)
- [Todoist — Theme picker, dense card swatch grid with star/check states](https://mobbin.com/screens/8914e24c-4432-4514-99ff-65e72c46f0e1)

### SaaS metric / stat cards (for the pulse header + count treatment)
- [Stripe — "Your overview" customizable metric cards with sparklines](https://mobbin.com/screens/06cb64e5-fd69-4211-b37a-8c5095b4e85e)
- [Stripe — overview, big-number cards + compare-to-previous-period](https://mobbin.com/screens/2d11d64a-3af5-4815-9be2-64d8c1dc618b)
- [Stripe — overview with breakdown bar + per-card sparkline](https://mobbin.com/screens/673e89af-fe9e-4ab9-ac27-435dedf21888)
- [Cloudflare — Account analytics, sectioned stat blocks with mini area charts](https://mobbin.com/screens/5cfd2aab-b900-484e-bca8-7bec7cbdcc27)
- [Cloudflare — Workers Metrics, 4 stat cards + delta % + tiny sparkline](https://mobbin.com/screens/4806b442-2102-4174-9cbd-44939fb9434c)
- [Whop — Analytics Stats, metric cards each with value + delta pill + line chart](https://mobbin.com/screens/0b39694c-dee7-4300-9f2e-ebe25b14c75e)
- [StackAI — Project Analytics, large number cards with faint area charts](https://mobbin.com/screens/03fb91f0-89d0-45e6-ada1-34d533a3febf)
- [Vercel — Speed Insights, score ring + RES sparkline card](https://mobbin.com/screens/5d7fa34b-46f5-4e4c-acc0-6a3719eb98c5)
- [Adaline — workspace dashboard, header stat row + sparkline cards](https://mobbin.com/screens/7483692e-1571-40a7-829d-468a0686e2d9)
- [Fey — dark stat/news cards with full-bleed chart](https://mobbin.com/screens/93aecbb0-1123-42c3-a7d2-0997e1ab5509)

### Overview / status hybrids (count + status together)
- [Vanta — Tests overview, "OK" vs "Needs attention" summary cards + progress bar](https://mobbin.com/screens/eb1d71b4-2b3c-4a83-8435-bdc0e7cbb9e2)
- [Okta — Dashboard, Overview + Status cards with operational pill + donut](https://mobbin.com/screens/72c7a956-c9ec-45ef-872e-c3ec74d672df)
- [incident.io — Home, status-grouped cards (Investigating / Monitoring)](https://mobbin.com/screens/beb49f89-6e5a-47e0-a02b-70665a3fe7bf)
- [Plane — "Your work", header count tiles + colored status tiles](https://mobbin.com/screens/0dd9ff7e-b7b6-4ec1-9bd2-9e403fc687ec)
- [Asana — Dashboard, 4 big-number summary cards over charts](https://mobbin.com/screens/3696afeb-c25f-4883-8666-06e5ae7d2d6f)
- [Zendesk — "Feature usages" cards with number + used/updated sub-stats](https://mobbin.com/screens/91b1db5b-e4e3-494c-8641-ec77b364896d)

### Gamified progression (the Duolingo/welcoming register)
- [Duolingo — profile Statistics, 2x2 icon stat cards + XP line chart + achievements](https://mobbin.com/screens/6ff49359-fff4-4ea2-97f2-50097b0873ac)
- [Uxcel — Learning Stats, two rows of icon-topped stat cards](https://mobbin.com/screens/39bfe0f2-8662-4f70-8083-de6b89bd4408)
- [Brilliant — Home, streak card + league card + recommended path cards](https://mobbin.com/screens/4fe5b91e-5235-46ff-ab56-f0758c14b198)
- [Unity Learn — Welcome header with inline Completed/XP/Badges + hex-icon path cards](https://mobbin.com/screens/dcb63917-8d63-4df1-928d-164df173488a)
- [Codecademy — Skills tracking, streak cards + level card with segmented progress](https://mobbin.com/screens/41d3d178-1703-47b1-820d-b5c5348118a6)
- [Skillshare — Badges, count-badged cards + locked/earned milestone grid](https://mobbin.com/screens/80cf2632-f279-4296-b7c2-252b18344677)
- [Tripadvisor — TripCollective dashboard, points header + level bar + badge grid](https://mobbin.com/screens/ced65f69-f099-434e-8b14-784c41b2d2b7)

## Patterns

**Grid & layout.**
- The settings-card grids converge hard on a **3-column grid** (incident.io, Deel, Fresha, Remote) with one card per capability. Cards are wide rectangles, roughly 1.6:1, never square. With only a handful of items the grid still reads intentional because each card carries enough content (icon + title + 1-line description + sometimes sub-links) to fill its box.
- **Copy.ai is the strongest small-set example**: only **3 cards** across the full width, each very large, generous internal padding, an icon top-left, a big title, a paragraph of description, and a bottom-anchored button reading **"View Brand Voices (0)"** — the count lives *inside the action verb*. This is the cleanest answer to "how do you make 3–5 cards not look sparse": make each card big and self-explaining.
- The pulse-over-grid relationship is consistent: a **horizontal row of compact stat cards on top**, then larger content/charts below (Asana, Okta, Plane, Adaline, Stripe). The top row is shorter (≈110–150px tall), visually lighter, and acts as the "header"; the grid below is the main event.
- Plane's "Your work" is the textbook hybrid: a top row of three minimal **count tiles** (Created 6 / Assigned 3 / Subscribed 10) with tiny icons, then a **Workload** row of *colored* status tiles (Backlog/Not started/Working on/Completed/Cancelled, each tinted) — exactly the count-then-status rhythm zuzuu needs.

**Spacing & density.**
- The calm products (Deel, Remote, Fresha, Copy.ai, Stripe) use **large gutters** (16–24px between cards) and lots of **internal padding**. Cards have soft borders (1px light gray) or no border with a faint shadow, on an off-white/very-light-gray page. This is the Notion-calm register.
- The dense products (Cloudflare account analytics, Todoist themes) pack 4-wide tight rows — useful when you have *many* items, but the wrong feel for 5 hero faculties. zuzuu's 5 cards should breathe like Copy.ai/Deel, not pack like Cloudflare.

**Hierarchy & type.**
- Universal stat-card hierarchy: **tiny uppercase/muted label on top, huge number below.** Stripe, Cloudflare, StackAI, Asana, Okta, Duolingo, Uxcel all do this. The number is the largest type on the card (often 28–48px, semibold); the label is small and gray. Eye lands on the number first, reads the label to interpret it.
- Settings cards invert this: **title is the hero**, number is secondary or embedded in a button. So the *role* of the card decides whether the count or the name dominates. For zuzuu modules (name is the identity, count is a vital sign) the **name should be primary, count secondary** — Deel/incident.io model, not Stripe.
- StackAI shows the danger of pure big-number cards: "19", "1", "0" floating huge with a faint chart reads sterile and a little alarming when values are low. The label and a unit ("runs", "errors") are what rescue it.

**Color usage.**
- Calm baseline is near-monochrome: gray text, white cards, one restrained accent (Deel blue, incident.io/Posh coral, Fresha purple) used only on the icon and the occasional link. Charts are a single muted hue (Whop/Stripe blue line, StackAI/Cloudflare faint gray-blue area). **Color is rationed; it marks the icon and nothing else by default.**
- Status color is deployed *only where there's status to convey*: Vanta uses red "Needs attention" with severity rows (Overdue/Due soon), green "OK"; Okta a green "OPERATIONAL" pill; Chatbase a green "Connected" state vs neutral "Connect" buttons; Plane tints each workflow state. Delta indicators (Whop "+$1.40", Cloudflare "↑ 7600%", Stripe vs previous period) are tiny colored pills/text, green for up. The lesson: **default state = no color (calm); color earns its place by signaling something actionable.**

**Iconography.**
- Settings grids use **simple line icons, one per card**, often in a small tinted rounded square (incident.io coral squares, Deel/Fresha soft-tinted). Consistent stroke weight, sits top-left or top-center. This is the safe, professional register.
- Gamified products go **filled, colorful, characterful**: Duolingo's gold rounded-square achievement icons, Uxcel's lightning/hexagon/pentagon glyphs each in its own color, Unity's neon hex badges, Skillshare's illustrated badges with a **count pill in the corner**. These read as "rewards/levels" not "settings".
- Skillshare's count-pill-on-icon (a little "1" badge top-right of the badge tile) and Tripadvisor's "0/5", "1/5" fraction labels are clean ways to put a count *on* an icon-led card without a separate stat block.

**Motion / interaction cues (from static frames).**
- Cards signal interactivity with hover affordance implied by **shadow + a clear action target** (button "View", "Connect", or whole-card click). Stripe/Asana cards carry an **× to dismiss** and a **+ Add** ghost card — the grid is editable. Whop/Stripe show "Done"/"Edit" mode toggles, implying drag-to-rearrange.
- Brilliant/Duolingo use **segmented day-dots** (filled = done, hollow = pending) and progress bars to animate streaks — progress is shown as a row of states, inherently motion-ready.
- Codecademy's level card has a **segmented horizontal progress bar** (Beginner → Intermediate → Advanced) with the current marker — "you are here, next milestone is X."

**State handling.**
- **Empty/zero states are designed, not blank.** Whop shows a friendly cloud illustration + "No data available" inside an otherwise-formed card. Stripe shows "This content is only available for live data" with an inline illustration. incident.io shows "No active escalations — Rest easy… when there are, they'll appear here." Copy.ai shows "(0)" honestly in the button. **Nobody leaves a hollow card; zero is given a sentence and often a gentle illustration.**
- **Locked/future states**: Skillshare and Tripadvisor render not-yet-earned badges as **grayed, lock-icon** tiles in the same grid — progression is visible as "what's next." 
- **Status grouping**: Vanta and incident.io group cards by state (OK vs Needs attention; Investigating vs Monitoring) so the user triages by scanning, not reading every card.

## For zuzuu

**The module tile grid (5 faculties).**
- **Adopt the Deel/incident.io/Copy.ai card model, not the Stripe stat-card model.** Each faculty is an *identity* first; render: tinted rounded-square line **icon** top-left, **faculty name** as the hero title, a **one-line "what it is"** description (e.g. Knowledge → "Facts your agent remembers"), and the **count + status as the secondary line**. This keeps it calm and self-explaining — exactly Copy.ai's "View Brand Voices (0)" pattern, where the count rides inside the action.
- **Use a 3-column grid but lean toward Copy.ai's generosity.** 5 cards in a 3-col grid leaves an empty slot on row 2 — fill it with a **6th "ghost/affordance" card** (e.g. "See proposals" or "Session history" or an add-faculty-soon placeholder) rather than letting the grid look broken, mirroring Stripe/Asana's "+ Add" ghost card. Big cards with breathing room (Deel gutters, Copy.ai padding) over a tight 4-wide pack.
- **Count treatment:** put the number as a secondary stat with a **unit word** ("47 facts", "12 actions", "3 rules") — never a bare "47" (StackAI's sterile-number trap). Optionally a Skillshare-style **corner count pill** on the icon for the headline number.
- **Status treatment (calm-first):** default state shows **no color** — just the card. Apply color *only* when there's something to act on: a small amber dot/pill "3 pending" when proposals await review (links to `zz review`), a coral marker when guardrails logged denials. Model on Chatbase's "Connected" vs neutral and Vanta's "Needs attention" — status is a quiet signal, not a paint job. This satisfies "welcoming, uncomplicated" while still surfacing the human-gate moments.
- **Make growth visible (the Duolingo move, dialed down).** Borrow Codecademy's **segmented generation/level bar** or a subtle "Gen 3" chip per card so a faculty reads as *something that graduates*, not a static folder — this is the cheapest way to make the grid feel progressive without going juvenile. Borrow Skillshare's locked-tile idea only lightly: if a faculty is empty, show it in the grid with an inviting "Start capturing — facts will appear here" line (incident.io's reassuring empty-state voice), never a hollow box.
- **Avoid:** Cloudflare/Todoist density (too many tiles, cramped — wrong for 5 heroes); pure big-number cards (Stripe/StackAI) for the modules (makes faculties read as metrics, not capabilities); rainbow color on every icon by default (reserve characterful color for an optional gamified accent, keep the resting state monochrome-calm).

**The dashboard "pulse" header.**
- **Adopt the top-row-then-grid rhythm** (Plane / Asana / Adaline / Okta): a short horizontal strip of **compact stat tiles** above the module grid — Sessions captured, Proposals pending, Active generation, Guardrail activity (last 7d). Keep these tiles lighter and shorter than the module cards so the hierarchy reads "summary on top, capabilities below."
- **Use the universal stat-card type scale** here (and *only* here): tiny muted label, big number. This is where Stripe/Cloudflare's number-first hierarchy is correct, because these are genuinely metrics.
- **Sparklines, used sparingly.** Whop/Cloudflare/Adaline put a tiny trend line under the number. zuzuu could put a **7-day sessions sparkline** under "Sessions captured" to make the header feel alive — but keep it single-hue and faint (Cloudflare/StackAI restraint), and skip charts on metrics that don't trend (a sparkline on "0 guardrail denials" is noise — render a calm "All clear" instead, per incident.io's empty-state voice).
- **Delta pills** (Whop "+2", Stripe vs previous period) are a nice touch for "Sessions this week vs last" — green, tiny, optional.
- **A "you are here" progression element** (Tripadvisor's points→level bar, Unity's inline Completed/XP/Badges header) maps well to "Generation 3 · 47 learnings graduated" — a single welcoming line that frames the whole agent as *progressing*, which is the Duolingo register applied honestly to zuzuu's evolve loop.
- **Avoid:** turning the header into a chart wall (Cloudflare account-analytics / StackAI full-page of charts feels like an ops console, the opposite of Notion-calm); huge alarming zeros without a unit or a reassuring empty-state sentence.

## Standouts

1. **[Copy.ai — Configuration](https://mobbin.com/screens/37030eec-399c-477f-a82f-87b6d1b86b33)** — the single best template for the 5-module grid. Three large, calm, icon-led cards each with a title, an explanatory paragraph, and a bottom button that *embeds the count in the verb* ("View Brand Voices (0)"). Solves the small-set-doesn't-look-sparse problem and the honest-zero problem at once.
2. **[Plane — Your work](https://mobbin.com/screens/0dd9ff7e-b7b6-4ec1-9bd2-9e403fc687ec)** — the cleanest count-then-status rhythm: minimal header count tiles up top, then a row of *tinted* status tiles below. Direct blueprint for "pulse header over module grid" with calm color discipline.
3. **[Duolingo — profile Statistics](https://mobbin.com/screens/6ff49359-fff4-4ea2-97f2-50097b0873ac)** — the welcoming/progressive register to borrow *carefully*: icon-topped stat cards (streak, total XP, league, finishes) + a trend chart + an achievements row. Shows how to make stats feel like rewards; zuzuu should dial the saturation down but keep the "stats = progress, not config" framing.
