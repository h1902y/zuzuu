import { describe, it, expect, beforeEach } from "vitest";
import { useSendLog } from "../../src/client/state/sendlog.js";

beforeEach(() => useSendLog.setState({ turns: [] }));

describe("send-log", () => {
  it("appends a user turn with id/ts and recalls it per session", () => {
    useSendLog.getState().add("s1", "fix the test");
    const turns = useSendLog.getState().forSession("s1");
    expect(turns).toHaveLength(1);
    expect(turns[0]).toMatchObject({ sessionId: "s1", role: "user", content: "fix the test" });
    expect(typeof turns[0]!.id).toBe("string");
    expect(typeof turns[0]!.ts).toBe("number");
  });

  it("assigns unique ids and preserves order", () => {
    const log = useSendLog.getState();
    log.add("s1", "one");
    log.add("s1", "two");
    const t = useSendLog.getState().forSession("s1");
    expect(t.map((x) => x.content)).toEqual(["one", "two"]);
    expect(t[0]!.id).not.toBe(t[1]!.id);
  });

  it("keeps sessions independent and clears one", () => {
    const log = useSendLog.getState();
    log.add("s1", "a");
    log.add("s2", "b");
    expect(useSendLog.getState().forSession("s2").map((x) => x.content)).toEqual(["b"]);
    log.clear("s1");
    expect(useSendLog.getState().forSession("s1")).toEqual([]);
    expect(useSendLog.getState().forSession("s2")).toHaveLength(1);
  });
});
