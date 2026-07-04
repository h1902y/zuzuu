// U1 — the proposal-state design primitive (ds/recipes/proposal.ts + ds/kit/
// ProposalBadge.tsx). Framework-free: pure recipe/model tests, no DOM (the
// project's convention — see ds-kit.test.ts / proposal-chip.test.ts).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { proposalRecipe } from "../../src/client/ds/recipes/proposal.js";
import { proposalBadgeVariant } from "../../src/client/ds/kit/ProposalBadge.js";

describe("ds — proposal recipe (U1)", () => {
  it("pending: dashed + translucent proposal fill + the shared pulse", () => {
    const c = proposalRecipe({ state: "pending" });
    expect(c).toContain("border-dashed");
    expect(c).toContain("border-proposal");
    expect(c).toContain("bg-proposal/10");
    expect(c).toContain("text-proposal");
    expect(c).toContain("animate-proposal-pulse");
  });

  it("approving: solidifies to the accent it's becoming, via the shared solidify motion", () => {
    const c = proposalRecipe({ state: "approving" });
    expect(c).toContain("border-solid");
    expect(c).toContain("border-accent");
    expect(c).toContain("bg-accent");
    expect(c).toContain("text-on-accent");
    expect(c).toContain("animate-proposal-solidify");
    // approving is the "becoming real" state — never the proposal hue's own utilities
    expect(c).not.toContain("border-proposal");
    expect(c).not.toContain("bg-proposal");
    expect(c).not.toContain("text-proposal");
  });

  it("rejecting: stays proposal-dashed while it dissolves out", () => {
    const c = proposalRecipe({ state: "rejecting" });
    expect(c).toContain("border-dashed");
    expect(c).toContain("border-proposal");
    expect(c).toContain("animate-proposal-dissolve");
    expect(c).toContain("pointer-events-none");
  });

  it("defaults to pending", () => {
    expect(proposalRecipe({})).toEqual(proposalRecipe({ state: "pending" }));
  });

  it("no arbitrary-value classes (token-bound only)", () => {
    for (const state of ["pending", "approving", "rejecting"] as const) {
      expect(proposalRecipe({ state })).not.toMatch(/\[[^\]]+\]/);
    }
  });

  it("the three states are visually distinct class sets", () => {
    const states = ["pending", "approving", "rejecting"] as const;
    const outputs = states.map((state) => proposalRecipe({ state }));
    expect(new Set(outputs).size).toBe(states.length);
  });
});

describe("ds kit — ProposalBadge state→variant mapping (pure, no DOM)", () => {
  it("pending → default label 'proposal' + the pending recipe class", () => {
    const v = proposalBadgeVariant("pending");
    expect(v.label).toBe("proposal");
    expect(v.className).toBe(proposalRecipe({ state: "pending" }));
  });

  it("approving → default label 'approved' + the approving recipe class", () => {
    const v = proposalBadgeVariant("approving");
    expect(v.label).toBe("approved");
    expect(v.className).toBe(proposalRecipe({ state: "approving" }));
  });

  it("rejecting → default label 'rejected' + the rejecting recipe class", () => {
    const v = proposalBadgeVariant("rejecting");
    expect(v.label).toBe("rejected");
    expect(v.className).toBe(proposalRecipe({ state: "rejecting" }));
  });

  it("an explicit label overrides the default copy, class still follows state", () => {
    const v = proposalBadgeVariant("pending", "3 staged");
    expect(v.label).toBe("3 staged");
    expect(v.className).toBe(proposalRecipe({ state: "pending" }));
  });
});

describe("ds tokens — the proposal hue resolves in both themes (U1)", () => {
  const css = readFileSync(fileURLToPath(new URL("../../src/client/index.css", import.meta.url)), "utf8");

  it("declares --color-proposal in the @theme fallback and both explicit themes", () => {
    const occurrences = css.match(/--color-proposal:\s*#[0-9a-fA-F]{3,8};/g) ?? [];
    // fallback (@theme) + :root[data-theme="dark"] + :root[data-theme="light"]
    expect(occurrences.length).toBeGreaterThanOrEqual(3);
  });

  it("dark and light values are distinct (light isn't just a copy-paste of dark)", () => {
    const darkStart = css.indexOf(':root[data-theme="dark"]');
    const lightStart = css.indexOf(':root[data-theme="light"]');
    expect(darkStart).toBeGreaterThan(-1);
    expect(lightStart).toBeGreaterThan(darkStart);
    const darkBlock = css.slice(darkStart, lightStart);
    const lightBlock = css.slice(lightStart);
    const darkValue = darkBlock.match(/--color-proposal:\s*(#[0-9a-fA-F]{3,8});/)?.[1];
    const lightValue = lightBlock.match(/--color-proposal:\s*(#[0-9a-fA-F]{3,8});/)?.[1];
    expect(darkValue).toBeTruthy();
    expect(lightValue).toBeTruthy();
    expect(darkValue).not.toBe(lightValue);
  });

  it("the proposal hue is distinct from warning and accent (the reconciled disagreement)", () => {
    const grab = (name: string) => css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{3,8});`))?.[1];
    expect(grab("proposal")).not.toBe(grab("warning"));
    expect(grab("proposal")).not.toBe(grab("accent"));
  });
});

describe("shared motion — the World's keyframes are promoted, not duplicated (U1/KTD2)", () => {
  const indexCss = readFileSync(fileURLToPath(new URL("../../src/client/index.css", import.meta.url)), "utf8");
  const worldCss = readFileSync(fileURLToPath(new URL("../../src/client/world/world.css", import.meta.url)), "utf8");
  const PROMOTED_KEYFRAMES = ["zz-world-pulse", "zz-world-solidify", "zz-world-ghost-out"] as const;

  it("every promoted keyframe is DEFINED in the shared layer (index.css)", () => {
    for (const name of PROMOTED_KEYFRAMES) {
      expect(indexCss).toMatch(new RegExp(`@keyframes ${name}\\b`));
    }
  });

  it("world.css no longer DEFINES those keyframes — it only references them", () => {
    for (const name of PROMOTED_KEYFRAMES) {
      expect(worldCss).not.toMatch(new RegExp(`@keyframes ${name}\\b`));
      expect(worldCss).toMatch(new RegExp(`animation:\\s*${name}\\b`));
    }
  });

  it("the proposal recipe's animate-proposal-* classes are bound to the shared keyframes", () => {
    expect(indexCss).toMatch(/\.animate-proposal-pulse\s*\{\s*animation:\s*zz-world-pulse/);
    expect(indexCss).toMatch(/\.animate-proposal-solidify\s*\{\s*animation:\s*zz-world-solidify/);
    expect(indexCss).toMatch(/\.animate-proposal-dissolve\s*\{\s*animation:\s*zz-world-ghost-out/);
  });

  it("reduced-motion turns the promoted animate-proposal-* classes off too", () => {
    const reducedBlock = indexCss.slice(indexCss.indexOf("prefers-reduced-motion"));
    expect(reducedBlock).toContain("animate-proposal-pulse");
    expect(reducedBlock).toContain("animate-proposal-solidify");
    expect(reducedBlock).toContain("animate-proposal-dissolve");
  });
});
