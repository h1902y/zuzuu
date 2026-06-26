// P1.2 — the top-level surface store (projects-home ⇄ in-project) + the browser
// history mapping behind the Back/Forward sync.
import { describe, it, expect, beforeEach } from "vitest";
import { useAppSurface, surfaceFromHistoryState } from "../../src/client/state/app-surface.js";

beforeEach(() => useAppSurface.setState({ screen: "projects", path: null }));

describe("useAppSurface", () => {
  it("launches on the Projects Home", () => {
    expect(useAppSurface.getState().screen).toBe("projects");
    expect(useAppSurface.getState().path).toBe(null);
  });
  it("open records the project + path; home clears it", () => {
    useAppSurface.getState().open("/a/cards");
    expect(useAppSurface.getState()).toMatchObject({ screen: "project", path: "/a/cards" });
    useAppSurface.getState().home();
    expect(useAppSurface.getState()).toMatchObject({ screen: "projects", path: null });
  });
});

describe("surfaceFromHistoryState (browser Back/Forward mapping)", () => {
  it("a project entry with a path → that project", () =>
    expect(surfaceFromHistoryState({ screen: "project", path: "/a/b" })).toEqual({ screen: "project", path: "/a/b" }));
  it("a project entry WITHOUT a path → Home (defensive)", () =>
    expect(surfaceFromHistoryState({ screen: "project" })).toEqual({ screen: "projects", path: null }));
  it("an explicit projects entry → Home", () =>
    expect(surfaceFromHistoryState({ screen: "projects", path: null })).toEqual({ screen: "projects", path: null }));
  it("null (an unseeded pop) → Home", () =>
    expect(surfaceFromHistoryState(null)).toEqual({ screen: "projects", path: null }));
  it("a non-object → Home", () =>
    expect(surfaceFromHistoryState("project")).toEqual({ screen: "projects", path: null }));
});
