# Review / Approval / Triage — design research

> Mined from Mobbin (web primary, iOS secondary), examining the actual screenshots. Lane: the human approve/reject/triage ceremony. All links are durable Mobbin URLs.

## Brief

This research informs two zuzuu workbench surfaces:

- **ReviewFlow** — the human approves/rejects the agent's proposed learnings **one at a time**. Each proposal must answer three questions at a glance: **WHAT** it learned, **WHY** (the trace/evidence behind it), and **WHAT HAPPENS** if approved (a new generation is minted). Approving should feel like a satisfying, low-effort ceremony — Notion-calm, with a touch of game-like progression — not a chore or a scary commit.
- **NEEDS YOU** — the section/badge that surfaces pending approvals so a returning user immediately knows there's a small, bounded pile of decisions waiting, and can enter the ceremony in one click.

Design questions I went looking for answers to:

1. **List vs. one-at-a-time vs. card-deck** — what layout makes a queue of decisions feel small and finishable rather than infinite?
2. **The decision unit** — how do the best tools pack WHAT/WHY/WHAT-HAPPENS into a single reviewable unit, and where do the approve/reject controls sit relative to it?
3. **Before → after** — how is a *change* (which is what a learning is) shown so the consequence of approving is legible?
4. **Reject is rarely terminal** — how do tools handle "not yet / send back" as a softer third option?
5. **The reward** — what confirmation/empty-state/progress signal makes finishing the queue feel good?
6. **Entry point** — how does a "needs your action" surface invite the user in without nagging?

## Studied

### Deel (approval queue, batch + single, request-changes)
- [Review pending items — list with summary rail & "Action needed" banner](https://mobbin.com/screens/c3ce92d8-4112-4fda-b4d7-595882028c86)
- [Review pending items — per-payer modal with Pending/Approved/Denied tabs](https://mobbin.com/screens/fff23a1f-0306-473e-9df5-e85c394b503f)
- [Review pending items — table with red/green inline ✕/✓ per row + bulk Approve/Deny all](https://mobbin.com/screens/ebede796-0ca0-408a-bf05-630420732e1f)
- [Review pending items — grouped selectable list + Approvers card](https://mobbin.com/screens/ff211d58-c815-4974-a044-dd98440f0862)
- [Request changes — stepper (Edit / Set date / Review & confirm) with before-value diff](https://mobbin.com/screens/70753431-9dc3-4c98-873f-a3273127ff34)
- [Request changes — "Before you submit" caution callout + reason-for-change](https://mobbin.com/screens/9fa3035d-3392-45aa-888d-103b57d96e1b)
- [Accept / Reject quote — full detail page, paired buttons bottom-right](https://mobbin.com/screens/66328d19-07aa-4a67-bacd-4cfea6e32885)

### Relevance AI (AI agent task queue — closest analog to zuzuu)
- [Agent task timeline — Approve / Changes requested / Reject in a top action bar over the agent's output](https://mobbin.com/screens/12228e33-2d48-435e-9027-f0c3d0f4e5f0)
- [Task with "To Review" left-nav counter + Approve / Rerun / Delete action menu](https://mobbin.com/screens/cce4fba3-6c30-485f-9043-219818fe36dc)
- ["You voted good" — lightweight feedback popover that saves to a knowledge table](https://mobbin.com/screens/860b4d5d-622b-4dea-81ed-a5582422fa17)

### GitHub (PR review = the canonical WHAT/WHY/decision pattern)
- [PR Files changed — diff + "Review changes" dropdown](https://mobbin.com/screens/72783a50-4cc2-4e3d-83f9-048f9a2455cf)
- [Review submit panel — Comment / Approve / Request changes radio + Submit](https://mobbin.com/screens/bfd88cf5-a95a-444c-a520-3bd191335344)
- [Inline comment composer anchored to a diff hunk](https://mobbin.com/screens/876e0b24-235f-4241-962d-9f0673bcccfb)
- [Notifications inbox — checkbox-select rows, Done / Unsubscribe, onboarding "Clear out the clutter" card](https://mobbin.com/screens/bc4e4d5c-3faf-4c4f-ad44-1ad4e36cb48f)

### Arcade / Hex / PlanetScale / Graphite (before→after + review panels)
- [Arcade — "Review changes" Before→After table, each row a checkbox, "12 of 12 selected"](https://mobbin.com/screens/b850abdb-2418-47b3-adaf-eac362756c6d)
- [Hex — side review panel: Comment / Approve / Request changes over a code+output diff](https://mobbin.com/screens/b6d30984-785d-4ae1-a740-986428e63945)
- [PlanetScale — deploy request, schema-change summary tiles + approved state](https://mobbin.com/screens/031355e0-f2c0-42a9-8848-f62a580d19e3)
- [Graphite — focused single-file review with bottom "Review changes" composer](https://mobbin.com/screens/b6ccfad0-873e-4362-a46f-e304779fe77f)

### Inbox / detail (master-detail triage)
- [Asana — Inbox with activity list + full task detail panel, archive-as-you-go](https://mobbin.com/screens/1787671c-7c49-45eb-ab8c-8c67a9a8ff77)
- [Linear — Inbox three-pane: notification list / issue / properties](https://mobbin.com/screens/beb9d6b3-ec34-46d7-9332-320fcb32a338)
- [Asana — Inbox empty/positive state "Invite accepted! Now set up…"](https://mobbin.com/screens/8fd461f0-689a-4011-9892-5f131fd8119a)

### Workable / Remote / Airwallex / 7shifts (inline-action inboxes & confirmation)
- [Workable — inbox row expands inline into a request card with Approve / Reject + details](https://mobbin.com/screens/206a61d4-bf58-4bca-b9b6-8226d88ffc66)
- [Workable — inbox with contextual right-edge action ("Sign document", "View profile")](https://mobbin.com/screens/7394bbf7-fef9-4066-89df-881515abc89c)
- [Remote — time-off rows with hover ✓/✕ icons, then Decline / Approve bar on select + toast](https://mobbin.com/flows/75fd654c-f131-4bc7-ad7b-ca17261177f2)
- [Airwallex — "Pending your approval (1)" count tile → slide-over detail → "approved" toast](https://mobbin.com/flows/9afbce42-5ab9-4c7a-a574-2b6b83cde1fd)
- [7shifts — Approve flow: optional message modal → "Request approved." toast → row turns green](https://mobbin.com/flows/cace8b87-c0ad-403d-99ae-72955c4f854a)
- [Miro — Access requests: row → "Approve X's request?" dialog → empty state "No requests to review"](https://mobbin.com/flows/f7a593a4-2783-4a90-8049-55021a9ad282)

### iOS (card-deck / swipe ceremony)
- [Cleo — swipe-to-sort cards: "right if it's a bill to keep, left to ditch", per-card hint chips](https://mobbin.com/screens/39d6b9d5-1a21-4085-bb29-45d0609a5680)
- [Tinder — coached overlay "LEFT TO PASS" with directional iconography](https://mobbin.com/screens/c413807e-fb8d-4a3c-997a-4942af4f156a)
- [Plenty of Fish — card with circular action cluster (rewind / ✕ / super / ♥) below](https://mobbin.com/screens/fbbbf1e3-56f3-4f56-a8f5-ad411d771a1b)

## Patterns (what I actually saw)

**1. Three dominant layouts, each with a different emotional read.**
- *Dense table/list* (Deel expenses, Remote time-off, Airwallex, 7shifts): one row per item, status pill, hover-revealed ✓/✕ icons, bulk-select with a floating action bar. Reads as **work/throughput** — efficient but cold, and the row controls are tiny (a 24px green ✓ next to a red ✕). Good for power users, intimidating for the "Notion-calm" goal.
- *Master-detail inbox* (Asana, Linear, Workable): a left list of items + a right panel showing the full item. Workable's twist is the best I saw — the **row expands inline** into a self-contained card (title "Time-off request", a short why-sentence, a labeled mini detail table, then `Approve` / `Reject` top-right). You decide without losing your place in the list.
- *Card deck / one-at-a-time* (Cleo, Tinder, POF on iOS; Deel's per-payer modal on web): the entire screen is **one decision**. Cleo is the standout — each card carries a tiny per-card instruction ("Swipe right if it's a bill you gotta keep / left if it's something you might ditch") and a logo + amount, so the WHAT and the two outcomes are both on the card. This is the most **ceremony-like** and least chore-like.

**2. The decision unit always answers WHAT, and the best ones also answer WHY and WHAT-HAPPENS.**
- *WHAT*: a bold title/subject every time (PR title, "Team Expenses", "Plane Tickets").
- *WHY*: GitHub and Hex show the **diff inline** as the evidence; Workable shows a one-line "Samantha asked you to approve time off" + a labeled detail table; Relevance AI shows the agent's **full reasoning output** above the decision bar (literally "Suggested reply/action" + "Classification").
- *WHAT-HAPPENS*: Hex's options are self-describing — "Approve — *provide approval to publish this version*", "Request changes — *recommend changes before publishing*". Miro's dialog states the consequence ("You still have available licenses… add this 1 new member without extra cost"). This inline micro-copy under each action is the single most reassuring pattern I saw.

**3. Approve/Reject controls: paired, color-coded, and the destructive one is de-emphasized.**
Across every web example the pattern is consistent: **primary filled button = Approve** (blue or green), **secondary/ghost = Reject/Decline** (outline or plain text, often left of the primary). Deel/Aboard/Airwallex/7shifts/Remote all do this. Reject is almost never a loud red filled button — red is reserved for tiny inline ✕ icons or "Delete" in overflow menus. Green check + red ✕ icon pairs (Deel table, Jira approvals, Remote hover) are used only in *dense* contexts where space forbids labels.

**4. "Reject" is usually softened into a third, non-terminal option.**
GitHub: *Comment / Approve / Request changes*. Hex: same trio. Relevance AI: *Approve / Changes requested / Reject* AND a separate *Rerun*. Deel/7shifts: an optional **message** accompanies the decision ("Leave a message for Sam Lee (Optional)"). The lesson: a binary approve/reject is rarer than a **3-way** (yes / not-yet-send-back / no), and send-back carries a note.

**5. Before → After is rendered as an explicit two-column comparison.**
Arcade's "Review changes" modal is the cleanest: rows of `Label | Before value → After value`, each with a checkbox, footer "12 of 12 selected" + "Confirm changes". PlanetScale uses summary tiles ("2 Created tables, 0 Altered, 0 Dropped"). Deel inlines "NT$330,000 — Previous: NT$345,672". The arrow glyph (→) between states does a lot of work.

**6. Selection + count is the engine of "this is finishable."**
Everywhere: a header count ("Pending your approval (1)", "2 selected", "Showing all 7 notifications", Relevance AI's "To Review 0" nav counter). Checkbox select-all → floating bar with the batch verb. The number shrinking as you work is the implicit progress bar.

**7. Confirmation is a quiet toast + a state flip, not a celebration modal.**
7shifts: "Request approved." toast + the row's status pill flips grey→green. Airwallex: "Spend request approved. The request will now be forwarded…" (tells you the *downstream consequence*). 1Password: a transient "Confirming… ✓" overlay then the entity's state updates in place. Miro: after the last approval the list collapses to an illustrated **empty state** "No requests to review." Nobody throws confetti — the satisfaction comes from the count hitting zero and a friendly empty state.

**8. Color, type, density, iconography (the calm vocabulary).**
- Color: near-monochrome canvas (white/very-light-grey), a single brand accent for the primary action, semantic green/amber/red **only** in status pills and tiny icons. Generous whitespace (Deel, Asana). The cold ones are the dense tables that drop whitespace.
- Type: bold sans subject line; muted grey secondary metadata ("3 minutes ago", "Total pending"); labels in small-caps/grey above values.
- Iconography: per-item-type glyphs in inboxes (Workable uses a different icon per request kind — signature, calendar, profile) so the queue is scannable at a glance; status dots; the → for transitions.
- Motion/interaction: hover-reveal of row actions (Remote, Deel); inline row expansion (Workable); slide-over detail panel from the right (Airwallex); swipe gestures with coached overlays (iOS). Keyboard: GitHub/Linear/Asana all expose `/`-search and j/k-style list nav; the inbox paradigm assumes keyboard triage.

## For zuzuu

Mapping the above to **ReviewFlow** and **NEEDS YOU**.

### ReviewFlow — adopt

- **One-at-a-time as the default, with the list one click away.** Combine Cleo's card-deck *focus* with Workable's *self-contained card content*. The center of the screen is a single proposal card; a slim "3 of 7" progress indicator sits above it. This is the ceremony — it makes a 7-item pile feel finishable and never shows the user an intimidating wall. (Avoid Deel's dense expense table as the primary surface — it reads as accounting work.)
- **Structure every proposal card around WHAT / WHY / WHAT-HAPPENS**, borrowing Hex's self-describing actions:
  - *WHAT it learned* = the bold title + the one-line claim (the knowledge fact / action name).
  - *WHY* = an expandable "evidence" section showing the trace excerpt(s) it was mined from — this is our **diff equivalent**; show it the way GitHub/Hex show the diff: present but collapsible so the card stays calm. The guardrails-miner's "cross-session corroboration" maps perfectly to a "seen in N sessions" chip (like Cleo's per-card hint chips).
  - *WHAT HAPPENS* = micro-copy under the primary button: **"Approve — mints generation N+1 with this learning."** Mirror Hex/Airwallex's consequence-stating copy. This directly answers the user's fear of an opaque commit.
- **Three actions, not two**, following GitHub/Hex/Relevance AI: **Approve** (primary, brand accent, filled) / **Not yet** (secondary ghost — sends back to inbox, optionally with a note, à la 7shifts' optional message) / **Reject** (de-emphasized, text/overflow, never a loud red slab). Because zuzuu already routes proposals through `inbox → proposals → archive`, "Not yet" = leave in inbox, "Reject" = archive-rejected. This matches the spine's existing gate states.
- **Before → After for any proposal that changes an existing faculty entry** (e.g. an updated instruction or a revised action): use Arcade's two-column `current → proposed` comparison inside the card. For brand-new facts there's no "before," so show just the proposed value — don't fake a diff.
- **Confirmation = quiet toast + state flip + count decrement**, never a modal. Steal Airwallex's *downstream* phrasing: "Approved — generation 12 minted. Active now." Then advance to the next card automatically. The auto-advance is what makes it feel like a satisfying rhythm.
- **End on a warm empty state**, à la Miro/Asana: when the queue hits zero, show an illustrated "All caught up — nothing needs you right now," ideally with a tiny stat ("You taught the agent 4 things today"). This is the Duolingo-progression beat — the only place a light celebration belongs.

### ReviewFlow — avoid

- Tiny green-✓/red-✕ icon pairs as the *primary* control (Deel/Jira/Remote dense rows). Fine as a power-user shortcut in the list view, but in the focused ceremony they're too small and too binary for a consequential "mint a generation" action.
- A loud red filled "Reject" button — no top tool does this; it makes rejection feel violent and discourages honest triage.
- A blocking "Are you sure?" confirm dialog on every approve (Sprout Social's delete-confirm pattern). Approving should be frictionless and reversible (we have `generation rollback`); reserve confirmation only for destructive reject-all.
- Showing the full raw trace by default — keep WHY collapsed (GitHub/Hex keep the diff scrollable, not exploded), so the card reads calm.

### NEEDS YOU — adopt

- **A counted entry point, copied from Airwallex/Relevance AI/GitHub:** a "NEEDS YOU" card or nav item with a live count ("4 proposals waiting"). Relevance AI's left-nav "To Review (0)" counter and Airwallex's "Pending your approval (1)" tile are the exact pattern — one tap launches straight into the one-at-a-time ceremony.
- **Group by faculty with per-type icons** (Workable's per-request-type glyphs): "2 Knowledge · 1 Action · 1 Guardrail," each with the faculty's icon, so the pile is legible before entry. This also reinforces the 5-faculty mental model.
- **Calm, bounded framing.** Show the *whole* small number, not an infinite feed (GitHub's "1–3 of 3", Remote's "Showing all 7"). The promise "this is a small, finishable pile" is what keeps it from feeling like a nagging inbox.
- **A friendly zero-state** when nothing's pending: don't show an empty list, show "Nothing needs you — the agent is running on generation 12." Reassurance, not emptiness.

### NEEDS YOU — avoid

- Notification-bell red-dot anxiety with an ever-growing count (the email-inbox failure mode). Cap visible urgency; if proposals pile up, summarize ("12 learnings ready to review") rather than badge-screaming.
- Burying it in a dense activity feed mixed with non-actionable items (Asana/ClickUp inboxes blend FYI + action items). Keep NEEDS YOU **action-only** — purely things that require a decision.

## Standouts (revisit these)

1. **[Hex — review panel with self-describing Approve / Request changes](https://mobbin.com/screens/b6d30984-785d-4ae1-a740-986428e63945)** — the gold standard for our card: the agent's output/evidence on the left, and on the right a tidy decision panel where **each action explains its own consequence**. This is almost exactly ReviewFlow's WHAT/WHY/WHAT-HAPPENS, already solved.
2. **[Workable — inline-expanding request card with Approve / Reject + mini detail table](https://mobbin.com/screens/206a61d4-bf58-4bca-b9b6-8226d88ffc66)** — best example of a *self-contained decision unit*: short why-sentence + labeled details + paired actions, all without leaving the queue. The template for our proposal card's information architecture.
3. **[Cleo — swipe-to-sort cards with per-card outcome hints](https://mobbin.com/screens/39d6b9d5-1a21-4085-bb29-45d0609a5680)** — the emotional target: a consequential triage decision turned into a light, game-like, one-at-a-time ceremony, with each card spelling out what each direction *means*. The "feels good, not a chore" reference.
