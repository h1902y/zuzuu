import { describe, expect, it } from "vitest";
import type { ModuleOverviewEntry, ModuleOverviewResponse } from "@zuzuu-web/protocol";
import { kindLabel, orderedIds, toggleEnabledInOverview } from "./modules-list";

const entry = (id: string, extra: Partial<ModuleOverviewEntry> = {}): ModuleOverviewEntry => ({
  id,
  title: id,
  counts: { items: 0, pending: 0, errors: 0 },
  top: [],
  ...extra,
});

describe("orderedIds", () => {
  it("returns the full built-in spine when the overview is empty", () => {
    expect(orderedIds([])).toEqual([
      "knowledge",
      "memory",
      "actions",
      "instructions",
      "guardrails",
    ]);
  });

  it("keeps only the built-ins present in the overview, in spine order", () => {
    const ids = orderedIds([entry("guardrails"), entry("knowledge")]);
    expect(ids).toEqual(["knowledge", "guardrails"]);
  });

  it("appends extra (non-built-in) modules after the spine, in overview order", () => {
    const ids = orderedIds([entry("knowledge"), entry("tasks"), entry("custom")]);
    expect(ids).toEqual(["knowledge", "tasks", "custom"]);
  });
});

describe("kindLabel", () => {
  it("uses the first declared kind", () => {
    expect(kindLabel(entry("knowledge", { kinds: ["fact", "command"] }))).toBe("fact");
  });
  it("falls back to 'module' when no kinds / no entry", () => {
    expect(kindLabel(entry("memory"))).toBe("module");
    expect(kindLabel(undefined)).toBe("module");
  });
});

describe("toggleEnabledInOverview", () => {
  const base: ModuleOverviewResponse = {
    modules: [entry("knowledge", { enabled: true }), entry("memory", { enabled: true })],
  };

  it("flips exactly one module's enabled flag", () => {
    const next = toggleEnabledInOverview(base, "memory", false);
    expect(next?.modules.find((m) => m.id === "memory")?.enabled).toBe(false);
    expect(next?.modules.find((m) => m.id === "knowledge")?.enabled).toBe(true);
  });

  it("returns the input unchanged when the shape is unexpected", () => {
    expect(toggleEnabledInOverview(undefined, "x", true)).toBeUndefined();
  });

  it("does not mutate the original", () => {
    toggleEnabledInOverview(base, "memory", false);
    expect(base.modules.find((m) => m.id === "memory")?.enabled).toBe(true);
  });
});
