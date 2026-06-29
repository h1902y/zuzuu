// U3 — the per-step consent gate reducer (plan 2026-06-29-001). Pure logic: the
// mechanical ProjectState + a durable consent record → the current onboarding step.
// Proves the explain-then-run gating, resume-mid-sequence, brownfield/partial entry,
// the decline→dormant path, and idempotent consent.
import { describe, it, expect } from "vitest";
import {
  onboardingStep, recordConsent, reopen, prepRungFor, RUNG_NARRATION, RUNG_ROUTE,
  type ConsentRecord,
} from "../../src/client/shell/onboarding/onboarding-state.js";

describe("onboardingStep — the consent gate", () => {
  it("greenfield: walks git-init → init → enable, each blocking for an affirmative", () => {
    // not-a-repo, nothing consented → awaiting consent on git-init (not auto-firing)
    let consent: ConsentRecord = {};
    let step = onboardingStep("not-a-repo", consent);
    expect(step).toMatchObject({ kind: "awaiting-consent", rung: "git-init" });

    // affirm git-init → that rung is "executing"; the daemon route fires + state refetches
    consent = recordConsent(consent, "git-init", "consented");
    expect(onboardingStep("not-a-repo", consent)).toMatchObject({ kind: "executing", rung: "git-init" });

    // state advances to no-project → next rung (init) blocks for its own affirmative
    step = onboardingStep("no-project", consent);
    expect(step).toMatchObject({ kind: "awaiting-consent", rung: "init" });

    // affirm init → advance to hooks-off → enable blocks
    consent = recordConsent(consent, "init", "consented");
    expect(onboardingStep("hooks-off", consent)).toMatchObject({ kind: "awaiting-consent", rung: "enable" });

    // affirm enable → prepped (no-activity) → ready to pick a host / start the first session
    consent = recordConsent(consent, "enable", "consented");
    expect(onboardingStep("no-activity", consent)).toEqual({ kind: "ready" });
  });

  it("R14: the enable rung's narration explains it edits the host config", () => {
    const step = onboardingStep("hooks-off", {});
    expect(step.kind).toBe("awaiting-consent");
    if (step.kind !== "awaiting-consent") return;
    expect(step.rung).toBe("enable");
    // load-bearing copy: enabling is a real change to the host
    expect(step.narration.body.toLowerCase()).toContain("host");
    expect(step.narration.body).toMatch(/config|settings/i);
  });

  it("PR5: resumes mid-sequence from the durable consent record after a reload", () => {
    // user consented git-init + init, then reloaded; mechanical state is now hooks-off
    const consent: ConsentRecord = { "git-init": "consented", init: "consented" };
    // a fresh recompute (any tab) lands on the enable rung — not a restart at git-init
    expect(onboardingStep("hooks-off", consent)).toMatchObject({ kind: "awaiting-consent", rung: "enable" });
  });

  it("brownfield: a steady repo is complete; a partial repo enters mid-sequence", () => {
    expect(onboardingStep("steady", {})).toEqual({ kind: "complete" });
    // .zuzuu present but hooks-off (inited via CLI, never enabled in this host) → enter at enable
    expect(onboardingStep("hooks-off", {})).toMatchObject({ kind: "awaiting-consent", rung: "enable" });
  });

  it("decline → the dormant end-state (reversible), not a silent march", () => {
    const consent = recordConsent({}, "git-init", "declined");
    expect(onboardingStep("not-a-repo", consent)).toEqual({ kind: "dormant", declinedAt: "git-init" });
    // reopen clears the decline so the rung re-surfaces (the "re-enable anytime" path)
    expect(onboardingStep("not-a-repo", reopen(consent, "git-init"))).toMatchObject({
      kind: "awaiting-consent", rung: "git-init",
    });
  });

  it("recordConsent is idempotent — re-affirming is stable (concurrent tabs / double-click)", () => {
    const once = recordConsent({}, "enable", "consented");
    const twice = recordConsent(once, "enable", "consented");
    expect(twice).toEqual(once);
  });

  it("maps mechanical states to prep rungs (and routes) correctly", () => {
    expect(prepRungFor("not-a-repo")).toBe("git-init");
    expect(prepRungFor("no-project")).toBe("init");
    expect(prepRungFor("hooks-off")).toBe("enable");
    expect(prepRungFor("no-activity")).toBeNull();
    expect(prepRungFor("steady")).toBeNull();
    expect(RUNG_ROUTE["git-init"]).toBe("gitInit");
    expect(Object.keys(RUNG_NARRATION)).toEqual(["git-init", "init", "enable"]);
  });
});
