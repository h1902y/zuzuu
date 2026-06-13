# Onboarding & Provisioning — Mobbin Design Research

Lane: getting a developer from install to a working agent faculty home, and the
future hosted spin-up flow. Mined from Mobbin (web primary, iOS for
personalization patterns). All observations below come from the screenshots
themselves, not app reputations.

## Brief

Two zuzuu surfaces this informs:

1. **Local first-run onboarding.** Today `zz init` is a CLI scaffold + a managed
   block in CLAUDE.md. We want the *felt* experience — install → working faculty
   home (`.zuzuu/` with Knowledge/Memory/Actions/Instructions/Guardrails) → first
   captured session — to read as a guided, encouraging setup, not a config dump.
   The workbench (web surface) is where this can become visual.
2. **Future hosted / cloud spin-up.** Provisioning a cloud VM/instance where the
   agent runs: "spinning up your environment…", connecting the repo, installing
   the host binary, first digest ready. We want suspense-with-clarity, not a raw
   log wall (though a log should be *available*).

Design questions carried into this research:

- How do calm, consumer-grade products show **multi-step progress** without
  feeling like a form? (checklist vs. stepper vs. progress ring vs. % bar)
- How do you make a **provisioning wait** feel alive and trustworthy — staged
  status rows vs. streaming logs vs. both?
- How do mature dev tools (Graphite, Vercel, OpenAI, Figma) onboard *developers*
  specifically — where do they put CLI commands, and how do they avoid dumping?
- What does an **empty workspace** look like when it's welcoming rather than bleak?
- How does Duolingo-grade **personalization** (goals, experience level) translate
  to a tool that wants to feel game-like?

## Studied

### Onboarding checklists & "get started" (web)
- [Remote — self-enrollment checklist, 0% complete](https://mobbin.com/screens/ccae60b5-a85f-4803-a8ee-7d21e645b1bd)
- [Remote — checklist at 67%, completed rows ticked green](https://mobbin.com/screens/42074683-8843-4220-8a92-d33c9c73ed4b)
- [Mailchimp — "what we recommend next" with 4/5 progress ring](https://mobbin.com/screens/7f54a57c-ee77-4413-8422-f55774568201)
- [Adaline — quest-style setup, two stages ("Iterate" / "Evaluate"), all Completed](https://mobbin.com/screens/bb39ed29-a03c-4516-9951-420e326da441)
- [Docusign — "You're off to a great start" 3/5 modal checklist](https://mobbin.com/screens/3cafab73-f09f-440f-825a-51bbf6063102)
- [Langdock — points/leaderboard onboarding, "105/595", ranked #1](https://mobbin.com/screens/79f9a652-a8b4-4e7a-afcc-f9a22153b2de)
- [Apollo — "Next steps for you", Start/Finish/Completed per row](https://mobbin.com/screens/09da790a-fc80-4bd0-b0cf-0bc5fcedc394)
- [Pipedrive — "Setup complete!" success banner + 3/3 task bar](https://mobbin.com/screens/e7f636d0-1d6f-4a07-a5fa-9baaffea7734)
- [HubSpot — user guide, 88% progress bar, "about 6 min total left"](https://mobbin.com/screens/a7f6d0c9-6cd7-454d-bbb0-6d56ac81e090)

### Developer-tool onboarding (web) — most directly relevant
- [Graphite — "Get started", auto-advancing 5-step checklist with inline CLI](https://mobbin.com/screens/d5e25ee0-a30a-4bbe-bc78-e2fb213e811d)
- [Graphite — full "Setting up account" flow (6 screens)](https://mobbin.com/flows/cd797a16-9b5a-4f0f-a3bd-5ea527aa0954)
- [Figma — "Welcome to Dev Mode" numbered side-stepper, step 3 active](https://mobbin.com/flows/1ca6bdcd-93f2-4609-9c4c-b8a232dccd84)
- [OpenAI Platform — developer quickstart with copyable code block](https://mobbin.com/flows/dc9f5262-7dbf-404e-b2a4-e8e499728012)
- [Zapier Platform — "Welcome" personalization modal (role checkboxes)](https://mobbin.com/flows/51b05375-de73-4b99-8592-a97444a591e3)

### Cloud provisioning / deploy status (web) — most directly relevant
- [Replit — agent deploy: Provision → Build → Promote segmented bar + live log](https://mobbin.com/screens/65647ca7-bef2-49e2-af15-37feb7056049)
- [Vercel — Deployment Status, collapsible stages with check/spinner per stage](https://mobbin.com/screens/6f7e1b8a-d27f-48e2-8a83-385b2fd0a6bc)
- [Vercel — building, "Waiting for Build to Finish…", duration ticking](https://mobbin.com/screens/14727573-a312-43be-8707-960d7473ba16)
- [Vercel — error state, red dot, expandable error log lines](https://mobbin.com/screens/d4bd289f-0040-4309-80d1-04dcf528e4c2)
- [Cloudflare — "Building and deploying", ordered steps with per-step seconds](https://mobbin.com/screens/38e77df4-8321-4393-9bf7-6d0dac0d678d)
- [Render — building, live-tailing log terminal, "Cancel deploy"](https://mobbin.com/screens/1b400c9e-2ebe-45ad-9d14-83dca9bbd425)
- [Render — success, "Your site is live", green Live badge](https://mobbin.com/screens/62f551b7-4ac6-412c-9b3a-36390c2ae9e7)

### Empty workspace / first project (web)
- [Framer — "No Projects" empty state, calm centered prompt](https://mobbin.com/screens/27d70ca4-289a-4f82-8915-6f7da79923ec)
- [Vercel — "No projects, yet!" + framework template cards](https://mobbin.com/screens/e03a020c-0ddc-4d5f-9d75-6cfcd7f586a6)
- [monday.com — empty workspace, "Add from templates / Start from scratch"](https://mobbin.com/screens/aa34b34c-2545-4e3f-8ea1-2cb1fc5b4a80)
- [Frame.io — "Welcome to Version 4" banner over empty workspace](https://mobbin.com/screens/131f6ec6-eeb4-4d4a-9bfd-710869658d1b)
- [FLORA — minimal dark "No projects" empty state](https://mobbin.com/screens/a119f2d4-b631-46b7-b561-d8d487ae5b46)

### Create-project modals (web)
- [Plane — create project with cover image + inline metadata pills](https://mobbin.com/screens/b228f34a-3126-4da6-9ba7-6c8b49b4bcf1)
- [OpenAI Platform — minimal "Create a new project", single Name field](https://mobbin.com/screens/03c5e699-9e55-4eed-963b-57ca88aa7e9e)
- [Wrike — create project, two-pane with "Choose default view" cards](https://mobbin.com/screens/ea5fc0aa-217d-4e26-82db-5aae7b0836a7)
- [Mixpanel — create project with data-residency radios](https://mobbin.com/screens/868e67dd-e05e-4580-8294-05775927b2b6)

### Personalization onboarding (iOS)
- [Duolingo — "why are you learning" goal checklist, branded mascot](https://mobbin.com/screens/1a2c3854-ea7a-41fa-ab1b-95466c2c0228)
- [Fabric — "What is your goal?" checkbox list + Back/Skip](https://mobbin.com/screens/9ff70cf6-9690-4f05-98f8-65fad23fbe65)
- [Open — experience-level matrix (No / Some / Experienced) per topic](https://mobbin.com/screens/27874129-02ef-49e8-afbb-e068a5d01e3f)
- [BitePal — goal selection with emoji icons + green checks](https://mobbin.com/screens/63c2bcab-bd00-4ae8-a670-aaa3382d4342)
- [Calm — outlined goal pills, gradient icons](https://mobbin.com/screens/27a312c8-5d12-40d4-8c3f-06daa61897ae)
- [Origin — "Where would you like to start?", outlined option rows](https://mobbin.com/screens/f8f0c860-4775-4e5d-938c-27389a294167)
- [Blinkist — "STEP 1 OF 4" top progress bar + goal list](https://mobbin.com/screens/7c44a870-aba0-4bcc-a43d-eeadde9e4e58)
- [Preply — personalization that names the tutor: "help X prepare your lesson"](https://mobbin.com/screens/0c514946-3d75-427d-a017-1ced262c9928)

## Patterns

### Layout / grid
- **Onboarding checklists are a single centered column** of full-width rows
  (Remote, Docusign, Apollo, Graphite). Each row = icon + title + one-line
  subtitle + a right-side affordance (chevron, Start/Completed button, or
  check). This vertical-list grammar is the dominant "get started" pattern and
  reads far calmer than a grid.
- **Provisioning uses two stacked zones:** a small set of *named ordered stages*
  on top (Replit's segmented Provision/Build/Promote; Vercel/Cloudflare's
  collapsible stage rows) and an *optional detail log* below. Replit and Render
  show the log inline; Vercel keeps stages collapsed by default with the log one
  click away. The hierarchy is: human-readable stages first, raw log opt-in.
- **Empty states center a single quiet prompt** in a large negative-space canvas
  (Framer: just "No Projects / Create a new project from scratch or use a
  template"). Vercel/monday enrich the same center point with template cards.
- **Personalization (iOS) = one question per screen**, big heading top-left,
  options as full-width rows/pills below, primary CTA pinned bottom. Never more
  than one decision visible.

### Spacing & density
- Consumer-calm screens are **low density**: Framer's empty state is ~90% white
  space; Origin/Calm goal lists have generous row padding and large gaps between
  options. The dev tools that feel "VS-Code-y" (Render's log terminal, Vercel's
  static-asset table) are *high* density — useful as the *expandable detail*, not
  the default face.
- Checklist rows have comfortable vertical padding (Remote, Apollo) so the list
  reads as cards, not a table.

### Hierarchy
- **Progress is stated in plain language up top:** "6 tasks remaining · 0%
  complete" (Remote), "4/5" ring (Mailchimp), "STEP 1 OF 4" (Blinkist), "88% ·
  about 6 min total left" (HubSpot — time-to-finish is a nice trust signal).
- Completed work is **visibly banked**: Remote strikes nothing but fills rows
  with green checks; Graphite greys + strikes completed steps and only the
  *active* step is expanded with detail. This "one step open at a time"
  accordion is the single best anti-dump device seen.
- Success is a **distinct celebratory state**, not just 100%: Pipedrive's green
  "Setup complete!" banner, Render's "Your site is live 🎉" with a Live badge.

### Color usage
- Calm products keep a **near-monochrome base + one accent**: Origin/Stoic
  (black on off-white), Framer/OpenAI (grayscale + one button color). Color is
  spent almost entirely on *state*: green = done/live, amber/yellow = in
  progress or selected (Remote's amber progress bar, BitePal/Nike selected
  rows), red = error (Vercel error log).
- Game-like products (Duolingo, Langdock) use **brand color + a mascot/points**
  to inject energy, but still on a clean ground.

### Type treatment
- Headings are **warm and conversational**, often with an emoji: "Let's start
  your self-enrollment! 👋", "Nice work, you're almost there! 👏", "You're off
  to a great start". This tone does a lot of the "encouraging" work cheaply.
- Editorial serif headings (Origin, Deepstash, Zero) read premium/calm; sans
  (Blinkist, Calm) reads friendly. Subtitles are always one muted line of *why*.

### Iconography
- Onboarding rows pair each item with a **small rounded-square or circular
  icon** (Remote's pastel-tinted glyphs, Graphite's monoline icons). iOS goal
  lists lean on **emoji or soft gradient icons** (BitePal, Calm) for warmth.
- Provisioning stages use **status glyphs**: filled check (done), spinner/ring
  (active), hollow circle (pending) — Vercel and Cloudflare both do exactly
  this, and it's instantly legible.

### Motion / interaction cues
- **Per-stage spinners + ticking duration** ("4s", "Waiting for Build to
  Finish…") signal liveness without animation gimmicks (Vercel, Cloudflare).
- **Live-tailing logs** (Render's "Live tail" terminal) give a sense of real
  work happening; the log auto-scrolls.
- Graphite **auto-advances** to the next step as you complete one ("we'll detect
  and move you to the next step automatically") — progression feels earned, not
  clicked.
- Checklists offer **Skip / "do this later" / "dismiss"** escape hatches
  everywhere (Mailchimp, OpenAI "I'll do this later", Graphite "Skip this
  step") — calm = never trapped.

### Progress indication (the menu seen)
1. **% bar + "N tasks remaining"** (Remote, HubSpot, Pipedrive) — best for
   open-ended setup.
2. **Progress ring "4/5"** (Mailchimp) — compact, dashboard-friendly.
3. **Numbered stepper** (Blinkist "STEP 1 OF 4"; Figma Dev Mode 01–04 side
   rail) — best for a *fixed, ordered* sequence.
4. **Segmented stage bar** (Replit Provision/Build/Promote) — best for
   provisioning where stages are known.
5. **Points/level** (Langdock, Duolingo) — gamified, optional flavor.

### State handling (loading / provisioning especially)
- **Pending → active → done → error** is consistently expressed via the status
  glyph + color, with the *active* row carrying a duration counter.
- **Error is honest and recoverable:** Vercel shows the red dot, the failing
  stage, and an *expandable* error log with the actual message + a hint
  ("ensure 'next' is installed…"). It does not hide the log on failure.
- **Done is a state change, not silence:** Render flips the badge to "Live" and
  surfaces a "Visit" action; Vercel turns the header status to "Ready".

## For zuzuu

### (1) Local first-run (`zz init` → working faculty home)
**Adopt:**
- A **"Get started with zuzuu" checklist** as the workbench's first screen,
  modeled on Graphite/Apollo: a centered column of rows, one per milestone —
  *Create your faculty home · Connect your host (Claude Code / Codex / …) ·
  Capture your first session · Read your first digest · Add your first
  knowledge fact*. Each row: icon + title + one-line why + Start/Completed.
- **Graphite's auto-advancing accordion**: keep only the active step expanded,
  grey+strike completed ones. This is the cleanest way to surface a CLI command
  (e.g. the `zz init` / `zz code` line) in a **copyable mono block inline in the
  active step** without dumping all commands at once. Offer "Prefer npm?"-style
  alternates the way Graphite does.
- **State progress in words + a slim bar**: "2 of 5 — your agent is almost
  ready". Borrow HubSpot's time-to-finish ("~3 min left") to lower anxiety.
- **A genuine completion moment** (Pipedrive/Render): when the first digest is
  generated, show a small celebratory "Your agent is ready" card with the
  digest preview + a "Start a session" CTA — tie it to zuzuu's actual artifact.
- **Light personalization, dev-flavored** (Zapier role-checkbox, Open's
  experience matrix): a single optional question — "Which host do you use?" and
  "What do you want zuzuu to get good at?" — to seed Instructions/Knowledge
  framing. One screen, skippable.
- **A welcoming empty faculty home** (Framer/monday): when a faculty has no
  items yet, show one calm centered prompt ("No knowledge yet — zuzuu will
  propose facts as you work, or add one") rather than an empty pane.

**Avoid:**
- The VS-Code terminal-wall default (Render's raw log as the *face*). Logs are
  an opt-in detail, never the first impression.
- More than one decision per onboarding screen; no multi-field config modals up
  front (contrast the heavy Wrike/Frame.io create-project modals — too much for
  first run).
- Gamified points/leaderboard (Langdock) at this stage — it would clash with a
  dev tool's trust posture. Reserve game-feel for faculty "health"/progression
  later, lightly.

**Why:** the faculty home is already a real, inspectable artifact (the `.git`
porcelain model). The onboarding job is to *narrate* its construction
encouragingly, one earned step at a time, exactly as Graphite narrates wiring up
a CLI — which keeps it honest (every step maps to a real `zz` action) while
feeling guided.

### (2) Cloud provisioning (future hosted spin-up)
**Adopt:**
- **Replit's segmented stage bar** as the hero: name zuzuu's real stages —
  *Provision environment → Clone repo → Install host → Initialize faculty home →
  Generate first digest*. Each stage gets a glyph (hollow → spinner → check) and
  a ticking duration, exactly like Vercel/Cloudflare.
- **Stages first, log opt-in**: human-readable stage rows on top; a collapsible
  "View log" with the live-tailing stream below (Render). Default collapsed
  (Vercel), so it reads as "spinning up your environment…" not a console.
- **Encouraging interstitial copy** per stage ("Setting up your agent's
  home…"), keeping the warm-heading tone from the consumer set.
- **Honest, recoverable errors** (Vercel): on failure, mark the failing stage
  red, auto-expand the log to the relevant lines, show the message + a next
  action (Retry / Get help). Never silently spin.
- **A live-state finish**: flip to "Your environment is ready" with a Live-style
  badge and a primary "Open workbench / Start session" action (Render's
  "Visit").

**Avoid:**
- A single indeterminate spinner with no stage breakdown — the staged status is
  what makes a wait feel trustworthy and short.
- Hiding the log entirely on error (developers need it) — make it *available*,
  just not the default surface.
- Over-theming the provisioning screen; keep it near-monochrome + status color
  so the stage glyphs carry all the meaning.

**Why:** provisioning is inherently a wait; the consumer-calm move is to convert
"unknown wait" into "named, ticking, finite stages" (Replit/Vercel/Cloudflare
all converge on this) while keeping the raw log one click away for the moment a
dev actually needs it.

## Standouts

1. **[Graphite — "Get started" auto-advancing checklist](https://mobbin.com/screens/d5e25ee0-a30a-4bbe-bc78-e2fb213e811d)**
   — the single best template for zuzuu local first-run: dev-tool onboarding that
   embeds copyable CLI commands inside an *active-step-only* accordion,
   auto-advances, greys completed steps, and offers per-step skip. Honest and
   uncluttered at once.
2. **[Replit — agent deploy: Provision/Build/Promote + live log](https://mobbin.com/screens/65647ca7-bef2-49e2-af15-37feb7056049)**
   — the closest analog to zuzuu's hosted spin-up: named segmented stages for an
   *agent* environment with the streaming log right there. Directly maps to our
   "spinning up your environment…" need.
3. **[Vercel — collapsible deployment stages with per-stage status](https://mobbin.com/screens/6f7e1b8a-d27f-48e2-8a83-385b2fd0a6bc)**
   (with its [error state](https://mobbin.com/screens/d4bd289f-0040-4309-80d1-04dcf528e4c2))
   — the reference for stage glyph language (check / spinner / hollow), default-
   collapsed logs, and honest, expandable error handling.
