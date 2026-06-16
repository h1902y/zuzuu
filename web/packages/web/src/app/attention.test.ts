// W1-C: attention routing — detect sessions that just finished/crashed since
// the last poll, so we can notify + surface them. Pure transition logic.
import { describe, expect, it } from "vitest";
import { detectAttention, type AttentionSnapshot } from "./attention";

const snap = (id: string, state: string, label = id): AttentionSnapshot => ({ id, state, label });

describe("detectAttention", () => {
  it("a live session that became completed → a 'finished' event", () => {
    const prev = [snap("a", "active", "fix auth")];
    const next = [snap("a", "completed", "fix auth")];
    expect(detectAttention(prev, next)).toEqual([{ sessionId: "a", kind: "finished", label: "fix auth" }]);
  });

  it("a live session that crashed/abandoned → a 'crashed' event", () => {
    expect(detectAttention([snap("a", "active")], [snap("a", "crashed")])).toEqual([
      { sessionId: "a", kind: "crashed", label: "a" },
    ]);
    expect(detectAttention([snap("b", "opening")], [snap("b", "abandoned")])).toEqual([
      { sessionId: "b", kind: "crashed", label: "b" },
    ]);
  });

  it("opening → completed also counts as finished", () => {
    expect(detectAttention([snap("a", "opening")], [snap("a", "completed")])[0]?.kind).toBe("finished");
  });

  it("no state change → no event", () => {
    expect(detectAttention([snap("a", "active")], [snap("a", "active")])).toEqual([]);
    expect(detectAttention([snap("a", "completed")], [snap("a", "completed")])).toEqual([]);
  });

  it("a brand-new session (absent from prev) is not an event — only transitions", () => {
    expect(detectAttention([], [snap("a", "active")])).toEqual([]);
    expect(detectAttention([], [snap("a", "completed")])).toEqual([]);
  });

  it("a session that was already terminal stays quiet", () => {
    expect(detectAttention([snap("a", "completed")], [snap("a", "crashed")])).toEqual([]);
  });

  it("reports multiple transitions at once, carrying each label from next", () => {
    const prev = [snap("a", "active", "one"), snap("b", "active", "two")];
    const next = [snap("a", "completed", "one"), snap("b", "crashed", "two-renamed")];
    expect(detectAttention(prev, next)).toEqual([
      { sessionId: "a", kind: "finished", label: "one" },
      { sessionId: "b", kind: "crashed", label: "two-renamed" },
    ]);
  });
});
