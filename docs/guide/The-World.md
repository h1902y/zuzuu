# The World — your project as a living map

`zz host web` opens the workbench; the **World** is its map surface: every note a dot, every module an island, every relation an edge — and every pending agent proposal a **ghost** waiting for your yes.

*(screenshot: docs/assets/world-vault.png — the 277-note personal vault; see [the recipe](Recipe-Personal-Vault))*

## How to read it

- **Islands are modules.** A two-level physics simulation keeps them apart: each module is a body with its own gravity; modules repel, collide on their real island radius, and modules that share many cross-links sit closer together (the affinity is computed from your actual relations).
- **Dots are notes**, sized subtly by connectedness, colored by module (the palette is derived from your module names — nothing is hardcoded).
- **Dotted rings + name chips** bound each island. **Drag a chip** to move the whole island (the layout persists); **click it** to open the module.
- **Zoom** is semantic: far out you see the archipelago and hub labels; closer, every label; click any node and its record opens alongside.

## The moat, rendered

When an agent stages a `create` proposal, a **dashed, pulsing ghost node** appears orbiting its module — the row that *wants* to exist. Click it to open the review gate. Approve, and the ghost solidifies into a real node; reject, and it dissolves. Nothing becomes solid without you.

This is live: the daemon watches the brain's surfaces (`/ws/zuzuu`) and pushes changes as they land — an agent staging a proposal mid-conversation appears in the map within a beat, no refresh.

## Two projections, one space

A module is ONE thing seen two ways: the **Map** shows it as an island, the **Table** as rows — the table is what an island crystallizes into when you get close enough.

- The module stage carries a segmented **Table⇄Map** toggle; **`T`** flips it in place. From the palette: `>table` / `>map` (they act on the module in context — a focused note counts).
- **The filter is the lens, and it rides both projections.** Filter the table, switch to Map, and the same subset stays lit while everything else recedes — a **spotlight**, with a chip row above the map naming it (and clearing it). Switch back: filter and scroll position are exactly where you left them. (The map mirrors title/id text matches and the type axis; a body-only FTS match lights in the table but not the map — the graph doesn't carry bodies.)
- **The crystallize gesture:** dive deep into a single island (zoom in until it fills the view) and a quiet affordance appears — *open as table — T*. Zooming is never hijacked; the island just offers its other form.

## The data underneath

The map reads one document: `zz graph --json` — every note as an addr-keyed node (`module:id`), every resolved relation as a link, degrees computed. Ride any frontmatter columns along with `--props`:

```bash
zz graph                                   # summary: node/link counts
zz graph --json --props definition,status  # the full document, for tooling
```

The workbench fetches the same thing through the daemon (`GET /api/zuzuu/graph?props=…` — see [Daemon & API](Daemon-API)); no frontend reads the index directly.

## Keyboard

- `⌘K` — the palette (find anything, jump anywhere)
- `R` — toggle the review gate overlay
- `T` — flip the module's Table⇄Map projection (and crystallize a deep-zoomed island)
- Click node → record · click chip → module · click ghost → review
