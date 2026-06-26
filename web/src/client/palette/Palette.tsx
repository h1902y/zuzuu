// src/client/palette/Palette.tsx — the command-palette shell.
//
// The open/closed gate; the cmdk-bearing body (PaletteBody) is lazy-loaded on
// first open, keeping cmdk out of the main bundle. NOTE: the global ⌘P/⌘K hotkey
// was removed pending the omnibar + keyboard-support rebuild — nothing opens the
// palette today, so it stays inert until the omnibar drives it.

import { lazy, Suspense } from "react";
import { useWorld } from "../shell/world-state.js";

const PaletteBody = lazy(() => import("./PaletteBody.js"));

export function Palette() {
  const paletteOpen = useWorld((s) => s.paletteOpen);

  if (!paletteOpen) return null;
  return (
    <Suspense fallback={null}>
      <PaletteBody />
    </Suspense>
  );
}
