// U8 — the daemon's registry read: ref → Projects Home row, the fallback ladder,
// and GET /api/projects/list selecting registry vs recents (injected, no CLI shell).
import { describe, it, expect } from "vitest";
import { refToSummary, chooseSource, type RegistryRef } from "../../src/server/registry-read.js";
import { createProjectsApi } from "../../src/server/projects-routes.js";

const stamp = { modules: 2, notes: 9, pending: 1, guarded: true, lastActivityMs: 123 };

describe("refToSummary", () => {
  it("maps a registry ref → a registry-sourced row (uses the stamp when not local)", () => {
    const ref: RegistryRef = {
      id: "cards", remote: "git@github.com:me/cards.git", path: "/nope/cards",
      tracked: "pinned", groups: ["games"], portable: true, health: stamp,
    };
    const s = refToSummary(ref, "/other");
    expect(s.source).toBe("registry");
    expect(s.name).toBe("cards");
    expect(s.notes).toBe(9); // from the committed stamp (path isn't local)
    expect(s.groups).toEqual(["games"]);
    expect(s.remote).toBe("git@github.com:me/cards.git");
    expect(s.portable).toBe(true);
    expect(s.tracked).toBe("pinned");
    expect(s.current).toBe(false);
  });
  it("a local-only ref → portable false, no remote, marks current by path", () => {
    const s = refToSummary({ id: "x", path: "/root", tracked: "auto" }, "/root");
    expect(s.portable).toBe(false);
    expect(s.remote).toBeUndefined();
    expect(s.tracked).toBe("auto");
    expect(s.current).toBe(true);
  });
});

describe("chooseSource — the fallback ladder", () => {
  it("registry wins when configured with refs", () => {
    const reg = { configured: true, refs: [{ id: "a", path: "/nope/a", health: stamp }] };
    const r = chooseSource(reg, ["/recent/b"], "/x");
    expect(r.source).toBe("registry");
    expect(r.projects.map((p) => p.name)).toEqual(["a"]);
  });
  it("falls back to recents when no registry, or a registry with zero refs", () => {
    expect(chooseSource(null, ["/recent/b"], "/x").source).toBe("recents");
    expect(chooseSource({ configured: true, refs: [] }, ["/recent/b"], "/x").source).toBe("recents");
  });
});

describe("GET /api/projects/list uses the ladder", () => {
  it("registry-sourced when the registry is configured", async () => {
    const api = createProjectsApi(() => "/root", {
      load: async () => ({ recent: ["/recent/x"] }),
      registry: async () => ({ configured: true, refs: [{ id: "reg-proj", path: "/nope/reg-proj", health: stamp }] }),
    });
    const body = await (await api.request("/list")).json();
    expect(body.source).toBe("registry");
    expect(body.projects[0].name).toBe("reg-proj");
  });
  it("recents-sourced when no registry", async () => {
    const api = createProjectsApi(() => "/root", {
      load: async () => ({ recent: ["/recent/x"] }),
      registry: async () => null,
    });
    const body = await (await api.request("/list")).json();
    expect(body.source).toBe("recents");
    expect(body.projects[0].path).toBe("/recent/x");
  });
});
