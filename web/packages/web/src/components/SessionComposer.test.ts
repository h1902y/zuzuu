// Smoke tests for the U5 SessionComposer resting-state copy + chip reframe.
// We test the exported constants — no DOM mounting needed (node env).
import { describe, expect, it } from "vitest";
import { EMPTY_STATE_COPY, QUICK_CHIPS } from "./SessionComposer";

describe("SessionComposer — U5 resting-state copy", () => {
  it("EMPTY_STATE_COPY mentions typing in the terminal", () => {
    expect(EMPTY_STATE_COPY).toContain("terminal");
  });

  it("EMPTY_STATE_COPY tells users to press ↵ or Start", () => {
    expect(EMPTY_STATE_COPY).toMatch(/↵|Start/);
  });

  it("EMPTY_STATE_COPY references 'task' so users know what to do", () => {
    expect(EMPTY_STATE_COPY.toLowerCase()).toContain("task");
  });
});

describe("SessionComposer — U5 quick-start chips (no module jargon)", () => {
  const labels = QUICK_CHIPS.map((c) => c.label);

  it("chips exist", () => {
    expect(QUICK_CHIPS.length).toBeGreaterThan(0);
  });

  it("no chip uses the old module-jargon labels", () => {
    expect(labels).not.toContain("Recall what you know");
    expect(labels).not.toContain("Run an action");
    expect(labels).not.toContain("Review proposals");
  });

  it("chips use plain task-oriented labels", () => {
    // At least one chip should mention a concrete action a new user understands
    const plain = labels.some((l) =>
      /task|question|code|review|ask|start/i.test(l),
    );
    expect(plain).toBe(true);
  });

  it("every chip has a non-empty label and title", () => {
    for (const chip of QUICK_CHIPS) {
      expect(chip.label.length).toBeGreaterThan(0);
      expect(chip.title.length).toBeGreaterThan(0);
    }
  });
});
