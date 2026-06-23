import { describe, it, expect } from "vitest";
import { registerTermConn, unregisterTermConn, getTermConn } from "../../src/client/term/connections.js";
import type { TermConnection } from "../../src/client/term/connection.js";

const fakeConn = (sent: string[]) =>
  ({ sendInput: (d: string) => sent.push(d) }) as unknown as TermConnection;

describe("term connection registry", () => {
  it("registers, looks up, and unregisters by session id", () => {
    const sent: string[] = [];
    const c = fakeConn(sent);
    expect(getTermConn("s1")).toBeUndefined();

    registerTermConn("s1", c);
    expect(getTermConn("s1")).toBe(c);

    getTermConn("s1")!.sendInput("hi");
    expect(sent).toEqual(["hi"]);

    unregisterTermConn("s1");
    expect(getTermConn("s1")).toBeUndefined();
  });

  it("keeps sessions independent", () => {
    const a: string[] = [];
    const b: string[] = [];
    registerTermConn("a", fakeConn(a));
    registerTermConn("b", fakeConn(b));
    getTermConn("a")!.sendInput("x");
    expect(a).toEqual(["x"]);
    expect(b).toEqual([]);
    unregisterTermConn("a");
    unregisterTermConn("b");
  });
});
