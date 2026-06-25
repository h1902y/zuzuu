// shell/empty-copy.ts — the teaching empty-state copy registry (P2.6). One place for
// the "empty as invitation" lines, so every surface composes the SAME calm
// EmptyState instead of an ad-hoc muted string. Pure → tested; the .tsx render it.

export interface EmptyCopy {
  title: string;
  hint: string;
}

export const EMPTY_COPY = {
  "grid-empty": { title: "No notes yet", hint: "zuzuu proposes notes as you work — approve them at the gate and they land here." },
  "grid-filter": { title: "No matching notes", hint: "Nothing matches your filter. Clear it to see the whole table." },
  "tables": { title: "No tables yet", hint: "Tables materialize as the loop proposes the first note for each module." },
  "sessions": { title: "No sessions yet", hint: "Start a session to begin — the brain grows from what you do." },
  "review": { title: "All caught up", hint: "No proposals waiting. New ones arrive as you work." },
} as const;

export type EmptyKey = keyof typeof EMPTY_COPY;

/** Resolve the copy for a known empty surface. */
export function emptyCopy(key: EmptyKey): EmptyCopy {
  return EMPTY_COPY[key];
}
