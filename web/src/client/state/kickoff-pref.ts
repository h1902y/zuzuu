// state/kickoff-pref.ts — the "auto session-start check" preference (the Settings
// toggle). When on (the default), starting an agent session auto-delivers the kickoff
// (readiness brief + orientation) as its first turn; off skips it entirely. Persisted
// to localStorage like the theme preference; read non-reactively by store.open.
import { create } from "zustand";

const KEY = "zz-kickoff";

/** Default ON — only an explicit "off" disables it. */
function load(): boolean {
  try { return localStorage.getItem(KEY) !== "off"; } catch { return true; }
}

interface KickoffPrefState {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
}

export const useKickoffPref = create<KickoffPrefState>((set) => ({
  enabled: load(),
  setEnabled: (enabled) => {
    try { localStorage.setItem(KEY, enabled ? "on" : "off"); } catch { /* ignore */ }
    set({ enabled });
  },
}));
