// U3 — the per-step consent gate reducer (plan 2026-06-29-001). Pure logic: the
// mechanical ProjectState + a durable consent record → the current onboarding step.
// Proves the explain-then-run gating, resume-mid-sequence, brownfield/partial entry,
// the decline→dormant path, and idempotent consent.
import { describe, it, expect } from "vitest";
import {
  onboardingStep, recordConsent, reopen, prepRungFor, RUNG_NARRATION, RUNG_ROUTE, describeSetupFailure,
  stepIdentity, shouldResurface, type ConsentRecord, type OnboardingStep,
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

// ─────────────────────────────────────────────────────────────────────────────
// U6 (curried-plotting-coral.md) — SetupPill's re-surface decision. Bug fix: the
// pill's `dismissed` flag used to reset on ANY recompute of `step?.kind` — and
// WorkbenchShell invalidates the whole `["zuzuu"]` query on every websocket
// brain-event, so a transient recompute of the IDENTICAL step silently reopened a
// dismissed pill ("the X did nothing" — confirmed live). `shouldResurface`
// replaces that with an identity comparison: re-surface only for a genuinely
// NEW, more-urgent step, never for a recompute landing back on the same one.
// ─────────────────────────────────────────────────────────────────────────────

describe("stepIdentity — the comparable identity a fresh onboardingStep() recompute shares with an earlier one", () => {
  it("awaiting-consent/executing carry their rung as identity", () => {
    expect(stepIdentity({ kind: "awaiting-consent", rung: "enable", narration: RUNG_NARRATION.enable })).toEqual({ kind: "awaiting-consent", rung: "enable" });
    expect(stepIdentity({ kind: "executing", rung: "init" })).toEqual({ kind: "executing", rung: "init" });
  });

  it("dormant carries the DECLINED rung as identity", () => {
    expect(stepIdentity({ kind: "dormant", declinedAt: "enable" })).toEqual({ kind: "dormant", rung: "enable" });
  });

  it("ready/complete carry no rung", () => {
    expect(stepIdentity({ kind: "ready" })).toEqual({ kind: "ready", rung: null });
    expect(stepIdentity({ kind: "complete" })).toEqual({ kind: "complete", rung: null });
  });

  it("null step → null identity", () => {
    expect(stepIdentity(null)).toBeNull();
  });

  it("two SEPARATE object literals from repeated onboardingStep() calls over an unchanged state/consent produce the SAME identity — the exact case a zuzuu-query invalidation must not treat as new", () => {
    const a = onboardingStep("hooks-off", {});
    const b = onboardingStep("hooks-off", {}); // a fresh recompute, same inputs, a NEW object
    expect(a).not.toBe(b); // different references (pure function, new literal)
    expect(stepIdentity(a)).toEqual(stepIdentity(b)); // same identity
  });
});

describe("shouldResurface — re-open a dismissed SetupPill only for a genuinely new, more-urgent step", () => {
  const awaitingEnable: OnboardingStep = { kind: "awaiting-consent", rung: "enable", narration: RUNG_NARRATION.enable };
  const executingEnable: OnboardingStep = { kind: "executing", rung: "enable" };
  const dormantEnable: OnboardingStep = { kind: "dormant", declinedAt: "enable" };

  it("nothing dismissed yet (null) → always shows", () => {
    expect(shouldResurface(stepIdentity(awaitingEnable), null)).toBe(true);
  });

  it("no current step → never shows, regardless of history", () => {
    expect(shouldResurface(null, stepIdentity(awaitingEnable))).toBe(false);
  });

  it("BUG FIX — a recompute landing back on the SAME identity never re-surfaces (this is the exact reported bug: a transient `[\"zuzuu\"]` invalidation recomputing the identical step must stay dismissed)", () => {
    const recomputed = onboardingStep("hooks-off", {}); // a fresh object, same kind+rung
    expect(shouldResurface(stepIdentity(recomputed), stepIdentity(awaitingEnable))).toBe(false);
  });

  it("a genuine escalation (awaiting-consent → dormant, same rung) DOES re-surface — dormant outranks a plain question", () => {
    expect(shouldResurface(stepIdentity(dormantEnable), stepIdentity(awaitingEnable))).toBe(true);
  });

  it("a same-or-lower-urgency sibling for the SAME rung does NOT re-surface (executing doesn't nag a dismissed awaiting-consent)", () => {
    expect(shouldResurface(stepIdentity(executingEnable), stepIdentity(awaitingEnable))).toBe(false);
  });

  it("dormant, once dismissed, does not re-open for a lower-urgency step of a DIFFERENT rung either — urgency order holds across rungs, not just within one", () => {
    const awaitingInit: OnboardingStep = { kind: "awaiting-consent", rung: "init", narration: RUNG_NARRATION.init };
    expect(shouldResurface(stepIdentity(awaitingInit), stepIdentity(dormantEnable))).toBe(false);
  });
});

describe("describeSetupFailure (U6) — failures surfaced honestly, not a generic toast", () => {
  it("503 = the CLI is absent: not retryable, with self-heal-impossible copy", () => {
    const f = describeSetupFailure("init", 503);
    expect(f).toMatchObject({ rung: "init", cliAbsent: true, retryable: false });
    expect(f.message.toLowerCase()).toContain("cli");
  });

  it("other failures (502) are retryable with try-again copy", () => {
    const f = describeSetupFailure("enable", 502);
    expect(f).toMatchObject({ rung: "enable", cliAbsent: false, retryable: true });
    expect(f.message.toLowerCase()).toMatch(/again|retry/);
  });
});
