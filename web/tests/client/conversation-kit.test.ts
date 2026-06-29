// The conversation kit's one pure decision: tool-call status → the Chip tone that
// carries its urgency (color = state). The components themselves are presentational
// (tsc verifies their composition); this pins the status→tone contract the ToolCallCard
// relies on so a status rename can't silently drop the urgency signal.
import { describe, it, expect } from "vitest";
import { toolStatusTone } from "../../src/client/ds/kit/conversation.js";

describe("toolStatusTone", () => {
  it("maps the tool-call lifecycle statuses to state tones", () => {
    expect(toolStatusTone("completed")).toBe("success");
    expect(toolStatusTone("failed")).toBe("danger");
    expect(toolStatusTone("in_progress")).toBe("warning");
    expect(toolStatusTone("pending")).toBe("neutral");
  });

  it("falls back to neutral for unknown or missing status", () => {
    expect(toolStatusTone("")).toBe("neutral");
    expect(toolStatusTone("queued")).toBe("neutral");
  });
});
