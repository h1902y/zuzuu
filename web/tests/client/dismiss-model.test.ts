// ds/kit/overlay/dismiss-model.ts — the Escape/outside-pointerdown DECISION
// predicates useDismiss acts on (U1, curried-plotting-coral.md). Pure — refs and
// event targets are mocked with plain objects, no DOM/jsdom required.
import { describe, it, expect } from "vitest";
import { shouldCloseOnEscape, shouldCloseOnOutside, type Containable } from "../../src/client/ds/kit/overlay/dismiss-model.js";
import { EMPTY_OVERLAY_STACK, pushOverlay } from "../../src/client/ds/kit/overlay/overlay-stack.js";

describe("shouldCloseOnEscape — topmost only", () => {
  it("closes only the topmost id on Escape; every other open overlay no-ops", () => {
    let stack = pushOverlay(EMPTY_OVERLAY_STACK, "review-queue");
    stack = pushOverlay(stack, "agent-view"); // opened on top of the review queue
    // the direct fix for "Escape closed the background review queue instead of
    // the foreground agent view": the queue's own handler must say no here.
    expect(shouldCloseOnEscape(stack, "review-queue", "Escape")).toBe(false);
    expect(shouldCloseOnEscape(stack, "agent-view", "Escape")).toBe(true);
  });

  it("ignores every other key", () => {
    const stack = pushOverlay(EMPTY_OVERLAY_STACK, "dialog");
    expect(shouldCloseOnEscape(stack, "dialog", "Enter")).toBe(false);
    expect(shouldCloseOnEscape(stack, "dialog", "Tab")).toBe(false);
    expect(shouldCloseOnEscape(stack, "dialog", "a")).toBe(false);
  });

  it("an id not in the stack at all never closes", () => {
    const stack = pushOverlay(EMPTY_OVERLAY_STACK, "dialog");
    expect(shouldCloseOnEscape(stack, "unregistered", "Escape")).toBe(false);
  });

  it("a single open overlay is trivially topmost", () => {
    const stack = pushOverlay(EMPTY_OVERLAY_STACK, "only-one");
    expect(shouldCloseOnEscape(stack, "only-one", "Escape")).toBe(true);
  });
});

describe("shouldCloseOnOutside — outside the ref AND topmost", () => {
  const inside: Containable = { contains: () => true };
  const outside: Containable = { contains: () => false };
  const targetStub = {} as Node; // opaque — the mock's `contains` never inspects it

  it("closes only when the target is outside the container AND this overlay is topmost", () => {
    let stack = pushOverlay(EMPTY_OVERLAY_STACK, "popover-a");
    stack = pushOverlay(stack, "popover-b"); // b is topmost
    expect(shouldCloseOnOutside(stack, "popover-b", outside, targetStub)).toBe(true);
  });

  it("a background overlay never eats a click meant for the foreground one", () => {
    let stack = pushOverlay(EMPTY_OVERLAY_STACK, "popover-a");
    stack = pushOverlay(stack, "popover-b");
    // the click landed outside A's own DOM too, but A isn't topmost — B is in
    // front, so A must stay open (this is what stops a background overlay from
    // closing itself on a click actually meant for the foreground one).
    expect(shouldCloseOnOutside(stack, "popover-a", outside, targetStub)).toBe(false);
  });

  it("a target INSIDE the container never closes, even when topmost", () => {
    const stack = pushOverlay(EMPTY_OVERLAY_STACK, "popover");
    expect(shouldCloseOnOutside(stack, "popover", inside, targetStub)).toBe(false);
  });

  it("a null container (ref not yet attached) fails safe — never closes", () => {
    const stack = pushOverlay(EMPTY_OVERLAY_STACK, "popover");
    expect(shouldCloseOnOutside(stack, "popover", null, targetStub)).toBe(false);
  });

  it("an id not in the stack never closes, regardless of the container", () => {
    const stack = pushOverlay(EMPTY_OVERLAY_STACK, "popover");
    expect(shouldCloseOnOutside(stack, "unregistered", outside, targetStub)).toBe(false);
  });
});
