// shell/session/end-session-copy — the agent-vs-shell confirm copy. An agent end
// must state the merge + mining (it's consequential); a shell must NOT claim a merge.
import { describe, it, expect } from "vitest";
import { endSessionCopy } from "../../src/client/shell/session/end-session-copy.js";

describe("endSessionCopy", () => {
  it("an agent end names the squash-merge and the proposals it mines", () => {
    const c = endSessionCopy("agent");
    expect(c.body).toMatch(/squash-merged/);
    expect(c.body).toMatch(/proposals/);
    expect(c.progress).toMatch(/merging/);
  });

  it("a shell end is honest that nothing is merged", () => {
    const c = endSessionCopy("shell");
    expect(c.body).toMatch(/Nothing is merged/);
    expect(c.body).not.toMatch(/squash-merged/);
    expect(c.progress).not.toMatch(/merging/);
  });

  it("both keep a clear confirm label", () => {
    expect(endSessionCopy("agent").confirm).toBe("End session");
    expect(endSessionCopy("shell").confirm).toBe("End session");
  });
});
