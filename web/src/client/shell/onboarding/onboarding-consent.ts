// shell/onboarding/onboarding-consent.ts — durable persistence of the consent record
// (U3 / PR5). Uses localStorage, NOT sessionStorage: the doc review flagged that a
// per-tab store lets deriveState re-march a returning user (fresh tab) through a step
// they already declined. localStorage survives reload and a new tab for the same origin.
// Keyed by workspace path so each project's onboarding progress is independent. Guarded
// for environments without localStorage (tests/SSR) — all failures are non-fatal.
import type { ConsentRecord } from "./onboarding-state.js";

const key = (workspace: string) => `zz-onboarding-consent:${workspace}`;

export function loadConsent(workspace: string): ConsentRecord {
  try {
    const raw = globalThis.localStorage?.getItem(key(workspace));
    return raw ? (JSON.parse(raw) as ConsentRecord) : {};
  } catch {
    return {};
  }
}

export function saveConsent(workspace: string, record: ConsentRecord): void {
  try {
    globalThis.localStorage?.setItem(key(workspace), JSON.stringify(record));
  } catch {
    /* non-fatal — onboarding still works in-memory this session */
  }
}
