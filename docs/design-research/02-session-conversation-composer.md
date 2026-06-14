# 02 — Session-as-Conversation & Composer

> Design research mined from Mobbin (web platform). Lane: the center **session pane** (an agent coding session rendered as a *conversation*, not a raw terminal) and the **host-picker composer** at the bottom. All observations below come from examining the actual screenshots, not app reputation.

## Brief

**zuzuu surface this informs:**
- **Center session pane** — today this feels like a VS Code embedded terminal (xterm.js running the real host CLI; see `web/CLAUDE.md` and DESIGN §13). The goal is to make the *transcript of an agent coding session* read as a calm, legible conversation: user turns, agent prose, tool calls (file edits, command runs), checkpoints, and rollback — game-like and welcoming, not a wall of monospace.
- **Composer (bottom)** — the input bar where the user types the next instruction and picks the **host** (Claude Code / Codex / Gemini CLI / OpenCode / pi) and any per-turn options (model/effort/think/tools). zuzuu's twist: the picker chooses a *host agent*, which maps onto the existing model-picker pattern.

**Design questions:**
1. How do polished AI products render a long agent transcript so it stays scannable (turn separation, density, tool-call chrome)?
2. How are tool calls / actions / file edits shown inline without becoming terminal noise?
3. Where does the model/agent picker live, and how is it kept lightweight inside the composer?
4. How is the live streaming + stop state handled so the session feels alive but controllable?
5. What makes the empty/first-run state welcoming (suggestion chips, greeting) vs. an intimidating blank prompt?

## Studied

### Replit (agent session as conversation — the closest analog)
- [Agent session: tool calls, checkpoint + Rollback, paused-for-feedback](https://mobbin.com/screens/76782202-de59-4f09-9147-0f7082aa6e33)
- [Agent transcript beside Git panel of agent-query commits](https://mobbin.com/screens/e6bd0dd5-1d05-4e8f-82be-c9b47bb72b8d)
- [Agent transcript with right-side "search files & open tools" command list](https://mobbin.com/screens/8f9edd18-646a-44bd-a773-509560a7cb3b)
- [Agent at work: "The agent is working", inline file-creation card with code](https://mobbin.com/screens/9d5d7187-c5ad-49ff-9555-2bc3c7c53a07)
- [Agent transcript beside live Deployment logs (terminal contrast)](https://mobbin.com/screens/a6b34df8-0315-4c10-8036-84d3c3167f8b)
- [Agent plan approval + checkpoint card](https://mobbin.com/screens/35b06990-bf66-4fbc-93ee-03f91935ad1e)
- [Agent making an inline diff edit to a component (+/- lines)](https://mobbin.com/screens/87a35e8c-6906-48cd-9a01-1d3089ba3a05)

### v0 (chat + code, paired panes)
- [Chat summary of changes (left) beside live code editor (right)](https://mobbin.com/screens/a18ebbf1-2b4a-4673-9df0-8f87fe3b827e)

### Cursor (host/model picker in composer)
- [Multi-model picker dropdown with per-model run-count multiplier (1x/2x/3x/4x)](https://mobbin.com/screens/5086a06b-e76b-49ad-a5e4-c2100759b758)
- [Composer with selected models summarized in the bar + "Use Multiple Models" toggle](https://mobbin.com/screens/5cfd4022-fd5e-4372-b240-2e37754159fc)

### ChatGPT (streaming responses, code blocks, composer affordances)
- [Code block with language tag + "Copied!" confirmation, message composer below](https://mobbin.com/screens/8a3566f7-a50a-42d0-899e-4f35aa914ae8)
- [Streaming response: "Stop generating" pill above an empty composer](https://mobbin.com/screens/555d178b-80cc-4258-821f-0572131b5237)
- [Collapsed code "canvas" card (titled, expandable) inside the thread](https://mobbin.com/screens/e67fe462-15f7-4a10-a3e0-729c7d011d4e)
- [Composer with tool row: Search / Reason / Deep research / Create image + mic](https://mobbin.com/screens/4669fb5d-e8e9-40bd-b1aa-0a7aee0cbb84)
- [Inline model switcher attached to a message ("Try again" / model list)](https://mobbin.com/screens/b43bd331-016a-478e-a5fb-db7ae48647a7)
- [Empty state: greeting + suggestion chips + model dropdown](https://mobbin.com/screens/cf29fa0a-84c9-4760-8f23-17e8d57c0275)

### Tool-call / step rendering
- [Lindy — checklist of agent steps (green ticks, "Processing…") + Browser/Terminal tabs](https://mobbin.com/screens/9f4affd5-f387-4149-860e-95c83f9bbba5)
- [Zapier — "Action Complete" card with checkmark + "Running behavior" expandable trigger](https://mobbin.com/screens/d07c81c6-8dec-4d4a-af73-e7243aedfd2b)
- [Cohere — "Performing multistep reasoning using tools": rationale + web-search + python-interpreter line items](https://mobbin.com/screens/dace5f8f-6695-435f-ae31-0984f2e40dcf)
- [Sana AI — inline file chip + "Processing done" status toast in composer](https://mobbin.com/screens/58916336-60b0-41aa-8505-b9590117f436)
- [Perplexity — "Working… / Searching" step with a query chip and "Skip remaining steps"](https://mobbin.com/screens/65c3e7c2-6c18-4921-b610-b0e8c1d882eb)

### Composer empty / first-run states
- [Gemini — "Hello, Sam" greeting, 4 suggestion cards, bottom prompt bar](https://mobbin.com/screens/be5f7c2c-f145-4681-8262-fcb2f805d6f3)
- [Grok — centered greeting, composer with DeepSearch/Think chips + model + suggestion list](https://mobbin.com/screens/d32dfa3b-85a5-461e-bf12-bdd28614c56f)
- [Microsoft Copilot — minimal centered composer + "Quick response" mode pill + chip row](https://mobbin.com/screens/fd6220ab-dc91-4a15-920b-9d519a691d9f)

### Host/agent picker variants
- [ChatGPT — model dropdown with one-line descriptions + "More models"](https://mobbin.com/screens/e76a50ef-84d0-480e-8d9d-9d15efcbc52d)
- [Chatbase — model picker with per-model description panel + "Credits cost"](https://mobbin.com/screens/f68fb0a4-3309-4cc3-b904-dc9cb724943a)
- [Fabric — searchable model list grouped by provider with brand glyphs](https://mobbin.com/screens/fa243590-216a-4289-b8ee-7092c7e02e1e)

## Patterns

**Layout / grid.** Two dominant arrangements. (1) **Single centered column** for pure chat (ChatGPT, Gemini, Grok, Copilot): the transcript and composer share one ~640–720px measure, centered on a wide neutral field — generous side margins make it feel calm rather than dense. (2) **Split: conversation rail + work pane** (Replit, v0, Lindy): a narrow left transcript (~300–360px) carries the conversational narrative while the right pane holds the *actual artifact* (code editor, live preview, logs, browser). Critically, Replit keeps the **terminal/logs as a separate tab in the right pane**, NOT in the conversation — the conversation stays prose-and-cards; raw monospace lives elsewhere.

**Spacing & density.** The conversational surfaces breathe: turns are separated by large vertical gaps, the agent's prose is plain paragraph text (not monospace), and tool actions are compressed into single-line items. Replit reduces a file edit to one line ("Edited db/schema.ts", "Executed npm run db:push") with a small leading glyph — what would be 40 lines of terminal output becomes a one-line receipt. Contrast the *deployment logs* screen: that pane is intentionally dense monospace, visually confirming that density is a deliberate per-pane choice, not the default.

**Hierarchy.** User turns are visually demoted/distinguished by a tinted bubble or right-alignment; the agent's output is the unstyled "body" of the page. Within an agent turn the hierarchy is: prose intent → action receipts (ticked line items) → a **bordered card** for anything substantial (a plan to approve, a created file, a diff, a checkpoint). Cards are the load-bearing device: they wrap code, file edits, and approvals in a contained rounded rectangle so they read as discrete events in the timeline.

**Color usage.** Overwhelmingly **neutral** (white/near-white or charcoal dark) with restrained accent. Status carries the only saturated color: green checkmarks for completed steps (Lindy, Zapier), a subtle amber/violet banner for "paused / needs feedback" (Replit), red `+/-` only inside diffs. Code blocks invert to a dark slab even in light themes (ChatGPT) so code is unmistakably a distinct object. Brand/provider glyphs (Anthropic, OpenAI, Gemini icons) add the only "logo color" and only inside the model picker (Fabric, Chatbase).

**Type treatment.** Two type registers, strictly separated: a humanist sans for conversation/prose and UI, and **monospace reserved for code and command receipts**. Code blocks get a small language label in the top-left ("python", "javascript", "html") and a top-right action ("Copy code", "Edit", or a "Copied!" success swap). Greetings in empty states are large and warm ("Hello, Sam", "Hi Alex, what should we dive into today?").

**Iconography.** Minimal, line-weight icons. Recurring set: leading dot/spinner for in-progress, check for done, small file/terminal/screenshot glyphs prefixing action receipts (Replit), paperclip + image + mic + "+" in the composer (ChatGPT, Copilot), a circular send/up-arrow button anchored bottom-right of the composer (near-universal). Mode chips (DeepSearch, Think, Reason) use a tiny leading glyph + label in a pill.

**Motion / interaction cues (inferred from captured frames).** Streaming is signaled by a **"Stop generating" pill** floating above the composer and the send button morphing into a square stop button (ChatGPT). In-progress steps show a spinner + present-tense label ("The agent is working", "Working…", "Processing…", "Searching") that resolves to a checkmark. Long step lists let you **"Skip remaining steps"** (Perplexity) — progress is interruptible. Replit's checkpoint card carries a "Rollback to here" button, making the timeline navigable, not just readable.

**State handling.** Rich, explicit states: *empty/first-run* (greeting + suggestion chips + composer pre-loaded with mode), *streaming* (stop affordance), *paused/awaiting-input* (banner: "Agent is waiting for your response"), *action-complete* (collapsed receipt card with check), *plan-pending-approval* (card with "approved" stamp once accepted), and *checkpoint* (rollback-able marker). Each agent action has a clear before/after status, never an ambiguous "is it still running?".

## For zuzuu

**Center session pane**

- **Adopt the conversation-rail + work-pane split (Replit/v0).** Keep zuzuu's embedded terminal/host CLI as it is for the *raw* view, but render the *narrative* — user instruction, agent intent, the faculty/tool receipts — as a calm prose conversation in a column. The xterm terminal becomes one tab in a work pane, not the whole experience. This directly answers the "feels like VS Code terminal" problem: demote the terminal from default surface to on-demand tab.
- **Adopt one-line action receipts for tool calls (Replit).** A file edit, a command run, a screenshot, a guardrail decision should each collapse to a single line with a leading glyph ("Edited store.mjs", "Ran npm test", "Guardrail: blocked rm -rf"). Expandable on click to reveal the diff/output. This is the single most important move to turn terminal noise into a legible timeline — and it maps perfectly onto zuzuu's existing faculty vocabulary (each receipt can cite `from knowledge: <id>` or name the action it ran).
- **Adopt the bordered-card device for substantial events.** Plans (the agent's proposed steps), created/edited files (with diff +/-), and especially zuzuu's **checkpoints/generations** belong in cards. Replit's "Rollback to here" is a near-exact visual for zuzuu's generation rollback (DESIGN: "rollback = flip the active pointer") — reuse this pattern so generation history reads as a navigable timeline inside the session.
- **Adopt the green-check / spinner step list (Lindy, Cohere) for multi-step agent work** — present-tense label while running, check when done, all in the conversation column. Make it interruptible (Perplexity's "Skip remaining steps") — this fits zuzuu's interactive-mode-first, never-headless stance.
- **Adopt explicit paused/awaiting-input banner (Replit).** When the host agent stops for the user, show a calm banner, not silence. This is the "welcoming, uncomplicated" feeling the brief wants.
- **Avoid** dumping raw monospace into the conversation column — that *is* the current terminal problem. Avoid Replit's overall density/chrome heaviness (multiple toolbars, tab strips); zuzuu wants Notion-calm, so lean toward the centered-single-column whitespace of Gemini/ChatGPT for the conversation itself.
- **Avoid** styling code blocks as plain text — invert them to a contained dark slab with a language label + copy button (ChatGPT) so code reads as a discrete object even in a light, calm theme.

**Composer (host-picker)**

- **Adopt Cursor's pattern for the host picker.** Cursor's composer summarizes the chosen model(s) as a small text token in the bar and opens a checkbox dropdown to switch — this maps almost 1:1 onto zuzuu picking a *host* (Claude Code / Codex / Gemini CLI / OpenCode / pi). Show the active host as a quiet pill in the composer; the dropdown lists hosts with brand glyphs (Fabric's provider-grouped, glyph-led list is the cleanest reference).
- **Adopt one-line descriptions in the picker (ChatGPT, Chatbase).** Each host gets a short "what it's good for" line. Chatbase's side description panel + "Credits cost" is a useful reference *if* zuzuu ever surfaces the flagged credits hypothesis — but keep it optional, since credits are explicitly undecided (DESIGN §6).
- **Adopt mode chips in the composer (Grok/ChatGPT: Think, DeepSearch, Reason).** zuzuu's per-turn options (effort/think/tool toggles, or "consult faculties") fit this exact slot — small pills on a row beneath the input, with the send button anchored bottom-right.
- **Adopt the welcoming empty state (Gemini/Grok/Copilot):** a warm greeting + 3–4 suggestion chips seeded from zuzuu's faculties (e.g. recent actions, a runbook, "review pending proposals"). This makes first-run inviting and quietly advertises the faculty surface — directly serving the Duolingo-progression / game-like goal.
- **Adopt the streaming Stop affordance (ChatGPT):** send button morphs to a stop square while the host runs. Essential for a long-running coding agent so the user always feels in control.
- **Avoid** Cursor's per-model run-count multipliers (1x/2x/4x) and the "Use Multiple Models" complexity — that is power-user clutter that fights the "uncomplicated" goal. zuzuu picks one host per turn.

## Standouts

1. **[Replit — agent session with tool receipts, checkpoint + Rollback, paused banner](https://mobbin.com/screens/76782202-de59-4f09-9147-0f7082aa6e33)** — the single best analog for zuzuu's center pane: it proves a coding agent session can read as a calm conversation of one-line receipts and cards while the terminal lives in a separate tab. The "Rollback to here" checkpoint is a direct visual for zuzuu's generation rollback.
2. **[Cursor — host/model picker in composer with selected-state summary](https://mobbin.com/screens/5cfd4022-fd5e-4372-b240-2e37754159fc)** — the cleanest template for zuzuu's host picker: active selection summarized as a quiet token in the bar, full switcher on click.
3. **[Lindy — green-check agent step checklist with Browser/Terminal tabs](https://mobbin.com/screens/9f4affd5-f387-4149-860e-95c83f9bbba5)** — the most game-like, legible rendering of multi-step agent work; the tabbed work-pane confirms the "narrative in the column, raw output in a tab" split zuzuu should adopt.
