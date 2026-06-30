# Blueprint image library — build state & resume note

**Status (2026-06-29): pipeline proven end-to-end, 1 of ~12 images done. Paused — resume next session.**

Inspired by every.to's consistent house art-direction (a reusable "prompt library" → one cover per article + a unified look). Goal: a clean, neat image set played across the **playbook (blog)** and the **landing** so neither is text-heavy. Art direction chosen by the user: **"Clean blueprint line-art."**

## How images are generated (the method — settled)

The Gemini **API** key in `.env` (`GEMINI=…`) is **free-tier and cannot generate images** — `gemini-3-pro-image` returns `429 limit: 0`; free Flash image models 429/404 too. Needs billing enabled to use the API path.

**So we generate via the free consumer Gemini web app instead**, driven through the existing logged-in Chrome tab (claude-in-chrome MCP, single-tab rule):
1. `gemini.google.com/app` (logged in as Harshit, "Pro" model selected) — it generates images **free**.
2. Type the prompt (base style + concept) → send → wait ~30–60s for "Creating your image…".
3. Click the image's **download** icon (top-right) → "Downloading full size…" → lands in `~/Downloads/Gemini_Generated_Image_*.png` (full-size, ~2528×1696 PNG, ~8 MB).
4. `cp` into `public/images/raw/<name>.png`, then optimize → `public/images/library/<name>.webp`.

**Decisions made:**
- **No Playwright bot.** A standalone script needs stored Google cookies, breaks on DOM churn, and trips bot-detection/rate-limits. Driving the existing session is better for a one-time library AND lets us QA/re-roll each result. For any *ongoing* generation later (cover per new post), use the **API with billing** — `scripts/` already has the optimizer; the API gen script lived in the session scratchpad.
- **Watch for rate-limits** if firing many generations back-to-back on the free tier; space them out or enable API billing for the remainder.
- Gemini sometimes adds a faint `✦` mark bottom-right → strip with `--crop-bottom` in the optimizer.

## Optimize step

`scripts/optimize-image.mjs` (uses the project's `sharp` 0.34.5). 8 MB PNG → ~190 KB WebP.
```bash
node scripts/optimize-image.mjs public/images/raw/<name>.png public/images/library/<name>.webp <width>
# covers/landscape → width 1600 ; tier squares → width 1000 ; add --crop-bottom=40 to drop the ✦ mark
```

## Base style prompt (apply to every image)

> **⚠️ ART DIRECTION CHANGED AGAIN 2026-06-30 (pm) — the site rebranded to dark + neon (mint/lavender
> + red/cyan chromatic-aberration glitch, from the z.png logo). Covers move from WARM gold to a COOL
> palette.** The two earlier recipes (off-white blueprint; warm gold engraving) are history.

**Current base prompt (COOL + chromatic — matches the dark+neon brand):**

> Generate an image — **wide 3:2 landscape** [or **1:1 square** for tiles], absolutely no text, letters, numbers, or logos anywhere. Style: **fine-line engraving on a deep near-black ground** — crisp luminous **silver-white linework**, premium and digital, generous black negative space, calm. Add a **subtle chromatic-aberration / RGB-split** on some edges (faint **red** and **cyan** offset, like CRT/print misregistration — restrained, not noisy). Cool palette only: near-black ground, silver-white lines, glowing **mint (#C2FFE1)** and soft **lavender (#D8C7FA)** accents, with **one** vivid **cyan (#00FFFF)** or **red (#FF0000)** highlight. **No warm gold, amber, or orange anywhere.** Subject: «CONCEPT».

Ties covers to the brand: dark base, mint/lavender accents, the signature red/cyan chromatic split (subtle, in-image).

_Superseded:_ (1) off-white blueprint ink; (2) warm **gold engraving + orange/teal** — the first 4 covers (`whatsapp-ai-automation`, `ai-inside-sales-automation`, `ai-proposals-and-quotes`, `ai-client-onboarding`) were made in the gold style and **must be regenerated** in the cool recipe above.

## Cover composition spec — LOCKED 2026-06-30 (the "Gilded Mechanism" series)

Every playbook cover follows this so the set reads as one designed series. Style + composition are
fixed; only the per-cover objects vary.

**Constants (every cover):**
- 3:2 landscape, deep near-black ground. **No border/frame.**
- **Edge-safe:** outer ~12% on all four sides stays **blank near-black** — nothing important near the
  edges. (So the bottom-right ✦ lands in dead space → a uniform crop removes it with zero content loss.)
- Lines: warm **gold / brass / champagne** fine-line engraving, **medium density** (calm, not busy).
- **Exactly ONE cool glow** — iridescent **mint→cyan→lavender** — the concept's hero, **~⅓ frame
  height**, **center / center-left**, consistent size, with a subtle **red/cyan chromatic edge**. It is
  the only saturated light; supporting accents stay faint. **No warm orange.**
- Subtle red/cyan chromatic-aberration on a few line edges. Generous negative space (esp. top + margins).
- Must read at BOTH small hub-card thumbnail and large post-hero size → one bold focal glow + calm space.
- Gold lines are a deliberate **warm "neutral"** (outside the strict cool brand palette); the **cool glow
  is the on-brand accent** that ties covers to the dark+neon brand. Intentional exception.
- The **hand** (gold engraved, entering top-left) appears **only in WhatsApp + Proposals** — not forced
  into the others. Recurring glue = the glow + gold engraving + chromatic, not the hand.

**Canonical prompt template** (fill «CONCEPT»):
> Generate an image — wide 3:2 landscape, absolutely no text/letters/numbers/logos, and **no border or
> frame** (keep the outer ~12% on all sides blank near-black, nothing important near the edges). Style:
> fine-line engraving on a deep near-black ground — crisp luminous linework in warm **golden** shades
> (antique gold, brass, champagne), premium, digital, calm, **medium density**, generous black negative
> space. Subtle chromatic-aberration / RGB-split on a few edges (faint red + cyan offset, restrained).
> Exactly **one** cool iridescent glow — **mint→cyan→lavender** — as the single hero focal element,
> ~one-third of the frame height, center / center-left, with a subtle red/cyan chromatic edge; the only
> saturated light. No warm orange. Subject: «CONCEPT».

**Per-cover objects:**
| Slug | «CONCEPT» |
|---|---|
| `whatsapp-ai-automation` | a gold-engraved **hand** (top-left) lowering the cool-glowing **chat bubble** (center-left) toward a cluster of gold gears in the lower area |
| `ai-inside-sales-automation` | a low row of gold-engraved **contact/envelope cards**; one unbroken cool-glowing **thread** weaves through them, brightest at one node (no hand) |
| `ai-proposals-and-quotes` | a gold **hand** (top-left) with a **pen whose tip is the cool glow**, drawing a gold document assembling from blocks (center-right); the price/signature line glows cool |
| `ai-client-onboarding` | gold **tangled filaments** (lower-left) resolving into one clean cool-glowing **waypoint path** sweeping center-right (no hand) |
| `ai-support-shared-inbox` | a gold **funnel** with many gold **envelopes** feeding in; a few **escalate as a cool glow** rising toward a gold human silhouette (no hand) |
| `ai-delivery-reporting` | gold rising **line-graphs / orbital rings** (lower-right); one curve **peaks as a cool-glowing node** (no hand) |

**Optimize:** `node scripts/optimize-image.mjs raw/<slug>.png library/<slug>.webp 1600 --crop-right=280`
(blank edges make the crop lossless). Reuse-of-filename cache: clear `.next/cache/images` + restart dev once after the batch.

## Operational gotchas (learned 2026-06-30 — read before generating)

- **Dev server runs on `:3210`, NOT `:3000`.** Port 3000 is held by a background **Hermes
  WhatsApp bridge** (`~/.hermes/hermes-agent/scripts/whatsapp-bridge/bridge.js --port 3000`) — a
  user service; **do not kill it.** Start Next with `npm run dev -- -p 3210`. If you kill/restart a
  dev server that's on 3000, Hermes grabs the port and you'll get an Express "Cannot GET /playbook".
- **Name each cover after its post slug** — e.g. `whatsapp-ai-automation.webp` (not `whatsapp-ai`).
  Clean 1:1 mapping, and it sidesteps the cache trap below.
- **next/image caches optimized output keyed by the source path, and the browser pins it hard.**
  If you **overwrite an existing cover filename**, the dev server AND the browser keep serving the
  OLD bytes (survives `rm -rf .next/cache/images`, dev restart, even Cmd+Shift+R via automation).
  The clean fix is **a fresh filename** (new URL → never cached) — which the slug convention gives
  you for free. **Do NOT** use a `?v=` query to bust it: Next 16 rejects query strings on local
  images unless you add `images.localPatterns`, and a scoped `localPatterns` then 400s every *other*
  local image (logo, icons). Not worth it — just rename.
- **✦ mark removal:** the Gemini mark sits ~200px in from the bottom-right corner (not flush), so a
  bottom-crop misses it. Use **`--crop-right=280`** (added to the optimizer) — the subject is
  left-of-center so the right edge is safe to trim.

## Manifest (target ~12 images)

| Done | Name | Aspect | Concept | Placement |
|---|---|---|---|---|
| ✅ | `whatsapp-ai-automation` | ~3:2 (1600×1207, right-cropped) | **dark-luminous (new style):** finely etched gold hand lowering a glowing-orange chat bubble onto copper gears, guilloché black ground | "WhatsApp AI" playbook cover — wired + verified live. `--crop-right=280` |
| ✅ | `ai-inside-sales-automation` | ~3:2 | glowing-orange thread weaving unbroken through a row of gold contact/envelope cards, one teal | inside-sales cover — wired |
| ✅ | `ai-proposals-and-quotes` | ~3:2 | etched hand + glowing pen assembling a doc from ornate gold blocks, price line orange | proposals cover — wired |
| ✅ | `ai-client-onboarding` | ~3:2 | tangle of gold filaments resolving into a clean path with orange waypoints + teal tail | onboarding cover — wired |
| ☐ | `ai-support-shared-inbox` | 3:2 | swarm of etched envelopes funnelling; most gold, a few escalating orange to a human silhouette | shared-inbox cover |
| ☐ | `ai-delivery-reporting` | 3:2 | constellation of etched line-graphs/orbits rising, one curve orange, a node teal | delivery-reporting cover |
| ☐ | `diagnostic` | 3:2 | magnifying glass over a tangle of workflow lines/nodes, one node glows orange (highest-value automation) | §02 "The diagnostic" |
| ☐ | `tier-diy` | 1:1 | person at a blueprint workbench assembling a small machine from schematic kit parts; one tool glows orange | §03 "How we work" — DIY card (~500px) |
| ☐ | `tier-dwy` | 1:1 | two hands co-building the same machine on the workbench (co-build) | §03 — Done-with-you card |
| ☐ | `tier-dfy` | 1:1 | the finished machine running on its own, an orange status node lit (embedded team runs it) | §03 — Done-for-you card |
| ☐ | `compare` | 3:2/16:9 | blueprint comparison motif (e.g. four schematic columns, one resolved in orange) | §03 "How we compare" flank (replaces bare white raster) |

## Wiring still to build (code)

- `components/landing` (or `playbook`) **`CoverImage`** — `next/image` + sharp 0.25rem corners + L-bracket ticks (`.tbl-ticks`) + a paper-duotone unify filter so every image reads as one set.
- `cover` field on `PlaybookMeta` (`content/playbook/registry`) + render in `PostCard` thumbnail and the post hero.
- `image` slot on the `Tier` type / `TierCard` (square, ~500px).
- §02 diagnostic image + §03 comparison flank in `app/page.tsx`.

## Open question (was being asked when paused)

How to run the rest: **(a) full set now**, **(b) batches of 3 with review**, or **(c) wire this one first as live proof**. User chose to **stop here and continue next session** — so re-confirm this when resuming.

## Files touched this session
- `public/images/raw/whatsapp-ai.png` (source, 2528×1696)
- `public/images/library/whatsapp-ai.webp` (1600×1073, 192 KB)
- `scripts/optimize-image.mjs` (durable optimizer)
- `docs/image-library.md` (this note)

Nothing committed or deployed — all local working-tree only.
