# Cloud, Billing, Credits & Usage — Mobbin Design Research

> Lane: monetization surfaces for zuzuu's hosted offering. Platform: web. Source: Mobbin (deep search). Studied 60 screens across 6 queries; the strongest ~30 are linked below.

## Brief

zuzuu's web workbench today reads like a VS Code terminal. The hosted offering will add two monetization surfaces that must instead feel consumer-SaaS calm — Notion-quiet, Duolingo-progressive, never anxiety-inducing:

1. **Cloud instance status** — a hosted VM/instance where the agent lives. Needs to show: running/idle status, region, resource use (CPU/RAM/storage), and recent activity, without turning into an ops console the user has to babysit.
2. **Credit wallet + usage metering** — a wallet for agent/inference consumption: current balance, top-up, usage-against-limit bars, plan selection, next-billing context.

Design questions this research answers:
- How do the best products visualize "how much have I used / how much is left" so it reads as **reassurance, not a warning**?
- How is a credit balance + top-up framed so adding money feels like topping a coffee card, not a panicked upsell?
- How do infra products (Neon, PlanetScale, Cloudflare) show a live instance **calmly** — status dot + a few headline numbers vs. a wall of graphs?
- What plan-selection layout makes choosing a tier feel like progression (Duolingo) rather than a paywall?

---

## Studied

### Usage metering & limits (the core "how much have I used" pattern)
- [StackAI — Usage page with per-resource bar meters](https://mobbin.com/screens/a2976bbf-d4f1-407f-8c56-88779215f037)
- [Vercel — Usage / Limits grid (all resources as cards)](https://mobbin.com/screens/a020c36e-31be-48e8-979b-97d19373a5f5)
- [Vercel — Usage networking detail with bar chart](https://mobbin.com/screens/02e1064f-6791-4e0b-b536-d947a48358e0)
- [Vercel — Usage bandwidth ratio chart](https://mobbin.com/screens/7ad577a5-36a3-4963-90f9-72248d2ba5b4)
- [Snowflake — Cost Management: credits used + spending-limit progress + spend bars](https://mobbin.com/screens/14dc8d20-6643-472e-b933-34b0678b83cc)
- [Rox — Billing & Usage: plan + cost + renewal + "actions used" meter](https://mobbin.com/screens/e5e92b3f-be93-4e3d-a6db-5ccfd2181b83)
- [Glide — Usage: updates meter + per-feature limit bars (right rail)](https://mobbin.com/screens/ce19934a-3ebb-4376-8eb5-3ecb62da0aac)
- [Felt — Usage: data processing/hosting against monthly quota](https://mobbin.com/screens/f9f64d42-27ac-46fb-81f4-ab70c95694b1)

### API usage / token spend dashboards
- [OpenAI Platform — Usage: monthly spend + budget ring + tokens/requests sparklines](https://mobbin.com/screens/308f3c45-2b9f-4af9-9e24-638a6151823b)
- [OpenAI Platform — Usage: total spend bar chart + budget progress + side stats](https://mobbin.com/screens/2bf4f941-a9a7-4308-aa0c-864135823830)
- [OpenAI Platform — Usage activity: per-model request/token charts + top users](https://mobbin.com/screens/829438e9-491b-4a61-b583-e0b08b878f10)
- [OpenAI Platform — Usage with date-range picker overlay](https://mobbin.com/screens/32d80696-c660-4446-b56a-d58f8613ee0a)
- [OpenAI Platform — Older usage: daily $ bars + "Credit used" progress bar](https://mobbin.com/screens/3a88c3fb-8577-4e18-8d9a-876cd59f37e5)
- [Firecrawl — Usage: Credit Usage % + Extract Tokens % with reset note](https://mobbin.com/screens/4aa89c74-3071-4189-ae9a-1b1bef2007cb)
- [Firecrawl — Usage: API credits + tokens line charts](https://mobbin.com/screens/49179d37-d3ae-4bc2-91f5-d4667421567b)
- [Mistral AI — API usage: total cost + cost-per-day chart](https://mobbin.com/screens/0421783c-e4ac-4bf0-8867-faa209ce10d6)

### Cloud / instance status & resources
- [Neon — Project dashboard: headline metric strip + branch status list + region](https://mobbin.com/screens/57e883a3-2c9f-42aa-b776-c873201a6cdc)
- [Neon — Monitoring: RAM/CPU compute charts with allocated vs used](https://mobbin.com/screens/c5ee5c89-e7ad-43fc-828a-46315320e455)
- [PlanetScale — Cluster topology with live latency/CPU/memory side panel + estimated costs](https://mobbin.com/screens/d8d653d4-af5d-4e41-ac4d-62b442ca3093)
- [Cloudflare — Workers overview: metric strip + request map + next-steps rail](https://mobbin.com/screens/f036f9a0-8261-46e4-9ad0-b00f419aeb6e)
- [Cloudflare — Workers metrics with sparkline metric cards](https://mobbin.com/screens/c7df115b-d9fc-4882-90a1-6399623e1fe8)
- [Cloudflare — Bindings/topology node-graph view](https://mobbin.com/screens/c2a81c26-677d-43c2-8f93-3fad6513e3bd)
- [Better Stack — Monitor: "Currently up for" + "Last checked" + response-time graph](https://mobbin.com/screens/b677964b-252f-47a8-8495-40501138635c)

### Credit wallet / balance / top-up
- [Open — Credits balance ("0 CREDITS") + Buy Credits + history](https://mobbin.com/screens/80031354-74d0-4fba-ba76-ef32a67fde1f)
- [Klarna — Wallet: big balance + Add money + card visuals](https://mobbin.com/screens/a44f5d5f-4e8a-4cba-b80b-78d2beb9d1f4)
- [Instacart — Credits: big $ balance + View balances / Add + promo cards](https://mobbin.com/screens/25f31891-590e-4639-9914-1404758deb5f)
- [Kiwi.com — Wallet: credit + promo balance split cards](https://mobbin.com/screens/7e7b7513-6310-4977-afbe-4348022edeb2)
- [Uber — Wallet: gradient balance card + payment methods](https://mobbin.com/screens/d382c996-4b76-485a-9b65-93097246c07a)

### Plan selection / pricing tiers
- [Arcade — Plans with per-tier AI-credit allotments + recommended highlight](https://mobbin.com/screens/db2eec9e-5b2e-47fc-b9af-8d4bfa9ffd55)
- [Manus — "Upgrade for more usage": credits/month dropdown inside the chosen tier](https://mobbin.com/screens/590d083d-9602-491a-8ce7-eea83f5ece27)
- [ElevenLabs — Plans with credits/month + "Most Popular" + PAYG note](https://mobbin.com/screens/dfa4b923-2413-4e3a-816c-0d475780d486)
- [Lovable — Select a Plan: credits/month dropdown per tier](https://mobbin.com/screens/36300829-87ab-4506-ac59-d094e05e89a3)
- [Asana — Select your plan: recommended ribbon + downgrade note](https://mobbin.com/screens/bfbd3942-33a8-4924-a22d-bd44a71a8a6f)

### Subscription management
- [Superhuman — Billing: Total Seats / Current Price / Next Invoice strip + plans](https://mobbin.com/screens/a653ca6c-4e7a-4a21-821d-aaab67342811)
- [Jasper — Plans: current plan + "plan limits usage" stat cards](https://mobbin.com/screens/bfd8e944-973b-4452-8552-7ffe9dfffc82)
- [Kajabi — Subscription: plan + plan-usage bars with "limit reached" red states](https://mobbin.com/screens/6ecf79bb-331f-4ca3-88da-b0d3848e1d89)
- [Bonsai — Current subscription + next-payment plain-language line](https://mobbin.com/screens/516e958e-8d0b-40a2-983a-51350f8dfc33)
- [Linktree — Subscription card: plan + trial-days-remaining + next billing date](https://mobbin.com/screens/7f4a116e-7d92-4e21-be44-01fcd56b313a)

---

## Patterns (what I actually saw)

**Layout & grid.** Two recurring shells. (1) The **headline metric strip**: a single horizontal row of 3–6 equal cards at the very top — Neon shows Branches / Compute / Storage / Network transfer; Cloudflare shows Requests / Errors / CPU Time; Superhuman shows Total Seats / Current Price / Next Invoice. Each card = label + one big number, often a tiny sparkline. This is the calmest pattern in the whole set: it answers "am I OK?" in one glance. (2) The **resource grid of meter cards** (Vercel Limits, StackAI): a 2–4 column grid where every card is one resource with `used / total (percent)` and a thin bar. Vercel's reads "1.72 MB / 500 GB (0%)" — the percent in parentheses is what the eye lands on.

**Spacing & density — the big divide.** The infra tools split sharply. Cloudflare/PlanetScale metrics views are **dense and dark-capable**, many small charts (this is the "VS Code terminal" feeling zuzuu wants to avoid). Neon's *dashboard* (vs its monitoring tab) is the antidote: generous whitespace, one metric strip, one chart, a clean branch list — same data, calm framing. OpenAI's Usage is the consumer-grade reference: lots of air, one dominant spend chart, secondary stats demoted to a right rail. Lesson: **same numbers, but hierarchy + whitespace decide whether it feels like ops or like a product.**

**Hierarchy.** The best monetization screens lead with **one hero number** sized 2–4x everything else: OpenAI "$0.00 Monthly Spend", Klarna "$0.00 Klarna balance", Instacart "$0.00" credits, Snowflake "28.1 Credits Used". Everything else (history, breakdowns, per-model rows) is visually secondary. Wallets in particular are ruthless: one giant balance, one primary action button (Add money / Buy Credits / Top up), then history below the fold.

**Color usage.** Calm products keep usage **monochrome until something matters**: Vercel/StackAI/Felt bars are gray when healthy. Color is reserved as a **signal**: Snowflake's spend bars go light-blue, the spending-limit fill darkens as it climbs; Kajabi turns the bar **red + "limit reached"** only at the cap; OpenAI uses a small green/gray budget bar. The brand accent (purple for OpenAI, green for Instacart) is used for the *one* primary CTA and the active chart, not sprinkled. This is the key to "not anxiety-inducing": **green/neutral by default, warm/red only near the limit.**

**Type treatment.** Tabular-style large numerals for balances and spend (Klarna, Uber, OpenAI). Labels are small, uppercase or muted gray ("CREDITS", "AVAILABLE", "Next Invoice Total"). Plain-language billing sentences instead of tables (Bonsai: "Your next payment will be charged on Mar 8 on the Visa ending 7065"; Linktree: "Next billing date: Feb 20, 2025") — this conversational tone is exactly the Notion-calm register zuzuu wants.

**Iconography.** Restrained. Wallets use a literal card/wallet glyph (Kiwi, Klarna). Status uses a single **colored dot** — Better Stack/Neon green dot + "All OK" / "Up"; Neon branch list shows green "Active" vs gray "Idle" pills. Cloudflare uses a world map of dots for request distribution (delightful but decorative). Info "(i)" tooltips sit next to metrics that need a unit explained.

**How usage/cost is visualized.** Four idioms observed:
1. **Thin horizontal bar with `used / total`** — the dominant, calmest form (Vercel, StackAI, Glide, Kajabi, Firecrawl).
2. **Donut/ring for budget** — OpenAI "0% / $5.00 limit" ring; good for a single budget number.
3. **Bar chart over time** for spend/tokens (OpenAI daily spend, Mistral cost-per-day, Snowflake cumulative spend).
4. **Sparkline inside a metric card** — tiny trend under a big number (Cloudflare, OpenAI side stats). The bar-with-fraction is the one to lead with; charts are for drill-down.

**Motion/interaction cues.** Mostly static stills, but interaction affordances seen: hover tooltips on charts (Neon "Allocated 1.07 GB / Used / Cached"; Better Stack response-time breakdown), date-range pickers as overlays (OpenAI, Vercel "Current Billing Cycle"), toast confirmations ("Your subscription has been updated!" Bonsai), and segmented toggles (Monthly/Annually on every pricing screen, Cost/Activity on OpenAI usage).

**State handling.** Strong empty states are everywhere — Contra "Stay on top of your funds. Once you start earning…", Instacart "No credit history found" with a friendly illustration, Uvodo "Kickstart your earnings". Trial/limit states are explicit but soft: Linktree "Trial applied: 31 days trial (29 days remaining)", Zoom "Pending Cancellation" pill. The only *alarming* state I saw was Rox's full-width yellow banner "You have no Agent Actions remaining" — a warning to study as the *boundary* of calm (it works, but is the loudest thing in the set).

---

## For zuzuu

### (1) Cloud instance status — adopt / avoid

**Adopt:**
- **Lead with Neon's dashboard model, not its monitoring tab.** One **headline metric strip** at top: Status (green dot + "Running" / "Idle"), Region, CPU, Memory — each a card with label + one number. This single row should answer "is my agent up and where" instantly.
- **A single status dot + plain words** (Better Stack "Currently up for…", "Last checked 39 seconds ago"). Pair an `Idle`/`Active` pill like Neon's branch list so a sleeping instance reads as *fine*, not *broken*.
- **One trend chart, collapsible.** Offer the CPU/RAM-over-time chart (Neon's allocated-vs-used overlay is excellent) but below the fold / behind a "View metrics" disclosure — not on the landing view.
- **Cloudflare's "Next steps" rail** as the welcoming touch: a small right-column of friendly suggestions instead of empty graphs for a new instance.

**Avoid:**
- PlanetScale/Cloudflare **dense multi-chart metrics walls** — that *is* the VS Code-terminal feeling to escape. Keep them as an opt-in "advanced" tab.
- Raw ops jargon front-and-center (p50/p95 latency, GB-Hrs). Translate to human units or hide behind tooltips.
- More than ~4 top-level numbers. If it needs a scrollbar of charts to understand, it's an ops console, not a calm status.

### (2) Credit wallet & usage — adopt / avoid

**Adopt:**
- **Wallet = one hero balance + one primary button.** Copy Klarna/Open/Instacart: a giant credit number, a clear "Top up" / "Buy Credits" button top-right, history demoted below. Frame top-up like a coffee card.
- **Usage as a thin bar with `used / total` and the percent in parentheses** (Vercel/Firecrawl). Default the bar **neutral/green**; only warm it (amber→red + "running low") as the limit nears, the way Kajabi flips to red "limit reached." This is the single most important "calm, not anxious" decision.
- **A monthly budget ring or bar with an editable cap** (OpenAI "$0.13 / $10, Edit budget"). Letting users *set their own ceiling* converts billing anxiety into a feeling of control — strong fit for zuzuu's human-gated ethos.
- **Plain-language billing line** (Bonsai/Linktree style) instead of an invoice table: "You have 8,200 credits. They reset on Jul 1." Add reset/rollover notes (Firecrawl "Credits reset on…", Lovable "Credit rollovers").
- **Credits expressed in the unit users care about**, plus a quiet "≈ N agent runs" translation, so the wallet maps to real work (like Snowflake credits → spend, Rox "actions used").
- **Duolingo-style plan progression:** ElevenLabs/Arcade/Manus put **credits/month inside each tier card** with a "Most Popular" highlight and a per-tier credits dropdown (Manus/Lovable) — upgrading feels like leveling up the allowance, not hitting a paywall. Use a Monthly/Annually segmented toggle with the savings badge.

**Avoid:**
- **Rox's full-width yellow "0 actions remaining" banner** as a default pattern — it's the most anxiety-inducing screen in the set. Reserve red/banners strictly for the true zero state; everywhere else, soft inline nudges.
- Dumping a **multi-model token table** (OpenAI activity view) on the primary wallet screen — keep that as a drill-down for power users.
- Empty/zeroed money with no encouragement. Always pair an empty wallet with a warm empty state (Contra/Uvodo) and an obvious first action.
- Mixing "earnings/payouts" framing (Contra, beehiiv, Uvodo) — those are creator-payout wallets, the wrong mental model for a *spend* wallet. zuzuu's wallet is consumption, so lead with balance + top-up + usage, not withdraw.

---

## Standouts (revisit these)

1. **[OpenAI Platform — Usage with budget ring + spend chart + side stats](https://mobbin.com/screens/308f3c45-2b9f-4af9-9e24-638a6151823b)** — the cleanest "spend + budget + tokens" layout: one dominant chart, an editable budget with a calm green progress bar, secondary stats in a right rail. The template for zuzuu's usage view.

2. **[Neon — Project dashboard](https://mobbin.com/screens/57e883a3-2c9f-42aa-b776-c873201a6cdc)** — proof that infra status can be calm: a headline metric strip + status pills + region, with the dense monitoring kept on a separate tab. The blueprint for zuzuu's cloud-instance landing.

3. **[ElevenLabs — Plans with per-tier credits + "Most Popular" + PAYG](https://mobbin.com/screens/dfa4b923-2413-4e3a-816c-0d475780d486)** — the Duolingo-progression feel for plan selection: credits/month framed as the headline benefit, gentle highlight on the recommended tier, monthly/yearly toggle with a savings badge. (Pair with Manus's per-tier credits dropdown for top-up-within-plan.)
