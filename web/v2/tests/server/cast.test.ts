// Wave D (L5): the pure asciicast body assembler — interleaves command-boundary
// `m` markers with output events in time order so the player gets navigable
// chapters. Pure logic; the daemon Session wires the marks from OSC 133.
import { describe, it, expect } from "vitest";
import { castBody, type CastEvent, type CastMark } from "../../src/server/cast.js";

describe("castBody", () => {
  it("returns events in time order when there are no marks", () => {
    const events: CastEvent[] = [[0.1, "o", "a"], [0.5, "o", "b"]];
    expect(castBody(events)).toEqual([[0.1, "o", "a"], [0.5, "o", "b"]]);
  });

  it("interleaves marks among events by timestamp", () => {
    const events: CastEvent[] = [[0.1, "o", "a"], [1.0, "o", "b"], [2.0, "o", "c"]];
    const marks: CastMark[] = [{ t: 0.9, label: "1" }, { t: 1.5, label: "2" }];
    expect(castBody(events, marks)).toEqual([
      [0.1, "o", "a"],
      [0.9, "m", "1"],
      [1.0, "o", "b"],
      [1.5, "m", "2"],
      [2.0, "o", "c"],
    ]);
  });

  it("places a mark at the same timestamp AFTER the event (stable)", () => {
    const events: CastEvent[] = [[1.0, "o", "out"]];
    const marks: CastMark[] = [{ t: 1.0, label: "cmd" }];
    expect(castBody(events, marks)).toEqual([
      [1.0, "o", "out"],
      [1.0, "m", "cmd"],
    ]);
  });

  it("rounds times to milliseconds", () => {
    const events: CastEvent[] = [[0.12349, "o", "x"]];
    const marks: CastMark[] = [{ t: 0.98765, label: "m" }];
    expect(castBody(events, marks)).toEqual([
      [0.123, "o", "x"],
      [0.988, "m", "m"],
    ]);
  });

  it("preserves resize events", () => {
    const events: CastEvent[] = [[0, "r", "80x24"], [0.5, "o", "hi"]];
    expect(castBody(events)).toEqual([[0, "r", "80x24"], [0.5, "o", "hi"]]);
  });
});
