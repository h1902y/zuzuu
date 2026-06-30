// U5 — the onboarding companion view model. Proves the "Setup n/3" pin tracks the rung,
// the rung clears once setup is complete, and the "start your first session" segue shows
// only when prepped AND no session exists yet (an empty-brain affordance, not a fixture).
import { describe, it, expect } from "vitest";
import { companionView, SETUP_RUNGS } from "../../src/client/shell/onboarding/companion-state.js";

describe("companionView — the pinned onboarding companion", () => {
  it("labels each setup rung n/3 and names the rung", () => {
    expect(companionView("not-a-repo", 0)).toMatchObject({ label: "Setup 1/3", rung: "git-init", segue: false });
    expect(companionView("no-project", 0)).toMatchObject({ label: "Setup 2/3", rung: "init", segue: false });
    expect(companionView("hooks-off", 0)).toMatchObject({ label: "Setup 3/3", rung: "enable", segue: false });
    expect(SETUP_RUNGS).toEqual(["git-init", "init", "enable"]);
  });

  it("clears the pin once setup is complete (no-activity / steady)", () => {
    expect(companionView("no-activity", 0).label).toBeNull();
    expect(companionView("no-activity", 0).rung).toBeNull();
    expect(companionView("steady", 2).label).toBeNull();
  });

  it("shows the segue only when prepped AND no session exists yet", () => {
    expect(companionView("no-activity", 0).segue).toBe(true);  // enabled, brain empty → invite the first session
    expect(companionView("no-activity", 1).segue).toBe(false); // a session exists → no longer an empty-brain affordance
    expect(companionView("steady", 0).segue).toBe(true);
    expect(companionView("steady", 3).segue).toBe(false);
    expect(companionView("hooks-off", 0).segue).toBe(false);   // still mid-setup → no segue
  });
});
