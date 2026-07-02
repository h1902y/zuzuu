// The field-config panel's pure model (§H.5): FieldDef ⟷ panel state ⟷ the
// daemon's ColumnFieldBody, the options editor, and the `default: now` sentinel
// round-trip.
import { describe, it, expect } from "vitest";
import {
  stateFromField,
  optionHue,
  addOption,
  removeOption,
  renameOption,
  takesOptions,
  offersNowDefault,
  isValid,
  toBody,
  type FieldConfigState,
} from "../../src/client/shell/stage/field-config-model.js";
import type { FieldDef } from "../../src/client/data/field-registry.js";

describe("stateFromField — seed panel state from a FieldDef (or blank for add mode)", () => {
  it("null field → a blank add-mode slate, carrying the typed-ahead name", () => {
    expect(stateFromField(null, "priority")).toEqual({
      name: "priority", label: "", type: "text", computed: false, formula: "",
      options: [], required: false, defaultMode: "none", defaultValue: "", description: "",
    });
  });
  it("a plain field round-trips label/required/description", () => {
    const field: FieldDef = { name: "owner", type: "text", label: "Owner", required: true, description: "who owns this" };
    const s = stateFromField(field);
    expect(s).toMatchObject({ name: "owner", label: "Owner", type: "text", required: true, description: "who owns this", defaultMode: "none" });
  });
  it("a select field carries its options", () => {
    const field: FieldDef = { name: "stage", type: "select", options: ["lead", "won", "lost"] };
    expect(stateFromField(field).options).toEqual(["lead", "won", "lost"]);
  });
  it("a computed field: computed=true, formula carries, defaultMode stays 'none'", () => {
    const field: FieldDef = { name: "end_date", type: "date", computed: "dateAdd(start_date,duration_days)" };
    const s = stateFromField(field);
    expect(s.computed).toBe(true);
    expect(s.formula).toBe("dateAdd(start_date,duration_days)");
    expect(s.defaultMode).toBe("none");
  });
  it("`default: now` on a date column → defaultMode 'now', NOT the literal string in defaultValue", () => {
    const field: FieldDef = { name: "occurred_on", type: "date", default: "now" };
    const s = stateFromField(field);
    expect(s.defaultMode).toBe("now");
    expect(s.defaultValue).toBe("");
  });
  it("a static default (any other value, any type) → defaultMode 'static'", () => {
    expect(stateFromField({ name: "tier", type: "number", default: "3" }).defaultMode).toBe("static");
    expect(stateFromField({ name: "tier", type: "number", default: "3" }).defaultValue).toBe("3");
    // 'now' on a NON-date column is a plain literal (the CLI's own rule) — static, not the sentinel
    expect(stateFromField({ name: "label", type: "text", default: "now" }).defaultMode).toBe("static");
  });
});

describe("optionHue — a stable hue per option value (§H.4.4 pill previews)", () => {
  it("is deterministic and spans 0..359", () => {
    expect(optionHue("lead")).toBe(optionHue("lead"));
    expect(optionHue("lead")).toBeGreaterThanOrEqual(0);
    expect(optionHue("lead")).toBeLessThan(360);
  });
  it("different values (usually) land on different hues", () => {
    expect(optionHue("lead")).not.toBe(optionHue("won"));
  });
});

describe("the options editor — add/remove/rename, pure", () => {
  it("addOption trims, appends, and is a no-op on blank or duplicate", () => {
    expect(addOption([], "  lead  ")).toEqual(["lead"]);
    expect(addOption(["lead"], "won")).toEqual(["lead", "won"]);
    expect(addOption(["lead"], "  ")).toEqual(["lead"]);
    expect(addOption(["lead"], "lead")).toEqual(["lead"]);
  });
  it("removeOption drops the exact value only", () => {
    expect(removeOption(["lead", "won", "lost"], "won")).toEqual(["lead", "lost"]);
    expect(removeOption(["lead"], "nope")).toEqual(["lead"]);
  });
  it("renameOption keeps position; no-op on blank or a collision with a DIFFERENT option", () => {
    expect(renameOption(["lead", "won"], "lead", "prospect")).toEqual(["prospect", "won"]);
    expect(renameOption(["lead", "won"], "lead", "  ")).toEqual(["lead", "won"]);
    expect(renameOption(["lead", "won"], "lead", "won")).toEqual(["lead", "won"]);
    // renaming to its OWN current value is a legal no-op change (not a collision)
    expect(renameOption(["lead", "won"], "lead", "lead")).toEqual(["lead", "won"]);
  });
});

describe("takesOptions / offersNowDefault — per-type panel affordances", () => {
  it("only select/multi take an options list", () => {
    expect(takesOptions("select")).toBe(true);
    expect(takesOptions("multi")).toBe(true);
    expect(takesOptions("text")).toBe(false);
    expect(takesOptions("date")).toBe(false);
  });
  it("only date offers the 'current date' toggle", () => {
    expect(offersNowDefault("date")).toBe(true);
    expect(offersNowDefault("text")).toBe(false);
    expect(offersNowDefault("number")).toBe(false);
  });
});

const base = (over: Partial<FieldConfigState> = {}): FieldConfigState => ({
  name: "tier", label: "Tier", type: "number", computed: false, formula: "",
  options: [], required: false, defaultMode: "none", defaultValue: "", description: "",
  ...over,
});

describe("isValid — the Save-button gate", () => {
  it("a blank name is invalid", () => {
    expect(isValid(base({ name: "" }))).toBe(false);
    expect(isValid(base({ name: "   " }))).toBe(false);
  });
  it("select/multi need at least one option", () => {
    expect(isValid(base({ type: "select", options: [] }))).toBe(false);
    expect(isValid(base({ type: "select", options: ["lead"] }))).toBe(true);
  });
  it("the ƒ toggle needs a non-blank formula", () => {
    expect(isValid(base({ computed: true, formula: "" }))).toBe(false);
    expect(isValid(base({ computed: true, formula: "dateAdd(a,b)" }))).toBe(true);
  });
  it("a plain valid field passes", () => {
    expect(isValid(base())).toBe(true);
  });
});

describe("toBody — panel state → the daemon's ColumnFieldBody (Save payload)", () => {
  it("a plain field: type/required/label/description, computed cleared, no default", () => {
    expect(toBody(base({ label: " Tier ", description: " priority tier " }))).toEqual({
      type: "number", required: false, label: "Tier", description: "priority tier", computed: "",
    });
  });
  it("select/multi carry their options list", () => {
    expect(toBody(base({ type: "select", options: ["lead", "won"] }))).toMatchObject({ type: "select", options: ["lead", "won"] });
  });
  it("defaultMode 'static' sends the trimmed value; blank static value sends none", () => {
    expect(toBody(base({ defaultMode: "static", defaultValue: " 3 " })).default).toBe("3");
    expect(toBody(base({ defaultMode: "static", defaultValue: "  " })).default).toBeUndefined();
  });
  it("defaultMode 'now' sends the literal sentinel string", () => {
    expect(toBody(base({ type: "date", defaultMode: "now" })).default).toBe("now");
  });
  it("the ƒ toggle ON sends the trimmed formula and OMITS default entirely (leaves it untouched on alter)", () => {
    const body = toBody(base({ type: "date", computed: true, formula: " dateAdd(start_date,duration_days) ", defaultMode: "now" }));
    expect(body.computed).toBe("dateAdd(start_date,duration_days)");
    expect(body.default).toBeUndefined();
  });
  it("round-trip: stateFromField → toBody reproduces an equivalent field (idempotent re-save)", () => {
    const field: FieldDef = { name: "occurred_on", type: "date", label: "Occurred", default: "now", description: "when it happened" };
    const body = toBody(stateFromField(field));
    expect(body).toEqual({ type: "date", required: false, label: "Occurred", description: "when it happened", computed: "", default: "now" });
  });
});
