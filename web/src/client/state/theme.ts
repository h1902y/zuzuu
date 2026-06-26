// state/theme.ts — the warm dual-theme preference. "system" follows the OS; an
// explicit light/dark choice persists (localStorage) and is applied to <html
// data-theme> (the [data-theme] blocks in index.css swap the ramp). The pre-paint
// script in index.html mirrors this resolution so there's no flash on load.
import { create } from "zustand";

export type ThemePref = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const KEY = "zz-theme";
const ORDER: ThemePref[] = ["light", "dark", "system"];

/** Resolve a preference to a concrete theme given the OS's dark setting. Pure. */
export function resolveTheme(pref: ThemePref, systemDark: boolean): ResolvedTheme {
  if (pref === "system") return systemDark ? "dark" : "light";
  return pref;
}

/** The toggle cycle: light → dark → system → light. Pure. */
export function nextTheme(cur: ThemePref): ThemePref {
  return ORDER[(ORDER.indexOf(cur) + 1) % ORDER.length]!;
}

function systemDark(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
}

function loadPref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" || v === "system" ? v : "system";
  } catch { return "system"; }
}

function apply(pref: ThemePref): ResolvedTheme {
  const resolved = resolveTheme(pref, systemDark());
  if (typeof document !== "undefined") document.documentElement.dataset.theme = resolved;
  return resolved;
}

interface ThemeState {
  pref: ThemePref;
  resolved: ResolvedTheme;
  setTheme: (pref: ThemePref) => void;
  cycle: () => void;
}

export const useTheme = create<ThemeState>((set, get) => {
  const pref = loadPref();
  return {
    pref,
    resolved: apply(pref),
    setTheme: (pref) => {
      try { localStorage.setItem(KEY, pref); } catch { /* ignore */ }
      set({ pref, resolved: apply(pref) });
    },
    cycle: () => get().setTheme(nextTheme(get().pref)),
  };
});
