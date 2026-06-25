// U3 — the home-envelope state machine. The pure deriver (the 5-state map) and
// host detection carry the coverage; one gather test confirms the route assembles
// a valid ProjectState for the simplest real case.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, realpathSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { deriveState, detectHost, gatherProjectState } from "../../src/server/project-state.js";

let root: string;
beforeEach(() => { root = realpathSync(mkdtempSync(path.join(tmpdir(), "zw-"))); });
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("deriveState — the 5-state map", () => {
  it("no git → not-a-repo", () => {
    expect(deriveState({ git: false, zuzuu: false, hooksEnabled: false, hasActivity: false })).toBe("not-a-repo");
    // git absence dominates even when everything else is present
    expect(deriveState({ git: false, zuzuu: true, hooksEnabled: true, hasActivity: true })).toBe("not-a-repo");
  });
  it("git but no .zuzuu → no-project", () => {
    expect(deriveState({ git: true, zuzuu: false, hooksEnabled: false, hasActivity: false })).toBe("no-project");
  });
  it(".zuzuu but hooks off → hooks-off", () => {
    expect(deriveState({ git: true, zuzuu: true, hooksEnabled: false, hasActivity: false })).toBe("hooks-off");
  });
  it("enabled but no activity → no-activity", () => {
    expect(deriveState({ git: true, zuzuu: true, hooksEnabled: true, hasActivity: false })).toBe("no-activity");
  });
  it("activity present → steady", () => {
    expect(deriveState({ git: true, zuzuu: true, hooksEnabled: true, hasActivity: true })).toBe("steady");
  });
});

describe("detectHost — Claude Code detection via the #zz-hook signature", () => {
  it("no .claude/ → kind null, disabled", () => {
    expect(detectHost(root)).toEqual({ kind: null, enabled: false });
  });
  it(".claude/ without the signature → claude, disabled", () => {
    mkdirSync(path.join(root, ".claude"));
    writeFileSync(path.join(root, ".claude", "settings.json"), JSON.stringify({ hooks: {} }));
    expect(detectHost(root)).toEqual({ kind: "claude", enabled: false });
  });
  it(".claude/ with the #zz-hook signature → claude, enabled", () => {
    mkdirSync(path.join(root, ".claude"));
    writeFileSync(path.join(root, ".claude", "settings.json"), JSON.stringify({ hooks: { Stop: [{ hooks: [{ command: "node x hook Stop || true #zz-hook" }] }] } }));
    expect(detectHost(root)).toEqual({ kind: "claude", enabled: true });
  });
});

describe("gatherProjectState — assembles the DTO", () => {
  it("an empty folder (no git) → not-a-repo with zero counts", async () => {
    const s = await gatherProjectState(root);
    expect(s.state).toBe("not-a-repo");
    expect(s.host).toEqual({ kind: null, enabled: false });
    expect(s.counts).toEqual({ modules: 0, pending: 0, sessions: 0 });
  });
});
