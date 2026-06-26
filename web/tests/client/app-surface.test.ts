// P1.2 — the top-level surface store (projects-home ⇄ in-project).
import { describe, it, expect, beforeEach } from "vitest";
import { useAppSurface } from "../../src/client/state/app-surface.js";

beforeEach(() => useAppSurface.setState({ screen: "projects" }));

describe("useAppSurface", () => {
  it("launches on the Projects Home", () => {
    expect(useAppSurface.getState().screen).toBe("projects");
  });
  it("setScreen flips the top-level surface", () => {
    useAppSurface.getState().setScreen("project");
    expect(useAppSurface.getState().screen).toBe("project");
    useAppSurface.getState().setScreen("projects");
    expect(useAppSurface.getState().screen).toBe("projects");
  });
});
