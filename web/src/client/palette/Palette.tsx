// src/client/palette/Palette.tsx — the ⌘P / ⌘K command-palette shell.
//
// Owns the global hotkey + the open/closed gate — both cheap, so they stay eager
// and ⌘P always responds. The cmdk-bearing body (PaletteBody) is lazy-loaded on
// first open, keeping cmdk out of the main bundle.

import { lazy, Suspense, useEffect } from "react";
import { usePanel } from "../state/panel.js";

const PaletteBody = lazy(() => import("./PaletteBody.js"));

export function Palette() {
  const paletteOpen = usePanel((s) => s.paletteOpen);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "p" || e.key === "k")) {
        e.preventDefault();
        const { paletteOpen: o, setPalette } = usePanel.getState();
        setPalette(!o);
      } else if (e.key === "Escape") usePanel.getState().setPalette(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!paletteOpen) return null;
  return (
    <Suspense fallback={null}>
      <PaletteBody />
    </Suspense>
  );
}
