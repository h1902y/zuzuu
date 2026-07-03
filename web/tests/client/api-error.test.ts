// audit item 4 — the precise gate refusal surfaces, not the generic wrapper.
import { describe, it, expect } from "vitest";
import { apiErrorMessage } from "../../src/client/lib/api.js";

describe("apiErrorMessage", () => {
  it("prefers the CLI's structured refusal riding in data.error", () => {
    expect(apiErrorMessage(502, {
      error: "zuzuu command failed",
      stderr: "",
      data: { ok: false, error: "missing required field: type; field 'company' is required" },
    })).toBe("missing required field: type; field 'company' is required");
  });
  it("falls back to the stderr tail, then the wrapper, then the status", () => {
    expect(apiErrorMessage(502, { error: "zuzuu command failed", stderr: "boom\nreal reason" })).toBe("real reason");
    expect(apiErrorMessage(502, { error: "zuzuu command failed" })).toBe("zuzuu command failed");
    expect(apiErrorMessage(500, null)).toBe("request failed (500)");
  });
});
