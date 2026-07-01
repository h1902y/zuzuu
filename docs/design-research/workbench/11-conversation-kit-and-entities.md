# Conversation kit + entities — the ACP surface, defined against Vercel's Chat SDK

**Status:** design definition (feeds the U9 kit graduation on `feat/acp-onboarding-default`; informs the U7 session entity + the U8 composer). **Grounded in** Vercel **AI Elements** (`elements.ai-sdk.dev`, MIT), the **Chat SDK** template (`github.com/vercel/chatbot`, MIT), and the **AI SDK** `useChat`/`UIMessage` (Apache-2.0). **Anchored to** what zuzuu already ships: `web/src/client/shell/stage/acp-model.ts` (the `Block` fold), `AcpView.tsx`, the ACP DTOs in `#shared/rest.ts`, and the two session lanes (PTY `SessionInfo` + the ACP session).

The one-line thesis Vercel validates: **a message is an ordered list of typed *parts*, not a string** — dispatch-on-`type` rendering. zuzuu already does this (our `Block` union is a parts model folded from the ACP `session/update` stream). So this isn't a rewrite — it's *naming the model we have*, closing three real gaps Vercel exposes, and graduating the render into neon kit components.

---

## 1. Entity model

### 1.1 Session (unify the two lanes)

Today zuzuu has **two** session shapes that don't share a type: the PTY `SessionInfo` (terminal lane, git-branch-backed) and the ACP session (`{id, trace}`, adapter-backed). Vercel's `Chat` is one thread entity. Define a shared envelope, discriminated by **lane** — this is also what lets the SESSIONS nav (U7) list both:

```ts
interface Session {
  id: string;
  lane: "terminal" | "acp";       // the discriminant
  title: string;                   // "Claude Code 1" | derived; Chat SDK's chat.title
  host?: string;                   // "claude" | "codex" | … (agent sessions)
  createdAt: number;
  status: SessionStatus;           // §1.4
  // lane-specific detail hangs off here (branch for terminal; nothing extra for acp today)
}
```

Chat SDK adds `userId` + `visibility` — **out of scope** (single-user local workbench; revisit only for the cloud skin).

### 1.2 Turn — the missing grouping (a real gap Vercel exposes)

zuzuu's ACP conversation is a **flat `Block[]`**. Vercel groups blocks into role-aware **Messages** (`from: user | assistant`). We have **no user-side message** — the user's own prompt is sent but never rendered as a conversation entry, so the transcript reads one-sided. **Adopt a Turn grouping:**

```ts
interface Turn {
  role: "user" | "agent";
  parts: Part[];        // §1.3 — user turn = one text part; agent turn = the folded blocks
  status?: PartStatus;  // streaming | done (agent turns)
  usage?: Usage;        // token counts at turn end
}
```

`AcpView`/`acp-model` fold agent `session/update`s into an **agent** Turn; the composer's submit pushes a **user** Turn. This is the single most valuable borrowing — it makes the surface a real conversation, not an agent-only log.

### 1.3 Part union — map our `Block` → Vercel's parts, name the gaps

Our `Block` union IS a parts union. The mapping (⭐ = zuzuu-specific, no Vercel equivalent — keep):

| zuzuu `Block` | Vercel part | Notes / graduation |
|---|---|---|
| `agent` (text) | `TextUIPart` `{text, state}` | add a **`state: "streaming"\|"done"`** field (we coalesce chunks but don't mark done) → drives the streaming cursor |
| `thought` | `ReasoningUIPart` `{text, state}` | graduate to a **collapsible** Reasoning (auto-collapse when the turn ends) |
| `tool` (+`diffs`) | `ToolUIPart` `{toolCallId, input, output, state}` | align `status` → the **4-state** lifecycle (§1.4); we already carry inline diffs (richer than Vercel) |
| `plan` | `Plan`/`Task` | 1:1 |
| `permission` ⭐ | closest: `Confirmation` (requires user verification) | our human-gate Allow/Deny — richer (carries the guardrail reason + the "unavailable" degraded state) |
| `gate` ⭐ | — | the guardrail decision (deny/allow-by-rule / ⚠ unavailable). The moat, made visible. No Vercel analogue. |
| `turn` | `StepStartUIPart` `{type:"step-start"}` | our turn divider ≈ a boundary part; consider carrying `turnIndex` for per-turn collapse |
| `error` | (Vercel: a *status*, not a part) | keep as a block — distinct from the connection-drop error |

**Gaps to add later** (Vercel has, we don't — surface them when `observe` produces them): `source-url` / `source-document` (+ `InlineCitation`), `file`/attachment, `data-<name>` (custom streaming data — a natural home for live `observe` signals). Not needed for the default-flip; note them so they're designed-for, not bolted-on.

### 1.4 Status — one 4-state enum, not scattered booleans

Vercel's `useChat.status: submitted | streaming | ready | error` is a *single* source that drives the submit button, the reasoning pulse, and the text-part cursor. Our `acp-model` has `connecting | ready | working | idle | error` — reconcile to a shared shape, keeping `connecting` (zuzuu-specific: the adapter spawn/handshake beat) and mapping `working ↔ streaming`, `idle ↔ ready`:

```ts
type SessionStatus = "connecting" | "submitted" | "streaming" | "idle" | "error";
type PartStatus = "streaming" | "done";
type ToolState = "input-streaming" | "input-available" | "output-available" | "output-error";
```

This one enum unifies the stage header, the composer submit button (§3), and the part cursors — Vercel's key discipline.

### 1.5 Versioning parallel (validation, not new work)

Chat SDK versions `Document`/`Artifact` by a **composite PK `(id, createdAt)`** — every save appends a row; rollback = point at an earlier `createdAt`. That is *structurally identical* to zuzuu's **per-module generation** model (append + pointer-flip). The two designs validate each other; when the workbench grows an Artifact viewer, reuse the generation pattern rather than inventing a second one.

---

## 2. Component kit (the U9 neon graduation targets)

Graduate `AcpView`'s inline `BlockView` into named, token-bound neon kit components, one per part-renderer. Container/leaf split follows AI Elements:

| zuzuu neon component | AI Elements analogue | Role | Renders |
|---|---|---|---|
| `Conversation` | Conversation | container | the scroll + turn list (our `AcpView` shell) |
| `Turn` (`Message`) | Message (`from`) | container | one role-aware entry (**new** — §1.2) |
| `Markdown` | MessageResponse (Streamdown) | leaf | agent text with streaming-safe markdown (U9 explicitly lists this) |
| `Reasoning` | Reasoning + trigger/content | container | collapsible thought, auto-collapse on turn end |
| `ToolCallCard` | Tool + Header/Input/Output | container | 4-state tool call; collapsible input/output; inline `Diff` |
| `Diff` | (our own; richer than theirs) | leaf | inline unified diff for write-tools |
| `Plan` | Plan / Task | leaf | the step list |
| `PermissionCard` | Confirmation | leaf | the human gate — Allow/Deny + reason + ⚠ guardrail-unavailable |
| `GateBadge` ⭐ | — | leaf | the rule decision line (deny/allow-by-rule) |
| `TurnDivider` | (step-start) | leaf | the `— end_turn —` separator + usage |

Each stays token-bound (the neon token names) + composes ds primitives → passes the `ds-no-inline` guard, exactly as the current `AcpView` already does. Reference `feat/acp-kit-graduation`'s `conversation.tsx`/`markdown-impl.tsx` for *shape only* — re-implement on neon tokens (KTD8).

**Defer** (design-for, don't build): `Sources`/`InlineCitation`, `Attachments`, `Artifact`/`CodeBlock`/`FileTree`/`Sandbox` (Vercel's "Code" category) — these arrive when observe/act surface those part types.

---

## 3. Input / composer

Our composer today: a `textarea` + a `Send` button, Enter-to-send, disabled-while-working. Vercel's `PromptInput` is a small suite — graduate toward it, but only the parts that earn their place now:

- **`PromptInput`** (form) → **`PromptInputTextarea`** (auto-resize, Enter=submit / Shift+Enter=newline — we already do this) → **`PromptInputFooter`** (a toolbar row) → **`PromptInputSubmit`**.
- **Status-aware submit (the real gap):** Vercel's submit button reads `status` and flips **send ↔ stop ↔ spinner**. We ship *send* only — but `AcpConnection` already supports `{type:"cancel"}` and `AcpSession.cancel()` exists on the server. So a **Stop** affordance while `streaming` is a free, high-value add: wire the submit button to `status` (send when idle, stop→cancel when streaming). **Do this in U9.**
- **Footer as an extension point:** leave room for a `PromptInputSelect` (model/tool picker) and `PromptInputActionMenu` (attachments / screenshot) — **deferred**, but the footer layout should anticipate them so they're not a re-layout later.
- **Suggestions** (preset prompts) — a cheap onboarding nicety for an empty conversation ("Explain this repo", "Find the failing test"). Deferred; noted.

---

## 4. What to borrow now vs. defer

**Now (fold into U9):**
1. **Turn grouping** with `role` (user + agent) — the transcript becomes two-sided (§1.2).
2. **4-state status enum** unifying header + composer + part cursors (§1.4).
3. **Status-aware submit with Stop** — `cancel()` is already wired server+client (§3).
4. **The named neon kit** (§2), each a part-renderer.
5. **`agent` text `state` + collapsible `Reasoning`** — small, high-polish.

**Design-for, defer:** sources/citations, attachments/files, model/tool pickers, artifacts/code category, suggestions. Each is a new **part type** + a new kit component — the parts model makes them additive, not structural.

**Validated, no action:** the parts-not-strings architecture (we already have it); the versioning-by-append parallel with generations.

---

## Sources

AI Elements — `https://elements.ai-sdk.dev/` (MIT). Chat SDK template — `https://github.com/vercel/chatbot` (MIT), `chatbot.ai-sdk.dev/docs/architecture`. AI SDK `useChat` + `UIMessage` — `https://ai-sdk.dev/` (Apache-2.0). Extracted 2026-07-01 via a live-docs research pass; component props, the `UIMessagePart` union, and the Chat/Message/Vote/Document schema were read from the real docs + `lib/db/schema.ts`.
