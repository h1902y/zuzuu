// Pure tests for the right panel's path derivation (the Module Standard:
// one envelope .md per item; actions are dir-shaped ACTION.md).
import { describe, expect, it } from "vitest";
import {
  moduleDir, moduleItemPath, moduleItemsDir, moduleReadmePath, moduleSchemaPath,
} from "./module-paths";

describe("module path derivation (envelope items)", () => {
  it("derives the flat item dirs: items/ everywhere, memory uses entries/", () => {
    expect(moduleItemsDir("knowledge")).toBe(".zuzuu/knowledge/items");
    expect(moduleItemsDir("memory")).toBe(".zuzuu/memory/entries");
    expect(moduleItemsDir("instructions")).toBe(".zuzuu/instructions/items");
    expect(moduleItemsDir("guardrails")).toBe(".zuzuu/guardrails/items");
  });

  it("actions are dir-shaped (scripts stay siblings) — no flat items dir", () => {
    expect(moduleItemsDir("actions")).toBeNull();
  });

  it("derives an item's envelope file from its id", () => {
    expect(moduleItemPath("knowledge", "file-commands-hook-mjs"))
      .toBe(".zuzuu/knowledge/items/file-commands-hook-mjs.md");
    expect(moduleItemPath("memory", "20260612-session"))
      .toBe(".zuzuu/memory/entries/20260612-session.md");
    expect(moduleItemPath("guardrails", "no-root-wipe"))
      .toBe(".zuzuu/guardrails/items/no-root-wipe.md");
    expect(moduleItemPath("instructions", "steering"))
      .toBe(".zuzuu/instructions/items/steering.md");
  });

  it("derives an action's ACTION.md from its slug", () => {
    expect(moduleItemPath("actions", "run-tests")).toBe(".zuzuu/actions/run-tests/ACTION.md");
  });

  it("derives module dir, README and seeded schema", () => {
    expect(moduleDir("memory")).toBe(".zuzuu/memory");
    expect(moduleReadmePath("actions")).toBe(".zuzuu/actions/README.md");
    expect(moduleSchemaPath("guardrails")).toBe(".zuzuu/guardrails/schema.json");
  });
});
