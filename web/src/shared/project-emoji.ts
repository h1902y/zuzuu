// shared/project-emoji.ts — a per-project emoji. Every project gets one with ZERO
// storage: a deterministic "random" default derived from its path (stable across
// reloads + machines). An explicit user choice (persisted in the daemon config) wins.
// Shared so the daemon computes the default for the list and the client renders the
// picker grid from the same palette. Pure → unit-tested.

/** The curated picker palette (single, broadly-rendering glyphs). */
export const PROJECT_EMOJIS = [
  "🚀", "🛠️", "📦", "🧩", "🌱", "🔮", "⚡", "🎯",
  "🧠", "📚", "🗂️", "🛰️", "🦊", "🐙", "🐢", "🦉",
  "🌵", "🍂", "🔥", "💎", "🎨", "🧪", "🌀", "⛺",
  "🧭", "🪐", "🏗️", "🔭", "📐", "🧱", "🪄", "🦄",
  "🐝", "🌊", "🍁", "🎲", "🧶", "🪁", "🛎️", "📎",
  "🗝️", "🪵", "🌸", "🍄", "🐧", "🦕", "☕", "🎸",
] as const;

/** A small, stable string hash (djb2) — same answer every run, no Math.random. */
function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 33) + s.charCodeAt(i)) >>> 0;
  return h;
}

/** A stable "random" default emoji for a project, derived from its path. */
export function defaultEmoji(path: string): string {
  return PROJECT_EMOJIS[hash(path || "") % PROJECT_EMOJIS.length]!;
}

/** The emoji to show: the user's override if set, else the deterministic default. */
export function emojiForProject(path: string, override?: string | null): string {
  return override && override.trim() ? override : defaultEmoji(path);
}
