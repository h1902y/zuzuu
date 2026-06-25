// shell/peek-state.ts — the slide-over "peek the brain" state (U8 logic; the .tsx
// overlay renders it). Opening a peek must NOT change the stage selection — the
// terminal keeps streaming (R7). Pure reducer + tested.

export type PeekTarget =
  | { kind: "module"; id: string }
  | { kind: "row"; id: string; module: string };

export interface PeekState { open: boolean; target: PeekTarget | null }
export const initialPeek: PeekState = { open: false, target: null };

export type PeekAction = { type: "open"; target: PeekTarget } | { type: "dismiss" };

export function peekReducer(s: PeekState, a: PeekAction): PeekState {
  switch (a.type) {
    case "open": return { open: true, target: a.target };
    case "dismiss": return { open: false, target: null };
  }
  return s;
}
