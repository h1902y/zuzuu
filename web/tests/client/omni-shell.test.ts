// omnibar/omni-shell.ts — the view stack + row grammar (§E.1/§E.2).
import { describe, it, expect } from "vitest";
import { emptyStack, push, pop, top, placeholderFor, hintFor, laneBadge } from "../../src/client/omnibar/omni-shell.js";
import type { PaletteCommand } from "../../src/client/palette/palette-commands.js";

const row = (over: Partial<PaletteCommand> = {}): PaletteCommand => ({
  value: "v", label: "Brahman", action: { kind: "noop" }, ...over,
});

describe("the view stack", () => {
  it("pushes and pops; root is the implicit bottom", () => {
    let s = emptyStack;
    expect(top(s)).toBeNull();
    s = push(s, { kind: "actions", row: row() });
    expect(top(s)).toMatchObject({ kind: "actions" });
    s = push(s, { kind: "chat", id: "abc" });
    expect(top(s)).toMatchObject({ kind: "chat", id: "abc" });
    s = pop(s);
    expect(top(s)).toMatchObject({ kind: "actions" });
    s = pop(s);
    expect(top(s)).toBeNull();
    expect(top(pop(s))).toBeNull(); // popping the root is safe
  });

  it("the breadcrumb lives in the placeholder", () => {
    expect(placeholderFor(emptyStack)).toMatch(/find anything/);
    expect(placeholderFor(push(emptyStack, { kind: "actions", row: row() }))).toMatch(/Brahman — actions/);
    expect(placeholderFor(push(emptyStack, { kind: "chat", id: "x" }))).toMatch(/esc back/);
  });
});

describe("the row grammar", () => {
  it("a row with an action panel teaches Tab; an explicit hint wins", () => {
    expect(hintFor(row())).toBeNull();
    expect(hintFor(row({ actions: [row()] }))).toBe("⇥ actions");
    expect(hintFor(row({ hint: "R", actions: [row()] }))).toBe("R");
  });

  it("the two lanes render as badges; navigation stays quiet", () => {
    expect(laneBadge("instant")).toBe("instant");
    expect(laneBadge("proposal")).toBe("proposal");
    expect(laneBadge("nav")).toBeNull();
    expect(laneBadge(undefined)).toBeNull();
  });
});
