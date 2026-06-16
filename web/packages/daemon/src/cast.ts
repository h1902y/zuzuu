// asciicast body assembly (Wave D, L5 — seekable/navigable replay).
//
// A recording is an asciicast v2 stream: a header line + body lines, each
// `[time, code, data]`. Wave D interleaves command-boundary **markers**
// (`"m"` events) so asciinema-player (already used in CastView) renders a
// navigable chapter on its seek bar — jump straight to the Nth command instead
// of scrubbing blind. Pure + unit-tested; the daemon Session feeds it the
// captured output events + the marks it collected from OSC 133.

export type CastEvent = [number, "o" | "r", string];
export type CastMark = { t: number; label: string };
export type CastLine = [number, "o" | "r" | "m", string];

/**
 * Merge output/resize events with marks into one time-ordered body. Stable on
 * ties: a mark at the same timestamp as an event sorts AFTER it (the marker
 * belongs to the output that just arrived). Times are rounded to ms.
 */
export function castBody(events: CastEvent[], marks: CastMark[] = []): CastLine[] {
  const round = (t: number) => Math.round(t * 1000) / 1000;
  const lines: CastLine[] = [
    ...events.map((e) => [round(e[0]), e[1], e[2]] as CastLine),
    ...marks.map((m) => [round(m.t), "m", m.label] as CastLine),
  ];
  // Array.prototype.sort is stable in V8 → events keep priority over equal-t marks.
  lines.sort((a, b) => a[0] - b[0]);
  return lines;
}
