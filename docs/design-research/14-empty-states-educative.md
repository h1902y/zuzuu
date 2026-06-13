# 14 — Empty States & Educative Micro-UX

Design research for the zuzuu workbench. Lane: empty states, inline coaching, feature discovery, progress nudges, progressive disclosure of new concepts. Studied on Mobbin (web primary, plus iOS), examining the actual screenshots — notes below are from what was visible, not app reputation.

## Brief

zuzuu is conceptually new. A newcomer opening the workbench has never met **faculties** (Knowledge / Memory / Actions / Instructions / Guardrails), **generations** (pinned, rollback-able lockfiles), or **proposals** (the human-gated bridge from trace to a new generation). Worse, the most important surfaces are *empty by definition on day one*: no sessions captured yet, no knowledge remembered yet, no proposals to review yet. The product has to **teach as you use it** — a newcomer must come away understanding "my agent is learning" without opening docs.

Surfaces this research informs:
- **Empty sessions** — the workbench before any host session has been captured.
- **Empty knowledge** — the Knowledge faculty before any fact is remembered.
- **Empty proposals / review inbox** — before `distill` has mined anything to approve.
- **Empty actions / instructions / guardrails** — the other three faculty homes pre-content.
- **Inline coaching tips** — in-context explanations of faculty/generation/proposal vocabulary.
- **Feature-discovery hints** — surfacing the gate, rollback, digest, the embedded terminal.
- **Progress nudges** — the "agent is learning" mental model rendered as visible progression.

Design questions:
1. How do you teach a genuinely new mental model (agent-that-learns) without a wall of text?
2. How do you make an *unavoidably empty* first screen feel like a confident invitation rather than a void?
3. How do you frame the human gate (review/approve) as empowering ceremony, not chore/friction?
4. How do you show progression (Duolingo-calm) so emptiness reads as "the start of something" not "nothing here"?

## Studied

### Empty states — web (workspace / list / dashboard)
- [Tally — "No forms yet" empty state](https://mobbin.com/screens/0f2523c5-d61e-4384-a934-c169dbb1eaeb)
- [Miro — "Make this Space yours" empty space](https://mobbin.com/screens/6d68f5aa-f33f-42b9-8334-7b4901d9dc3a)
- [Typeform — "Come on in, jane" personalized empty workspace](https://mobbin.com/screens/2eb190e9-8525-4224-b70f-a97184d1f591)
- [Typeform — empty workspace with response-limit banner](https://mobbin.com/screens/7b0f418e-2266-4b82-aa85-c78bf4d86c1d)
- [HoneyBook — "Enjoy your day!" zero-tasks empty state](https://mobbin.com/screens/47f71d9f-0d87-4e19-a8b6-3669095e0cbe)
- [Kajabi — "Create your first coupon" hero empty state](https://mobbin.com/screens/8f86651a-5eef-4721-a8bc-59b601b6a49b)
- [ClickUp — "Make your goals a reality" empty Goals with preview](https://mobbin.com/screens/3f3c2432-3db0-4cfc-b469-2a088d38dde5)
- [Quicken — "Spending Watchlist" empty with sparkle illustration](https://mobbin.com/screens/90f9d8d4-3298-44b0-9e7a-1f7e47d253b0)
- [Evernote — "You're all set!" completion empty state](https://mobbin.com/screens/7de7b224-cd9e-4a81-a07e-6123f3f9dfaf)
- [Copy.ai — "You haven't started a project!" empty projects](https://mobbin.com/screens/c6eb9104-a68a-4938-a309-dfe77fe9aef2)

### Empty lists — iOS (friendly first-run)
- [MasterClass — "You can now add lessons" My List empty](https://mobbin.com/screens/ad85381e-2068-4847-8c6e-40d848d81030)
- [The Infatuation — "My Hit List · 0 posts" empty](https://mobbin.com/screens/0087601c-6e9b-4f7a-8656-3eae56d7751f)
- [Lifesum — "Your list is empty" shopping list](https://mobbin.com/screens/243651f1-4ca2-426f-90dd-efa1aa62f42d)
- [Instacart — "Use Lists to jot down..." empty lists](https://mobbin.com/screens/9cbc66b4-55ea-4c8e-ae80-9459f610e287)
- [Instacart — "Reordering will be easy" future-value empty](https://mobbin.com/screens/f55602db-c7b5-4cc0-b745-380b68112f79)
- [Cherrypick — "Build your list" empty](https://mobbin.com/screens/10b7f9f2-76a6-4e7e-b48e-fb720c8e6714)
- [Picsart — "Create your first sticker!" empty](https://mobbin.com/screens/54441b5e-947b-4164-a155-f39d87bffb43)
- [Recime — "No ingredients added" grocery empty](https://mobbin.com/screens/95277a31-8be9-4f87-a465-126ed7f56014)
- [Wikipedia — "Organize saved articles with reading lists" empty](https://mobbin.com/screens/b01cde82-be49-4980-bd45-f45b17194b01)
- [Walmart — "This list is lonely" empty](https://mobbin.com/screens/d0a430dc-b9be-4883-b979-3e290bf6e6f5)

### Inline coaching tips & tooltips — web
- [Arcade — hotspot tooltip "This is for search"](https://mobbin.com/screens/a52d2224-1fe6-4064-8616-1144f21fb8e7)
- [Arcade — voiceover-style guided tooltip with audio cue](https://mobbin.com/screens/d3543c93-e29b-4b1a-8669-9db0dce16b2d)
- [Arcade — area-highlight callout](https://mobbin.com/screens/92f5e475-79b4-4ed7-bee2-baffab696088)
- [Gusto — inline info-tooltip on a feature row](https://mobbin.com/screens/126fdbf5-bc1e-4711-816b-bf0a7280d519)
- [Deel — "Step 1 of 4" anchored coach-mark with helpful Y/N](https://mobbin.com/screens/ba792d2d-588e-42d9-bd88-daa7a9abf533)
- [HoneyBook — "Check out what's new" inline spotlight + step counter](https://mobbin.com/screens/6927610a-827a-4e9b-9ab8-a7ffcdf899dc)
- [Google AI Studio — "Use focus mode..." feature explainer card](https://mobbin.com/screens/1bd470e0-29e4-4967-a234-ecaa91cb3af4)
- [Navattic — numbered tooltip tour "1 of 7" with Next](https://mobbin.com/screens/ce908fe9-6fb5-4e16-b73b-362a69c59a02)

### Feature discovery & spotlight — web
- [ClickUp — "Explore Your Workspace" video discovery modal](https://mobbin.com/screens/6b6e90a4-85da-4600-93bb-aecbba67188c)
- [Lovable — "Your dashboard just got more Lovable" what's-new card](https://mobbin.com/screens/9429ba3f-25d0-444d-b04c-5dba81377619)
- [Grammarly — "Apply Premium suggestions · 1/4" coach overlay](https://mobbin.com/screens/270017fe-76e9-4db9-a110-9f7219add590)
- [Suno — "What's New? Introducing Personas" feature note](https://mobbin.com/screens/c624149f-83c2-484b-b079-7ad7593613f9)
- [Pinterest — "Great Pins made easy · 1 of 4" feature tour](https://mobbin.com/screens/26cb8d67-c293-4bca-b8f8-14b3785494a2)
- [Pinterest — "New ways to edit" feature tour with bullets](https://mobbin.com/screens/12da2bf4-66a7-4b9e-b289-f9ae962b1452)
- [Reddit — "Never miss a comment" single-feature explainer](https://mobbin.com/screens/0badb34d-421c-4dba-bc4e-73e0d26ebffb)
- [Airbnb — "Be first to try what's new" feature menu](https://mobbin.com/screens/cb22d7c6-5230-467d-9c1d-350277dcd736)

### Onboarding nudges & progress checklists — web
- [HubSpot — "Do these tasks to get started · 88%" progress checklist](https://mobbin.com/screens/a7f6d0c9-6cd7-454d-bbb0-6d56ac81e090)
- [HubSpot — 63% progress with collapsible step accordions](https://mobbin.com/screens/3cb09c2f-b1de-4ad0-b36b-0ef0859c8522)
- [Pipedrive — "Setup complete!" with checked essentials + deeper tracks](https://mobbin.com/screens/c1795eb0-a714-4c8c-8108-b3f18c8faee1)
- [Pipedrive — "You're on the right track!" encouragement banner](https://mobbin.com/screens/e7f636d0-1d6f-4a07-a5fa-9baaffea7734)
- [Klaviyo — vertical setup stepper with side categories](https://mobbin.com/screens/c116a0f9-8c5e-450d-b66d-d7a4f52a4b61)
- [Klaviyo — checked-off setup steps with network illustration](https://mobbin.com/screens/b420275a-ee5c-4eb2-a767-5615edcf62c5)
- [Outseta — "8/8 completed" all-checked setup guide](https://mobbin.com/screens/b1bcf27d-e787-4a4d-81f7-a1ec5515f5fe)
- [Uvodo — "Let's get you started!" sequential card checklist](https://mobbin.com/screens/d1e35f61-e3b8-482e-8f1d-99e4a9ccc611)
- [Wix — "Get ready to advertise" task checklist with error/done states](https://mobbin.com/screens/0d0b6e14-8506-49d5-aa67-b23780e1f357)

### Contextual help / explainer cards — web (incl. dev tools)
- [Zendesk — "Answer Bot · The good kind of know-it-all" 3-column explainer](https://mobbin.com/screens/36d4ecb8-d047-4dc8-86d9-fe422c1eb8ae)
- [Airtable — "Building with Airtable" quick-tips help panel](https://mobbin.com/screens/1ea4fdeb-cc68-494d-a191-1f12fcb4a2e5)
- [Graphite — "AI code review" feature explainer with benefit rows](https://mobbin.com/screens/033884c4-3e1f-4d8a-8c66-56e068a11026)
- [Cloudflare — "Load Balancing" explainer with 3 value props + how-to video](https://mobbin.com/screens/c3e1cb9b-3913-4732-a8cf-74ce43331477)
- [Remote — "Here's how this section will look" empty-bio teaching card](https://mobbin.com/screens/e067c09a-d23a-4f7d-bf88-d9016dc6dd75)
- [Intercom — "Getting started guide" with human face + explore cards](https://mobbin.com/screens/96c66796-868d-41c9-a7ae-d2d2902da168)
- [X — "Automated Account Labels · What's an automated account?" concept explainer](https://mobbin.com/screens/19dcafc2-d6ca-4dea-b0aa-b19aaa6e479a)

### Flows — guided tours & learning paths
- [Sentry — "Completing onboarding tour" (dev-tool, ends with empty-state coaching)](https://mobbin.com/flows/4bc66677-8630-45cb-b389-0d34a48a0385)
- [Front Academy — "Learning path" (concept curriculum)](https://mobbin.com/flows/c6636474-58e8-42c5-83b3-83c721c9248b)
- [KAYAK for Business — "Completing a quick start guide" (5-step progress bar tour)](https://mobbin.com/flows/90eb5647-4327-4e93-95ef-938f23c5c01b)
- [Dropbox — "Completing a guided tutorial" (persistent 0→67→100% checklist)](https://mobbin.com/flows/52de1352-23bb-4159-9b45-5e7a46192936)

## Patterns

What I actually saw across the screenshots:

**Empty-state anatomy is remarkably consistent.** Almost every web empty state is a single **vertically-centered column** floating in generous whitespace: illustration on top → bold short headline → one-line muted subhead → one primary button. Tally, Miro, Kajabi, Quicken, Copy.ai, Typeform all follow this exactly. The page is never crowded; the void is *intentional negative space*, not a layout failure. Hierarchy is strictly illustration > headline > subtext > CTA, top to bottom.

**Illustration vs text.** Two camps. (1) **Spot illustration** — Tally's loose hand-drawn figure, Typeform's sketchy dog, Quicken's checklist-with-sparkles, Kajabi's flat character pointing at a coupon. These are small (roughly 120–200px), low-detail, and signal *friendliness*, not information. (2) **Product preview** — ClickUp's empty Goals shows a faint rendered screenshot of what a filled Goal looks like; this *teaches the payoff* before any data exists. The product-preview approach is more educative; the spot illustration is more emotional. The best (ClickUp) combine: preview image + warm headline + CTA.

**Copy tone is warm, second-person, and small-stakes.** Headlines are short and human: "Make this Space yours," "Come on in, jane," "Enjoy your day!," "Build your list," "This list is lonely," "Reordering will be easy." Subtext does one job: tell you the *value* of acting (Instacart: "Items you order will show up here so you can find your favorites again"; Lifesum: "Planning your eating week is a simple, very effective way of reaching your health goals"). Notice the **future-tense, value-first** framing — they describe what the empty thing *will become*, which is exactly the "agent is learning" angle. Walmart's "This list is lonely" and Typeform's "Grab a hot cuppa (or cold brew)" show personality is welcomed but kept to one line.

**Personalization warms the void.** Typeform injects the user's name ("Come on in, jane"); HubSpot greets "Hi, Alex Smith." A named greeting on an empty screen converts emptiness into hospitality at near-zero cost.

**Color usage is restrained.** Backgrounds are white or very light gray. The only saturated color is the **single primary CTA** (Tally blue, Kajabi black, Quicken purple, Instacart green) and occasionally the illustration accent. This is the Notion-calm signal: one accent, lots of white, no competing color. Wix's checklist uses **semantic color sparingly** — green check for done, amber/red alert dot for blocked steps — color as state, not decoration.

**Progress checklists are the dominant "you're learning" device.** HubSpot, Pipedrive, Klaviyo, Outseta, Uvodo, Wix all render onboarding as a **checklist with a progress bar** (HubSpot literally "Progress: 88% · 7 of 8 complete · about 6 minutes left"). Patterns I saw repeatedly:
  - A **filling progress bar** at the top, percentage stated in words.
  - **Time estimates per step** ("About 6 minutes") to lower perceived cost.
  - **Collapsible step accordions** — only the active step is expanded with its CTA; completed steps collapse to a green check (HubSpot, Klaviyo). Progressive disclosure of the checklist itself.
  - **Two tiers**: "Start with the essentials" (3 quick wins) then "Broaden your experience" (deeper, optional) — Pipedrive. Newcomers see a short path; power is parked below.
  - **Celebration on completion**: Pipedrive "Setup complete! You're on the right track!" with a green banner and "Our users who complete these tasks go on to close more deals" — social-proof reinforcement at the finish.
  - **Dismissibility**: every checklist has "Dismiss / Remove from sidebar / Skip for now." Never trapping.
  - Dropbox's flow shows the checklist as a **persistent collapsed pill in the corner** (0% → 67% → 100%) — always-available progress without owning the screen.

**Inline coaching = anchored coach-marks with step counters.** The teaching-in-context pattern is a small card pinned by a pointer/beak to a specific UI element, with a **"Step 1 of 4" counter** and Next/Got it (Deel, HoneyBook, Grammarly "1/4," Navattic "1 of 7," Pinterest "1 of 4," Sentry "1/6"). Common traits: dimmed/blurred backdrop focusing attention on one spotlit element; a tiny pulsing circle marking the hotspot; concise title + 2–3 sentence body; explicit progress so the user knows the tour is finite. Deel and Grammarly add a **"Was this helpful? 👍👎"** micro-feedback. Arcade's tooltips are the lightest form — a single floating label ("This is for search") with no chrome.

**Feature-explainer cards teach a concept with benefit triplets.** When an app introduces a genuinely new capability, the recurring layout is a **headline + 2–3 benefit rows, each an icon + bold label + one-line description** (Graphite "AI code review": High-signal / Stay in your flow / Actionable fixes; Cloudflare Load Balancing: Maximize reliability / Avoid downtime / Intelligent control; Zendesk Answer Bot: Responds instantly / Consistent & reliable / Works with your team). X's "What's an automated account?" pairs the concept with a **mini annotated example screenshot** so the abstraction is grounded in a concrete instance. Lovable's "Your dashboard just got more Lovable" lists 4 new capabilities as icon rows behind a "New" pill. This icon-row-triplet is the workhorse for "explain a new noun."

**Progressive disclosure of concepts (the flows).** Front Academy frames learning as **named "Learning Paths"** ("Set up Front for my company," "Front for my daily work") — a curriculum of small lessons, each an icon card, with its own progress bar ("NOT STARTED" → filling). KAYAK's quick-start is a **5-stage horizontal stepper** (Overview → Approvals → Policies → Users → Next steps) with a checkmark on completed stages — the whole mental model is previewed as a path before you walk it. Sentry's tour notably ends on a **coached empty state**: "We couldn't track down an event — here are some things to try," turning a literal empty data view into a teaching moment, plus a "Come back anytime · take the tour or share feedback" re-entry card. This is the most directly relevant dev-tool pattern: emptiness annotated, tour re-launchable.

**Motion/interaction cues (inferred from stills).** Pulsing hotspot dots (Arcade, Grammarly) draw the eye; backdrops dim to spotlight; checklist items animate from open→collapsed-with-check on completion (implied by the before/after Klaviyo/HubSpot frames); progress bars fill (Dropbox 0/67/100 sequence). Arcade even layers an **audio voiceover** indicator onto a tooltip.

**State handling.** Wix distinguishes states inline: green check (done), amber/red dot + actionable button (blocked: "Upgrade Now," "Get a Domain"). Evernote's "You're all set!" 🎉 is the *completed*-empty (different from *unstarted*-empty) — confetti + "start exploring." Instacart's "Reordering will be easy" is the *will-be-populated-later* empty — it explains a future automatic state the user can't fill manually. zuzuu has all three: unstarted (no sessions), will-populate-automatically (proposals appear after distill), and completed (all proposals reviewed).

## For zuzuu

### Empty sessions (workbench, day one)
- **Adopt** the centered single-column anatomy with a **product preview**, not just a mascot. Show a faint, rendered example of what a captured session timeline *will* look like (ClickUp's empty-Goals move) under a warm headline like "Your agent hasn't run yet" → subhead "Start a session and zuzuu watches over its shoulder — every run becomes something it can learn from." One primary CTA: **"Launch a session"** (opens the embedded terminal).
- **Adopt** Instacart's future-value framing — the empty state's job is to explain that *this fills itself automatically as you work*, which is the core promise.
- **Avoid** a bare terminal with no scaffolding (the current "VS Code terminal" feel). The void must be narrated.

### Empty knowledge
- Use the **icon-row-triplet explainer** (Graphite/Cloudflare style) to define the faculty in three beats: "Facts your agent remembers · Pulled into every session's digest · You approve what sticks." Then CTA "See an example fact" (load a sample, dismissible) so the concept is grounded like X's annotated example, not abstract.
- **Avoid** the word "semantic" or "episodic" on the empty screen — teach the behavior, name the jargon later (a tooltip on the faculty label).

### Empty proposals / review inbox
- This is the **ceremony** surface — frame it like Pipedrive's celebration, not a chore queue. When empty because nothing's mined yet: "Nothing to review — yet" → "As your agent works, zuzuu drafts proposals: small suggested upgrades to its knowledge, actions, and guardrails. You'll approve or reject each one. That's how it graduates." This single paragraph teaches generations + the human gate.
- When proposals *exist*, borrow the **coach-mark with 👍/👎** affordance (Deel/Grammarly) for the approve/reject act, and a **progress bar** ("3 of 5 reviewed") so review feels like Duolingo progression, not inbox dread.
- **Adopt** Sentry's "annotated empty data view + relaunchable tour" — the most dev-tool-native pattern here.

### Coaching tips (faculty/generation/proposal vocabulary)
- Use **anchored coach-marks with an "N of M" counter** for a first-run tour of the workbench's three panes (sidebar faculties → embedded terminal → review inbox), Navattic/Pinterest style. Keep each card to a title + two sentences. Make it **finite and re-launchable** ("Come back anytime," Sentry) — never a forced gate.
- Put a **persistent dismissible help panel** (Airtable "quick tips" style) keyed to the current faculty, so the vocabulary is always one click away without modal interruption.
- **Avoid** stacking multiple tooltips at once or auto-advancing — let the user drive Next.

### The "agent is learning" mental model (the throughline)
- Make progression **visible and ambient**: a Dropbox-style **persistent collapsed progress pill** ("Your agent: Generation 2 · 4 facts · 1 proposal pending") in a corner — always-on evidence of growth without owning the screen. This is the single highest-leverage device for the core feeling.
- Adopt **future-tense, value-first copy everywhere** ("becomes," "will," "grows from") — the empty states should read as the *beginning of a trajectory*, matching the be/run/evolve story.
- Borrow Front's **"Learning Path" framing** for first-week onboarding: a small curriculum (Capture a session → Remember a fact → Review your first proposal → Mint a generation) as a checklist with time estimates and per-step CTAs, two-tiered (essentials vs. deeper). Each completed step = a green check and a tiny "your agent just leveled up" beat (Duolingo progression).
- **Avoid** the over-saturated, multi-color, badge-heavy gamification that would clash with the Notion-calm goal — keep one accent color, semantic color only for state (Wix), celebration kept to a single confetti beat (Evernote) at real milestones (first generation minted), not every click.

## Standouts

1. **[ClickUp — empty Goals with product preview](https://mobbin.com/screens/3f3c2432-3db0-4cfc-b469-2a088d38dde5)** — the model for *every* zuzuu empty faculty: a faint preview of the filled state teaches the payoff before any data exists. Calm, single CTA, no clutter.
2. **[Sentry — onboarding tour flow](https://mobbin.com/flows/4bc66677-8630-45cb-b389-0d34a48a0385)** — the closest dev-tool analogue: finite step-counted coach-marks, an *annotated* empty data view ("we couldn't track down an event — try this"), and a relaunchable "come back anytime" tour. Directly portable to the review/sessions surfaces.
3. **[Pipedrive — setup checklist + "you're on the right track" completion](https://mobbin.com/screens/c1795eb0-a714-4c8c-8108-b3f18c8faee1)** — best example of two-tiered progress (essentials then deeper), time estimates, and a celebratory, social-proofed finish — the template for zuzuu's first-week "agent is learning" path.
