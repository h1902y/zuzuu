// U2: the context-aware composer's pure state helpers (node env, no DOM).
// The composer itself is two states (idle prompt box / active status+Stop);
// its decisions live in composer-state so they're testable without mounting.
import { describe, expect, it } from "vitest";
import {
  composerMode,
  EXTERNAL_VIEW_NOTE,
  hasTask,
  idlePlaceholder,
  promptPlaceholder,
  QUICK_CHIPS,
} from "./composer-state";

describe("composerMode — idle vs active", () => {
  it("is active when an agent is live", () => {
    expect(composerMode(true)).toBe("active");
  });
  it("is idle when nothing is running", () => {
    expect(composerMode(false)).toBe("idle");
  });
});

describe("promptPlaceholder — names the selected host", () => {
  it("uses the host label", () => {
    expect(promptPlaceholder("Claude Code")).toBe("What should Claude Code do?");
  });
  it("falls back when no host is known", () => {
    expect(promptPlaceholder(null)).toBe("What should your agent do?");
    expect(promptPlaceholder("")).toBe("What should your agent do?");
    expect(promptPlaceholder(undefined)).toBe("What should your agent do?");
  });
});

describe("idlePlaceholder — viewing a session that lives in your terminal", () => {
  it("normally names the host (Send starts/continues your workbench agent)", () => {
    expect(idlePlaceholder("Claude Code", false)).toBe("What should Claude Code do?");
  });
  it("when viewing an external session, makes clear Send starts a NEW session", () => {
    expect(idlePlaceholder("Claude Code", true)).toBe("Start a new session…");
  });
  it("the external-view note explains Send won't reply to the viewed session", () => {
    expect(EXTERNAL_VIEW_NOTE).toMatch(/your terminal/i);
    expect(EXTERNAL_VIEW_NOTE.toLowerCase()).toContain("new one");
  });
});

describe("hasTask — is there real text to hand the host", () => {
  it("true for non-blank", () => {
    expect(hasTask("fix the bug")).toBe(true);
  });
  it("false for blank / whitespace", () => {
    expect(hasTask("")).toBe(false);
    expect(hasTask("   \n  ")).toBe(false);
  });
});

describe("QUICK_CHIPS — pre-fill starters, not launchers", () => {
  it("every chip has a label and a non-empty fill (real choices)", () => {
    expect(QUICK_CHIPS.length).toBeGreaterThan(0);
    for (const chip of QUICK_CHIPS) {
      expect(chip.label.length).toBeGreaterThan(0);
      expect(chip.fill.trim().length).toBeGreaterThan(0);
    }
  });
  it("fills are distinct, concrete tasks (chips aren't three buttons doing the same thing)", () => {
    const fills = QUICK_CHIPS.map((c) => c.fill);
    expect(new Set(fills).size).toBe(fills.length);
  });
  it("no chip carries module jargon", () => {
    const labels = QUICK_CHIPS.map((c) => c.label);
    expect(labels).not.toContain("Recall what you know");
    expect(labels).not.toContain("Run an action");
    expect(labels).not.toContain("Review proposals");
  });
});
