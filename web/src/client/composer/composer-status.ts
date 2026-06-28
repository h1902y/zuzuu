// composer/composer-status.ts — the composer's send-state label (Ready · Working · N
// queued). Pure → tested; the footer renders it beside a status dot. Kept apart from
// the timing logic in composer-logic.ts: this is purely what the user SEES, so the
// footer .tsx stays thin.
export interface ComposerStatus {
  label: string;
  /** the agent is producing output — a send will queue, and Interrupt is relevant. */
  busy: boolean;
}

export function composerStatus(ready: boolean, queued: number): ComposerStatus {
  if (!ready) return { label: queued > 0 ? `Working · ${queued} queued` : "Working…", busy: true };
  if (queued > 0) return { label: `${queued} queued`, busy: false };
  return { label: "Ready", busy: false };
}
