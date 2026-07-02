// §E.4 — the greeting: the omnibar's zero-state assist, composed from existing reads.
import { describe, expect, it } from "vitest";
import { greetingModel, salutationFor } from "../../src/client/omnibar/omni-greeting.js";

const BASE = {
  hour: 9, projectName: "personal", pending: 0, held: 0, integrity: 0,
  lastSession: null, digestLine: null,
};

describe("greetingModel", () => {
  it("leads with the needs-me composite and ranks Review first", () => {
    const g = greetingModel({ ...BASE, pending: 3, held: 1 });
    expect(g.brief[0]).toContain("3 proposals to review");
    expect(g.brief[0]).toContain("1 session awaiting merge");
    expect(g.rows[0]!.label).toBe("Review 4 waiting");
    expect(g.rows[0]!.action).toEqual({ kind: "review" });
  });

  it("offers resume when a session exists; canned invocations only", () => {
    const g = greetingModel({ ...BASE, lastSession: { id: "abc", label: "auth refactor" } });
    expect(g.rows[0]!.label).toBe("Resume auth refactor");
    expect(g.rows[0]!.action).toEqual({ kind: "open-session", id: "abc" });
    // the tail is always actionable: start a session · open Everything
    expect(g.rows.at(-1)!.action).toEqual({ kind: "open-everything" });
  });

  it("is calm when nothing needs the user", () => {
    const g = greetingModel(BASE);
    expect(g.brief).toEqual(["All caught up."]);
    expect(g.rows.some((r) => r.action.kind === "review")).toBe(false);
  });

  it("surfaces the cached digest line ONLY when integrity is quiet", () => {
    expect(greetingModel({ ...BASE, digestLine: "3 notes landed yesterday" }).brief).toContain("3 notes landed yesterday");
    const noisy = greetingModel({ ...BASE, integrity: 2, digestLine: "3 notes landed yesterday" });
    expect(noisy.brief.join(" ")).toContain("2 integrity issues");
    expect(noisy.brief.join(" ")).not.toContain("landed yesterday");
  });

  it("salutation is time-aware", () => {
    expect(salutationFor(8, "p")).toContain("Good morning");
    expect(salutationFor(14, "p")).toContain("Good afternoon");
    expect(salutationFor(21, "p")).toContain("Good evening");
    expect(salutationFor(2, "p")).toContain("Up late");
  });
});
