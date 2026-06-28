// U6/KTD6 — the main-tree serializer. Two ops queued on one lock never overlap (a
// manual merge can't race the agent-exit auto-merge on `main`); a failure never
// poisons the chain for the next caller.
import { describe, it, expect } from "vitest";
import { createMainTreeLock } from "../../src/server/main-tree-lock.js";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

describe("createMainTreeLock — FIFO serialization of main-tree writes", () => {
  it("runs queued ops one at a time, in order (no interleaving)", async () => {
    const lock = createMainTreeLock();
    const events: string[] = [];
    const op = (name: string, ms: number) => async () => {
      events.push(`${name}:start`);
      await sleep(ms);
      events.push(`${name}:end`);
    };
    // a slow op queued first; a fast one second — without the lock "b" would finish
    // inside "a"'s window. The lock forces a:start a:end b:start b:end.
    const p1 = lock.run(op("a", 30));
    const p2 = lock.run(op("b", 1));
    await Promise.all([p1, p2]);
    expect(events).toEqual(["a:start", "a:end", "b:start", "b:end"]);
  });

  it("a failing op rejects to ITS caller but never breaks the chain", async () => {
    const lock = createMainTreeLock();
    await expect(lock.run(() => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
    // the next queued op still runs and resolves with its own result
    await expect(lock.run(() => Promise.resolve("ok"))).resolves.toBe("ok");
  });

  it("a caller sees its own result, not the prior op's", async () => {
    const lock = createMainTreeLock();
    const a = await lock.run(() => Promise.resolve(1));
    const b = await lock.run(() => Promise.resolve(2));
    expect([a, b]).toEqual([1, 2]);
  });
});
