# zuzuu's canonical design system — BORROWED (the bible)

This directory is **vendored, not authored here.** It is zuzuu's canonical design system,
borrowed from the **studio** repo's design-sync bundle (the editorial-brutalist
"The Bottom Line" / `window.ZuzuuDS`). It is the single source of truth for zuzuu's look —
**the bible.** Do not hand-edit these files; they are compiled output. To change the DS,
change it upstream in studio and re-pull.

## Provenance

| | |
|---|---|
| Source repo | `~/Documents/studio` (its `ds-bundle/`, built by the `/design-sync` skill) |
| Studio's Claude Design project | `zuzuu studio — design system` (`bff4dc77-2f5e-40c9-9edd-653e56659e6a`) |
| Vendored version | `_ds_sync.json` `styleSha` = `5804fff5a5bb…` · 16 components |
| Pulled by | `scripts/borrow-ds.mjs` |

## Re-sync (re-pull from studio)

```sh
node scripts/borrow-ds.mjs                 # default source: ~/Documents/studio/ds-bundle
node scripts/borrow-ds.mjs <ds-bundle-dir> # or a clone elsewhere
```

It copies the consumable artifact only (leaves studio's design-tool scratch behind) and
prints the version it pulled. Commit the result; the `_ds_sync.json` `styleSha` records
which upstream build is vendored.

## What's here

A **compiled** bundle (the real shipped components, not source):

- `_ds_bundle.js` — an IIFE assigning every component to `window.ZuzuuDS.*`.
- `styles.css` → `@import`s `_ds_bundle.css` (component styles) + tokens/fonts. **Designs
  receive only this stylesheet's import closure** — load `styles.css`, not `_ds_bundle.css` directly.
- `components/landing/<Name>/` — per component: `<Name>.jsx` (a one-line re-export stub that
  reads `window.ZuzuuDS`), `<Name>.d.ts` (the API contract), `<Name>.prompt.md` (usage),
  `<Name>.html` (preview card).
- `_vendor/` (react/react-dom the preview cards load), `_preview/` (compiled previews),
  `_ds_sync.json` (version anchor), `README.md` (the DS's own conventions — read it).

Components (16): `Button` · `Badge` · `Tag` · `Overline` · `Wordmark` · `GridCell` ·
`Section` · `SectionHeading` · `Marquee` · `StatStrip` · `Hero` · `Statement` · `CardGrid` ·
`FeatureCard` · `StepCard` · `InkCTA`. Aesthetic: warm paper + ink + one orange accent
(+ functional teal), sharp corners, blueprint grids, monospace metadata. See `README.md`.

## Consuming it in zuzuu

The bundle is a browser global, not an ES package. Two ways to consume:

1. **Global script** — serve `styles.css` + `_ds_bundle.js` (e.g. from `web/public/`), then
   read components off `window.ZuzuuDS.*`. The `components/<Name>.jsx` stubs do exactly this.
2. **Typed adapter** *(to add during integration)* — a thin `index.ts` re-exporting
   `window.ZuzuuDS.*` typed against the `<Name>.d.ts` files, so the app imports
   `{ Hero, Section } from "<this dir>"`.

> **MARVIN status:** zuzuu's prior in-repo DS (`web/src/client/ds`, "MARVIN") is being
> **retired in favour of this borrowed DS.** It still backs the current workbench; migrate
> surfaces onto the bible incrementally rather than ripping MARVIN out at once.
