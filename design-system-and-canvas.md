# zuzuagents — Design System & Agent Canvas (design spec)

> **Status:** design spec, brainstormed and converged 2026-06-02. Precedes the implementation plan.
> **Scope:** the design-system foundation + the **agent node** component + the **canvas** that arranges nodes into architectures.
> **Out of scope:** backend wiring, faculty editors' logic, non-canvas screens (auth, settings) — later specs.
> Related: [`agentic-platform-concept.md`](agentic-platform-concept.md) (the platform north-star).

## Context

zuzuagents is a platform for building/managing multi-agent systems where **each agent is a node**. The first build target is the *visual foundation*: a design system and the canvas on which agent nodes are arranged into architectures (hierarchy, pipeline). This spec captures the design decisions made in a brainstorming session so an implementation plan can be written from it.

---

## 1. Design-system foundation — *lift from Labs, don't reinvent*

Maximum brand cohesion with the zuzu family: inherit Zuzucodes Labs' design system **as-is**.

**Lift into zuzuagents** (from `~/Documents/zuzucodes/labs`):
- **Tokens** — `app/globals.css`: OKLCH palette (pale-rose bg / lemon primary / peach accent + the 6-hue pastel chip palette), radius scale, light/dark themes.
- **Fonts** — Poiret One (display) · Quicksand (body) · Arvo (UI) · Major Mono Display (logo).
- **Motion** — `lib/motion.ts` (fadeUp, stagger, etc.).
- **Primitives** — `components/ui/*`: Button, Input, Select, Tabs, Dialog, **Sheet**, Badge, Card, EmptyState, Tooltip, Separator, Switch, ScrollArea.
- **Stack** — Next.js 16 / React 19 / Tailwind v4 / CVA / Radix / Framer Motion; light-default + class-based dark mode.

All new zuzuagents components are built on top of this layer.

---

## 2. The agent node — *rounded-corner hexagon (signature component)*

- **Shape:** **flat-top hexagon with rounded ("circular") corners**, sticker-soft shadow, role-colored accent — rendered in Labs' bento language. Flat top/bottom faces give clean attach points for vertical edges and let rows stack neatly.
- **At rest (compact):** role glyph + agent name (truncated ~16 chars) + a status dot (top-right). The hexagon never carries rich detail.
- **On hover/expand:** one context line appears — `model · 🧠 <mem-tier> · N 🔧`.
- **On select:** opens the side panel (§4) holding the full editor. Detail lives there, not on the hex.

### Role variants
| Variant | When | Visual |
|---|---|---|
| **Leaf agent** | no dependents | lemon accent, ◆ glyph |
| **Supervisor** | has dependents (fans to next row) | peach accent, ⬡ glyph |
| **Root / entry** | tree root | subtle "start" marker, top of canvas |
| **Mirror** | alias of an agent that lives elsewhere (§3) | **ghosted / dashed-outline** hex, muted fill, **"↪ mirror"** badge |

### States (the full set the component must render; map to Labs semantic tokens)
`idle` · `selected` (primary focus ring) · `running` (pulsing ring) · **`paused-for-human`** (warning/amber ring + "waiting" badge — ties to the engine's `waitForEvent` gates) · `completed` (success/mint ✓) · `failed` (destructive/red ring) · `eval-flagged` (warning corner dot).

---

## 3. Mirror nodes — *sharing without a DAG*

The super→sub relation is strictly **1:N** (every node has exactly one parent), so the canvas is a clean tree. When a sub-agent must sit under a **second** super-node, the UI spawns a **mirror** instead of drawing a converging edge.

- **Semantics: alias of the same agent.** A mirror and its primary are the *same underlying agent entity* — same memory, tools, generation. Edit anywhere → every mirror reflects it. (Not a copy; not read-only.)
- **Subtree: collapsed reference, expandable.** A mirror shows just the agent by default; expanding reveals its dependents (also as mirrors). Keeps the tree clean, avoids duplicating large subtrees.
- **Visual:** ghosted dashed-outline hexagon + "↪ mirror" badge; clicking highlights / jumps to the primary node.
- **Creation:** "add dependent → reference an existing agent" (or drag an existing agent onto a new parent) creates a mirror under that parent.
- **Result:** an agent appears once as a **primary** and 0+ times as **mirrors**; all delegation edges remain uniform solid 1:N.

---

## 4. Node side panel — *the editor (Labs `Sheet`)*

Opens on node select; slides in from the right (grid reflow, not a floating modal). Tabs:

1. **Identity** — name, description, tags, role (derived).
2. **Memory** — attached memory entity + tier (L0 markdown → L3 +pgvector); read/write scope.
3. **Tools** — attached tools as chips, with pinned versions.
4. **Generation & Eval** — current generation tag, eval score/health, promote/rollback.

(Tab *content logic* is a later spec; this spec fixes the panel structure + the tab set.)

---

## 5. The canvas — *Zapier-elegant layered 1:N tree*

- **Single-rooted 1:N tree** per flow. Multiple flows live in the sidebar; one flow renders one tree.
- **Auto-arranged, top-down.** Root at top; each agent's dependents **fan onto the next row**; parent centered over its children. **No free-drag scatter** — positions are computed (pan/zoom + collapse/expand only).
- **Inline ⊕ add-dependent** below each node (and a top-bar "+ Agent" that adds to the root) → creates a child on the next row and opens its panel.
- **Edges:** uniform **solid 1:N** delegation, clean orthogonal routing (drop → across → drop). During a run, an animated pulse flows along active edges. (No reference/DAG edges — mirrors replace them.)
- **Chrome:** left **sidebar** (Agents/Flows · Memory · Tools · Evals) · **top bar** (flow name · Run · fit-to-screen) · pan/zoom · optional minimap.
- **Empty state:** a single "create your first agent" hexagon with a ⊕.

---

## 6. Tech substrate — *React Flow + auto-layout* (confirm at review)

**React Flow (xyflow)** for the canvas — provides pan/zoom, custom node + edge types, and handles out of the box. We register:
- a custom **`HexagonNode`** (renders the variants + states of §2–3),
- a custom **`DelegationEdge`**,
- and drive node positions with an **auto-layout pass** — **elkjs** or **dagre**, `direction: DOWN`, layered — so arrangement is automatic (Zapier-style), not free-drag. The strict 1:N tree makes this layout trivial and stable.

*Alternative considered:* hand-rolled SVG layout (as Flow Engine did). More control, much more work, no pan/zoom/interaction for free — **not recommended**.

---

## 7. Component inventory (this build's deliverable)

**New (zuzuagents):**
- `HexagonNode` (+ variants leaf/supervisor/root/mirror, + all states) · `StatusRing`/`StatusDot`
- `DelegationEdge` · `AddDependentButton` (⊕)
- `AgentCanvas` (React Flow wrapper + auto-layout) · `CanvasTopBar` · `CanvasSidebar` · `EmptyCanvasState`
- `NodeSidePanel` (Sheet) with `IdentityTab` · `MemoryTab` · `ToolsTab` · `GenerationEvalTab`

**Lifted (from Labs, ~as-is):** tokens/`globals.css`, fonts, `lib/motion.ts`, `components/ui/*` primitives.

---

## 8. Data shape the UI needs (projection, not the backend model)

```ts
type CanvasNode = {
  id: string            // canvas-node id (a primary or a mirror)
  agentId: string       // underlying agent entity (shared by mirrors)
  parentId: string | null
  isMirror: boolean
  role: 'root' | 'supervisor' | 'leaf' | 'mirror'   // derived from tree position + isMirror
  name: string
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'eval_flagged'
  model: string
  memory: { name: string; tier: 'L0'|'L1'|'L2'|'L3' } | null
  tools: string[]       // names; counts shown compact
  generation: string
  evalScore?: number
  collapsed: boolean     // for mirrors / large subtrees
}
```
Maps to the concept doc's first-class **Agent** entity + its M:N faculties; the canvas consumes a projection only.

---

## 9. Open questions (non-blocking)

- Confirm **React Flow + elkjs/dagre** as the substrate (the one item flagged in §6).
- Exact hexagon proportions / corner radius (visual tuning during build).
- Whether multiple independent roots in one workspace are ever needed (assumed: one flow = one root tree).
- Run-state pulse styling on edges (tune during build).

## 10. Verification

- A **states gallery** page renders every node variant × state (leaf/supervisor/root/mirror × idle/running/paused/completed/failed/eval-flagged) for visual QA.
- A **sample tree** (root → 3 supervisors → leaves, including one **mirror** of a shared sub-agent) renders and **auto-arranges cleanly** with no manual positioning.
- Side panel opens on select with all four tabs; ⊕ adds a dependent on the next row and the layout re-flows.
- Dark/light theme parity; all surfaces use lifted Labs tokens.
