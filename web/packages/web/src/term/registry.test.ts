// U1: the pending-input handoff used by "start with a task". Peek-then-clear
// semantics keep it StrictMode-safe (a disposed throwaway mount must not
// consume the prompt before the real connection exists).
import { afterEach, describe, expect, it } from "vitest";
import { termRegistry } from "./registry";

describe("termRegistry — pending initial input", () => {
  afterEach(() => termRegistry.clearPendingInput("s1"));

  it("queues and peeks without consuming", () => {
    termRegistry.setPendingInput("s1", "do the thing\r");
    // peeking twice returns the same value — it is NOT taken on read
    expect(termRegistry.getPendingInput("s1")).toBe("do the thing\r");
    expect(termRegistry.getPendingInput("s1")).toBe("do the thing\r");
  });

  it("returns undefined when nothing is queued", () => {
    expect(termRegistry.getPendingInput("never-set")).toBeUndefined();
  });

  it("clear consumes the queued input", () => {
    termRegistry.setPendingInput("s1", "task\r");
    termRegistry.clearPendingInput("s1");
    expect(termRegistry.getPendingInput("s1")).toBeUndefined();
  });

  it("is keyed per session", () => {
    termRegistry.setPendingInput("s1", "a\r");
    termRegistry.setPendingInput("s2", "b\r");
    expect(termRegistry.getPendingInput("s1")).toBe("a\r");
    expect(termRegistry.getPendingInput("s2")).toBe("b\r");
    termRegistry.clearPendingInput("s2");
  });
});
