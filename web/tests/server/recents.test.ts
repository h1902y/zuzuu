// U4 — the recents reconciler + the /api/projects/recents route. The pure
// reconciler carries the coverage; one route test confirms the wiring (with an
// injected loader so it never touches the real ~/.webcode/config.json).
import { describe, it, expect } from "vitest";
import { reconcileRecents } from "../../src/server/recents.js";
import { createProjectsApi } from "../../src/server/projects-routes.js";

describe("reconcileRecents — picker rows, current marked", () => {
  it("marks the current root, leaves the rest unmarked", () => {
    expect(reconcileRecents(["/a/proj", "/b/other"], "/a/proj")).toEqual([
      { path: "/a/proj", name: "proj", current: true },
      { path: "/b/other", name: "other", current: false },
    ]);
  });
  it("preserves most-recent-first order and dedupes", () => {
    const rows = reconcileRecents(["/x", "/y", "/x"], "/y");
    expect(rows.map((r) => r.path)).toEqual(["/x", "/y"]);
    expect(rows.find((r) => r.path === "/y")?.current).toBe(true);
  });
  it("empty recents → empty list", () => {
    expect(reconcileRecents([], "/a")).toEqual([]);
  });
  it("name is the basename of the path", () => {
    expect(reconcileRecents(["/Users/me/cards-game"], "/elsewhere")[0]!.name).toBe("cards-game");
  });
});

describe("GET /api/projects/recents", () => {
  it("returns the reconciled list from the loader", async () => {
    const app = createProjectsApi(() => "/a/proj", { load: async () => ({ recent: ["/a/proj", "/b/other"] }) });
    const res = await app.request("/recents");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      recents: [
        { path: "/a/proj", name: "proj", current: true },
        { path: "/b/other", name: "other", current: false },
      ],
    });
  });
});
