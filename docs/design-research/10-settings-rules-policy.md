# Settings, Rules & Policy Editing — Mobbin design research (web)

> Research date: 2026-06-13. Lane: settings, rules & policy editing. Platform: web.
> Method: 5 deep Mobbin searches (~50 screens examined inline). Analysis is from the
> screenshots themselves, not app reputation.

## Brief

This research informs three zuzuu workbench surfaces, all of which currently risk reading
like a JSON config file and need to feel approachable, legible, and consumer-SaaS-calm:

1. **Guardrails view** — an allow / ask / deny rule list (enforced tool-call policy) that a
   non-engineer can read and edit. Each rule pairs a *match* (a tool/pattern) with a
   *decision* (allow > ask > deny, with deny>ask>allow precedence) and a severity/reason.
2. **Standardized item schema viewer** — every faculty item (knowledge fact, action,
   instruction) has typed fields; we need a clean key / value / typed-field display that
   reads like a record card, not a raw object dump.
3. **Instructions editor** — the pinned steering/system-prompt artifact: a long-form text
   document with metadata, that should feel like editing a calm document, not a code blob.

Design questions carried into the research:
- How do mature products make a *policy* (a list of allow/deny decisions) legible without a table of slugs?
- How is an "if-this-then-that" rule made readable in plain language?
- How are typed fields (text/select/date/toggle/relation) displayed so the *type* is obvious but the screen stays quiet?
- How is inline validation surfaced without making the form feel hostile?
- How are enabled/disabled and allow/ask/deny *states* color-coded without alarm?

## Studied

### Settings with grouped toggles + descriptions
- [Monarch — Preferences: "How transactions work" grouped toggles](https://mobbin.com/screens/de463158-cd7c-4587-a510-6c95c90334f1)
- [Linear — Preferences: "Coding tools" toggle list with sub-labels](https://mobbin.com/screens/332e33ea-6a11-476e-9442-06d1ec5a49bb)
- [ClickUp — Preferences: toggle rows with descriptions + inline code chips](https://mobbin.com/screens/b44bf8ee-6d4e-4b15-b70e-fe5d94feaa1e)
- [Braintrust — Feature flags / Debug flags grouped toggles with warning glyph](https://mobbin.com/screens/12f141bb-d3ff-4d6f-b6cb-0df4cc845489)
- [Whereby — Configure: Pre-call features toggles + nested radio sub-options](https://mobbin.com/screens/337688ae-6c23-4778-ad73-61acb98f8347)
- [Expensify — More features: icon + toggle "enable optional functionality"](https://mobbin.com/screens/f6c2908a-b624-49fe-a9dd-5bfd1a470a3b)
- [Circle — Options: notification checkboxes + permissions toggle stack](https://mobbin.com/screens/102ce57a-51b3-402a-a65b-f01d61386368)
- [Canny — Board Settings: category rows with inline cancel/save toggle](https://mobbin.com/screens/dc7522ce-1f2a-4fc9-9c93-af8f70a083d4)
- [Deel — Group Settings: carded settings + "require approval" radio choices](https://mobbin.com/screens/6e9e81b6-6f2f-478f-b42b-cae4bd465385)

### Rule / condition builders (if → then)
- [ClickUp — Automation rule: Trigger → Action two-card layout](https://mobbin.com/screens/45f020cf-80c6-4d5e-9f4e-2974f661c0dd)
- [ClickUp — Automation rule with added "if this condition is true" block + plain-English summary bar](https://mobbin.com/screens/a33570e2-4678-4ec4-ba92-431683678c53)
- [Kit — Automation Rule: Trigger column ("When this happens") / Action column ("do this")](https://mobbin.com/screens/0d4d0413-bcd2-410c-83b0-c5d46655b48e)
- [Kit — Automation Rule with a selected trigger expanded](https://mobbin.com/screens/d1a77063-7b00-4c6e-852a-879f095085e0)
- [Employment Hero — Automation Flow: WHEN / IF / THEN stacked step cards in plain language](https://mobbin.com/screens/596c64d5-47bd-4508-8d3b-6636a2a68ce8)
- [Reddit — "Name and describe your rule": rule name + description with live char count + green checks](https://mobbin.com/screens/b6fd2736-d804-4622-990d-0fbbf6d70b43)
- [Attio — Workflow editor: vertical node graph with If/else branch + side inspector](https://mobbin.com/screens/49faf2be-c049-433a-a75d-4ca28eacb436)
- [n8n — Workflow canvas: node chain Schedule → HTTP → Edit → Send](https://mobbin.com/screens/b010b565-632b-4e06-8c20-2f30de8bf4eb)

### Permissions / allow-deny policy editors
- [Vanta — Roles "Permission details": action × role matrix with Edit / View only / No access](https://mobbin.com/screens/6dd83a18-ede6-44a5-adc5-2ebff239c7de)
- [Remote — role builder: area rows with VIEW / EDIT checkbox columns](https://mobbin.com/screens/7c6676e3-a292-4efd-9567-dc2e4aa91617)
- [Remote — role permissions: checked VIEW/EDIT grid + email-notification preview](https://mobbin.com/screens/62169802-cd69-4285-bba5-9dc26513156f)
- [Remote — Admins & Permissions: role cards + side inspector by area](https://mobbin.com/screens/2275c4f5-2346-46e5-871b-1dfb9baeeea1)
- [WorkOS — Roles & Permissions: name + description + monospace slug + System/Default tag](https://mobbin.com/screens/f1440a38-2cac-4c33-90dc-667b0cc84f7a)
- [Clerk — Role detail: permission rows with checkbox + monospace key + search/sort](https://mobbin.com/screens/fb14e44a-8042-4c98-a0dd-ae17cd9a4767)
- [Kajabi — Role picker: radio cards each with a one-line plain-English consequence](https://mobbin.com/screens/11453f08-7731-4a55-a374-40c188929a39)
- [Harvest — Permissions: radio tiers with indented sub-capability checklist](https://mobbin.com/screens/6ba4dda3-558d-43b0-bed1-b3b167b77636)
- [Wix — Change Role: checkbox role list with "View Role Permissions" links](https://mobbin.com/screens/31f52d2e-ef17-4cf2-a5c6-3402dcfa3760)

### Form fields + inline validation
- [Reddit — rule fields with green check on valid + max-char counters](https://mobbin.com/screens/b6fd2736-d804-4622-990d-0fbbf6d70b43)
- [Patreon — Settings form: per-field red helper text + pink summary banner](https://mobbin.com/screens/cb9f9a4d-4056-4be3-b0f1-a37f28c966ec)
- [Pipedrive — Company info modal: red-outlined required fields + side "why is this needed" panel](https://mobbin.com/screens/d9f53d0e-8d1c-418e-80d9-5781ae29307d)
- [Perplexity — Create API Group: inline "X is required" right-aligned per field](https://mobbin.com/screens/696c6b33-1b6b-46a1-a2b3-09c0d48b1c76)
- [Chatbase — Webhooks: event checkbox + endpoint field with "Invalid Endpoint" error](https://mobbin.com/screens/1664c086-cf8b-4b72-be83-702f5a110c85)
- [Cloudflare — Add Notification: labeled fields + single summary error line](https://mobbin.com/screens/e8049d79-5b54-4b4d-906e-3484a3eebbf8)

### Typed-field / schema viewers
- [Fibery — record with field-type picker open (Text, Select, Date, Checkbox, Relation, …)](https://mobbin.com/screens/75ce0fea-8d41-46cb-a374-340820905253)
- [Fibery — record key/value rows with leading type icons](https://mobbin.com/screens/11ad1760-e83e-4241-b988-7544fe5c7b51)
- [Attio — Record details inspector: icon + label + typed value rows, "Show more"](https://mobbin.com/screens/cf4f2b49-652f-4c76-8a7c-1ea4f57c10cf)
- [Attio — Record side panel: Record details + Lists with typed pill values](https://mobbin.com/screens/96ccd399-afba-4a09-b6af-3c65fbecbfa1)
- [Deputy — Custom Field record: stacked labeled read fields incl. "Validation", "Type of field"](https://mobbin.com/screens/8008bba6-8cf8-4139-a835-4794b1e97132)
- [Zoho CRM — Price Book: two-column key/value detail + embedded sub-table](https://mobbin.com/screens/01e9e0e2-6c42-4baa-91cf-504fa0239207)
- [Salesforce — Advanced User Details: dense legacy key/value (anti-pattern reference)](https://mobbin.com/screens/0365bde7-c320-46a0-b2e9-3ea0bb9f8451)

## Patterns

What I actually saw across the screenshots:

**Layout / grid.**
- The dominant settings shape is a **left rail (section nav) + right content column**, content
  capped to a comfortable reading measure (~600–720px) even on wide screens (Linear, ClickUp,
  Monarch, Vanta, WorkOS). Content does not stretch edge-to-edge.
- Settings group into **carded sections with a section title + one-line subtitle**, then a
  vertical stack of rows (Monarch "How transactions work", Expensify Spend/Organize,
  WorkOS Permissions/Roles cards). Cards are the unit of grouping, not borders between every row.
- Rule builders consistently use **two side-by-side cards: Trigger | Action**, joined by a
  horizontal arrow (ClickUp, Kit). Conditions appear as an *inserted block between* them, not a
  new screen. Node-graph tools (Attio, n8n) put the same logic on a **vertical/horizontal canvas
  of connected boxes** — heavier, more "developer", and the one to avoid for a calm surface.
- Permission editors are either a **matrix** (Vanta: rows = actions, columns = roles, cells =
  Edit/View only/No access) or **area rows with VIEW/EDIT checkbox columns** (Remote). Both keep
  one decision per cell.

**Spacing & density.**
- The calm references (Linear, Monarch, Attio, Fibery) use **generous vertical rhythm**: each
  toggle row gets ~56–72px with the label and its description both inside, separated by hairline
  dividers or pure whitespace. No row is cramped.
- The anti-pattern (Salesforce Advanced User Details) crams dozens of tiny key/value pairs in a
  multi-column grid with near-zero spacing — it reads as a database dump and is exactly the
  "JSON config" feeling to avoid.
- Zoho's two-column key/value is denser but stays legible because each pair has clear label/value
  contrast and the columns are wide.

**Hierarchy.**
- The strongest rows are **bold label (sentence case) on line 1, muted gray description on line 2,
  control pinned right** (Linear, ClickUp, Monarch, Whereby, Expensify). The eye reads name →
  meaning → state, left to right then down.
- Section title > row label > description is a clean 3-level type ramp; everything below the
  control sits in muted gray so the *active choice* (the toggle/checkbox) is the brightest thing.

**Color usage.**
- Color is **reserved for state**, not decoration. Toggles go **green/blue when on, gray when off**
  (Linear green, ClickUp/Monarch blue/orange, Whereby green). Backgrounds stay white/near-white.
- Permission states earn a small semantic palette: Vanta uses **green check = Edit, gray eye =
  View only, red X = No access** — three states, instantly scannable. This maps almost 1:1 onto
  allow / ask / deny.
- Warnings use **soft tinted callout boxes** (Monarch blue info box, Braintrust amber "Debug flags"
  with a ⚠ glyph, ClickUp yellow "if status doesn't exist, create a new status"). Tints are pale,
  never saturated alarm-red blocks.
- Validation errors use **thin red helper text under the field** (Patreon, Perplexity, Chatbase) or
  a **red field outline** (Pipedrive) — red appears only on the offending field, plus an optional
  one-line summary banner.

**Type treatment.**
- Labels and descriptions are normal UI sans; **monospace is used surgically** for machine
  identifiers — WorkOS and Clerk show permission *slugs* (`widgets:users-table:manage`,
  `org:feature:permission`) in a small mono chip beside the human name. This is the key trick:
  human name in front, machine value present but visually demoted.
- ClickUp also drops inline mono chips into description prose (`CMD + ENTER`) to name keys without
  breaking the sentence.

**Iconography.**
- Typed-field viewers lead every row with a **small type glyph**: Fibery and Attio prefix each
  field with an icon denoting its type (Aa text, # number, calendar date, checkbox, person/relation,
  link). Fibery's "New Field" picker literally lists the type icons (Text, Rich Text, Number, Single
  Select, Multi Select, Date, Checkbox, People, URL, …) — a clean taxonomy to borrow.
- Rule builders use a **lightning/zap = trigger** and **gear/cog = action** convention (Kit,
  beehiiv), making the two halves recognizable pre-reading.
- Icons are monochrome line icons at the muted-gray weight; they aid scanning without adding color noise.

**Motion / interaction cues.**
- Inline editing without page changes: Canny shows a row flipping into an inline **Cancel / Save**
  state; Attio/Fibery values are click-to-edit in place. Saves are local to the row.
- Validation is **live**: Reddit shows a green check appear the moment a field is valid plus a live
  `60 / 100` character counter; this gives a small "you got it right" reward (the Duolingo-progress
  flavor zuzuu wants).
- Bottom-anchored **Save changes / Cancel** bar appears when a section is dirty (ClickUp, Circle,
  Kajabi) — the rest of the time it's absent, keeping the screen quiet.

**How rules/conditions are made readable.**
- The single best legibility device: a **plain-English summary sentence** rendered live from the
  structured inputs. ClickUp shows, pinned at the bottom of its rule modal:
  *"When [Task or subtask created] and [Condition is true] then [Change status]"* with the variable
  parts as colored chips. Employment Hero stacks the same as labeled WHEN / IF / THEN cards with the
  values inline in colored text. The user builds structure but reads a sentence.
- Conditions are **dropdown triplets** — field selector ("Priority") + operator ("Is equal to") +
  value ("Select a priority") (ClickUp) — never raw expression text.

**State handling.**
- On/off, enabled/disabled, allow/ask/deny are all expressed as **one control per row** with a clear
  color delta. Beta/system/default states are small **uppercase pill tags** (Linear/Deel "BETA",
  WorkOS "System"/"Default", Clerk "Creator role"). Disabled/locked states gray the whole row and may
  show a lock icon + an explanatory banner ("You are the Account Owner. You cannot change your
  permissions." — Harvest).

## For zuzuu

### Guardrails rule list (allow / ask / deny)
**Adopt:**
- The **Vanta three-state semantic palette** — map green check = **allow**, amber/gray = **ask**,
  red = **deny**. One colored decision token per rule row makes the whole policy scannable in one
  pass and reads as "approachable", not "config".
- The **bold-label / muted-description / control-right row** (Linear/Monarch). Each guardrail row:
  rule name (e.g. "Run shell commands") → one-line plain description of what it gates → an
  allow/ask/deny **segmented control** pinned right. Group rows into cards by category (filesystem,
  network, shell, etc.) with a section title + subtitle.
- The **plain-English summary sentence** from ClickUp/Employment Hero. When a rule has a pattern,
  render it as a sentence: *"**Ask** before any tool matching `rm *` runs in `.zuzuu/.traces/`."*
  with the variable parts as chips — so even a pattern-based rule reads as English.
- The **monospace-chip-beside-human-name** trick (WorkOS/Clerk) for the literal match pattern:
  show the friendly name large, the literal `bash:rm -rf *` pattern as a small mono chip — present
  for the engineer, demoted for everyone else.
- A small **severity/precedence pill** (deny>ask>allow) using the uppercase-tag style; and, like
  Harvest's locked banner, when a deny is *policy-enforced and not editable*, gray the control and
  show a one-line "enforced by guardrails gate" note — matching the CLAUDE.md framing that "a
  refusal there is policy, not preference."

**Avoid:**
- The Attio/n8n **node-graph canvas** — too engineer-heavy for a policy list a consumer reads.
- Saturated full-red error blocks; use Monarch/Braintrust **pale tinted callouts** for "this rule
  blocks a common action" warnings.

### Schema field viewer (typed item display)
**Adopt:**
- The **Fibery/Attio leading type-icon + label + value row** as the canonical item display: each
  field is `[type glyph] Label …………… typed value`. Borrow Fibery's exact type taxonomy/icon set
  (text, rich text, number, single/multi select, date, checkbox, relation, URL) so a knowledge
  fact, an action's manifest, and an instruction all render with the same legible grammar.
- **Typed value rendering**: select values as colored pills (Attio "Medium"/"Meeting"), dates
  humanized ("Jan 6, 2026 12:05 pm"), booleans as a checkbox/toggle, relations as a person/link
  chip — so the *type* is obvious from the value's shape, no schema legend needed.
- A **"Show more / Show all values"** collapse (Attio) to keep the default card short and calm.
- Deputy's pattern of showing **field metadata as just more labeled rows** ("Type of field: Text",
  "Validation: Unique") is a good model for a read-only schema *definition* viewer.

**Avoid:**
- The **Salesforce dense multi-column key/value dump** — it's the literal "feels like JSON" failure
  mode. Keep generous row spacing and a single-column (or at most wide two-column) reading layout.

### Instructions editor
**Adopt:**
- Treat it as a **document with a thin metadata header**, not a form: Reddit's rule editor (large
  name field + multiline description + **live char counter + green-check-on-valid**) is the closest
  calm reference and adds the small "you're doing it right" reward.
- A **right-side "why this matters" context panel** (Pipedrive) to explain what the steering artifact
  does and how it's used at session start — onboarding without modal interruption.
- A **dirty-state bottom Save / Cancel bar** (ClickUp/Circle) that only appears on edit; autosave
  with a quiet "Saved" indicator (Base44/n8n showed unobtrusive "saved"/"settings saved" toasts) is
  even calmer if feasible.
- Inline validation as **per-field red helper text** (Patreon/Perplexity), never a blocking modal.

**Avoid:**
- A code-editor chrome (line numbers, mono everywhere) for the body — keep it a calm prose surface;
  reserve monospace for any literal tokens/variables referenced inline (ClickUp inline-chip style).

## Standouts

1. **[Vanta — Permission details matrix](https://mobbin.com/screens/6dd83a18-ede6-44a5-adc5-2ebff239c7de)** — the cleanest three-state (Edit / View only / No access) policy display I saw; the direct template for allow / ask / deny as colored, scannable tokens.
2. **[ClickUp — Automation rule with condition + plain-English summary bar](https://mobbin.com/screens/a33570e2-4678-4ec4-ba92-431683678c53)** — the live "When … and … then …" sentence built from structured chips is the single best idea for making a guardrail rule read as English while staying editable.
3. **[Fibery — typed record with field-type picker](https://mobbin.com/screens/75ce0fea-8d41-46cb-a374-340820905253)** — the type-icon-per-row grammar and the full type taxonomy to adopt directly for the schema field viewer.
