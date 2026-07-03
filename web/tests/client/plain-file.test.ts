// §G.3 — the plain-file link: root-mode-aware on-disk paths.
import { describe, it, expect } from "vitest";
import { notePath, modulePath } from "../../src/client/lib/plain-file.js";

describe("notePath", () => {
  it("root-mode → no .zuzuu/ prefix", () => {
    expect(notePath("knowledge", "brahman", true)).toBe("knowledge/items/brahman.md");
  });
  it("classic mode → .zuzuu/ prefix", () => {
    expect(notePath("knowledge", "brahman", false)).toBe(".zuzuu/knowledge/items/brahman.md");
  });
});

describe("modulePath", () => {
  it("root-mode → no .zuzuu/ prefix", () => {
    expect(modulePath("knowledge", true)).toBe("knowledge/module.md");
  });
  it("classic mode → .zuzuu/ prefix", () => {
    expect(modulePath("knowledge", false)).toBe(".zuzuu/knowledge/module.md");
  });
});
