// src/server/main-tree-lock.ts — a tiny FIFO serializer for operations that touch
// the SHARED main working tree (the squash-merge into `main`). Two held sessions
// merging at once would race on `main` and corrupt it (KTD6); routing every merge
// through one lock's `run()` serializes them. A failure never poisons the chain —
// the next queued op still runs.
//
// ONE instance is shared by the agent-exit auto-merge (agent-close, the U7 escape
// hatch) and the explicit held-merge route (sessions-routes) so the two paths can't
// interleave on `main`. The default hold/discard paths don't touch the main tree, so
// they never enter the chain.

export interface MainTreeLock {
  /** Queue `fn` to run after every previously-queued op settles (success OR failure).
   *  Returns fn's own result/rejection — a caller sees its own outcome, never the
   *  chain's. */
  run<T>(fn: () => Promise<T>): Promise<T>;
}

export function createMainTreeLock(): MainTreeLock {
  let tail: Promise<unknown> = Promise.resolve();
  return {
    run<T>(fn: () => Promise<T>): Promise<T> {
      const result = tail.then(fn, fn); // run regardless of the prior op's outcome
      // advance the tail to a settled (never-rejecting) promise so one failure
      // doesn't break serialization for the next caller.
      tail = result.then(() => undefined, () => undefined);
      return result;
    },
  };
}
