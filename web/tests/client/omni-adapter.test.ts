// §E.3 — the adapter: deterministic intent routing over the closed registry.
import { describe, expect, it } from "vitest";
import { resolveIntent, adapterGroup, agentFallback, ADAPTER_THRESHOLD } from "../../src/client/omnibar/omni-adapter.js";

const CTX = { modules: [{ id: "crm", title: "CRM" }, { id: "knowledge", title: "Knowledge" }] };

describe("resolveIntent (tier b)", () => {
  it("slot-fills a create: 'add a lead acme to crm' → pre-filled crm draft", () => {
    const r = resolveIntent("add a lead acme to crm", CTX);
    expect(r).not.toBeNull();
    expect(r!.action).toEqual({ kind: "draft-note", module: "crm", title: "acme" });
    expect(r!.lane).toBe("proposal"); // the draft STAGES — the gate decides
    expect(r!.score).toBeGreaterThanOrEqual(ADAPTER_THRESHOLD);
  });

  it("keeps meaningful words in the title slot", () => {
    const r = resolveIntent("create a note about vector clocks in knowledge", CTX);
    expect(r!.action).toEqual({ kind: "draft-note", module: "knowledge", title: "vector clocks" });
  });

  it("defaults a module-less create to knowledge, honestly labeled", () => {
    const r = resolveIntent("jot a note remember the milk", CTX);
    expect(r!.action.kind).toBe("draft-note");
    expect((r!.action as { module: string }).module).toBe("knowledge");
    expect(r!.label).toContain("knowledge");
  });

  it("routes projections: 'show knowledge as a map' → the island", () => {
    const r = resolveIntent("show knowledge as a map", CTX);
    expect(r!.action).toEqual({ kind: "world-module", id: "knowledge" });
    expect(r!.score).toBeGreaterThanOrEqual(ADAPTER_THRESHOLD);
  });

  it("routes projections: 'open crm rows' → the table", () => {
    const r = resolveIntent("open crm rows", CTX);
    expect(r!.action).toEqual({ kind: "open-module", id: "crm" });
  });

  it("routes the gate: 'review pending proposals'", () => {
    const r = resolveIntent("review pending proposals", CTX);
    expect(r!.action).toEqual({ kind: "review" });
  });

  it("routes 'zoom out the map' → fit", () => {
    expect(resolveIntent("zoom out the map", CTX)!.action).toEqual({ kind: "world-fit" });
  });

  it("stays silent on one word and on nonsense", () => {
    expect(resolveIntent("brahman", CTX)).toBeNull();
    expect(resolveIntent("purple monkey dishwasher", CTX)).toBeNull();
  });
});

describe("adapterGroup", () => {
  it("renders the resolution as the confirmable Do row", () => {
    const g = adapterGroup("add a lead acme to crm", CTX);
    expect(g!.heading).toBe("Do");
    expect(g!.commands[0]!.label).toContain("acme");
    expect(g!.commands[0]!.hint).toBe("↵ confirm");
  });

  it("offers ONLY the agent fallback for an unplaceable 3+ word intent", () => {
    const g = adapterGroup("summarize what changed this week", CTX);
    expect(g!.commands).toHaveLength(1);
    expect(g!.commands[0]!.label).toContain("Ask the agent");
    const action = g!.commands[0]!.action;
    expect(action.kind).toBe("converse");
    // the preamble points at the SANCTIONED channels — the gate stays the resolver
    expect((action as { prompt: string }).prompt).toContain("sanctioned");
  });

  it("stays out of prefix modes and short queries", () => {
    expect(adapterGroup(">fit the map", CTX)).toBeNull();
    expect(adapterGroup("/hello there friend", CTX)).toBeNull();
    expect(adapterGroup("crm", CTX)).toBeNull();
  });

  it("agentFallback carries the raw intent verbatim", () => {
    const row = agentFallback("do the thing");
    expect((row.action as { prompt: string }).prompt).toContain("do the thing");
    expect(row.lane).toBe("proposal");
  });
});
