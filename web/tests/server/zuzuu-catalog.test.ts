// The daemon command catalog (zuzuu-catalog.ts): the (commandId, params) → argv builder
// the dashboard CRUD surface shells through. Three properties:
//   1. builder  — each migrated command builds the argv the daemon used to hand-type
//   2. refusal  — an unknown commandId / a missing required param is REFUSED, no spawn
//                 (the nonexistent-verb bug class — `module new` / `generation mint` —
//                  structurally closed)
//   3. no drift — the static catalog byte-equals the live `zz commands --json` (the table
//                 drives the daemon; a renamed/added verb that desyncs fails THIS test)
import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  buildZuzuuArgv,
  runCommandMut,
  COMMAND_CATALOG,
  UnknownCommandError,
  type CommandId,
  type CommandSpec,
} from "../../src/server/zuzuu-catalog.js";

// the bundled CLI, repo layout: web/tests/server → repo/bin/zuzuu.mjs
const BIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../bin/zuzuu.mjs");

describe("buildZuzuuArgv — the (commandId, params) → argv builder", () => {
  // each row: [commandId, params, extra, expected argv] — the exact bytes the old hand-typed
  // call sites produced (runZuzuuMut appends --json afterward, not part of the build).
  const CASES: [CommandId, Record<string, string | undefined>, string[] | undefined, string[]][] = [
    ["review.approve", { module: "knowledge", id: "p1" }, undefined, ["review", "approve", "knowledge", "p1"]],
    ["review.reject", { module: "knowledge", id: "p1", reason: "dup; $(rm -rf) of k1" }, undefined, ["review", "reject", "knowledge", "p1", "--reason", "dup; $(rm -rf) of k1"]],
    ["review.reject", { module: "knowledge", id: "p1", reason: undefined }, undefined, ["review", "reject", "knowledge", "p1"]],
    ["module.new", { id: "recipes", title: "Recipes", tagline: "cook things", capabilities: "items.collection,mine", kinds: "note", required: "body" }, undefined,
      ["module", "new", "recipes", "--title", "Recipes", "--tagline", "cook things", "--capabilities", "items.collection,mine", "--kinds", "note", "--required", "body"]],
    ["module.new", { id: "notes", capabilities: "items.collection", kinds: "note", title: undefined, tagline: undefined, required: undefined }, undefined,
      ["module", "new", "notes", "--capabilities", "items.collection", "--kinds", "note"]],
    ["module.enable", { key: "knowledge" }, undefined, ["module", "enable", "knowledge"]],
    ["module.disable", { key: "knowledge" }, undefined, ["module", "disable", "knowledge"]],
    ["module.rollback", { key: "knowledge", id: "2" }, undefined, ["module", "knowledge", "rollback", "2"]],
    ["gen.mint", { module: "knowledge", from: "p1,p2" }, undefined, ["gen", "mint", "knowledge", "--from", "p1,p2"]],
    ["gen.mint", { module: "knowledge", from: undefined }, undefined, ["gen", "mint", "knowledge"]],
    ["stage", { module: "knowledge", op: "create", target: "demo", change: '{"type":"knowledge"}' }, undefined,
      ["stage", "knowledge", "--op", "create", "--target", "demo", "--change", '{"type":"knowledge"}']],
    ["stage", { module: "knowledge", op: "relate", target: undefined, change: "{}" }, undefined, ["stage", "knowledge", "--op", "relate", "--change", "{}"]],
    ["act", { module: "approve", id: "my-slug" }, undefined, ["act", "approve", "my-slug"]],
    ["session.label", { id: "abc", text: "hot" }, undefined, ["session", "label", "abc", "--text", "hot"]],
    ["session.label", { id: "abc", text: "" }, undefined, ["session", "label", "abc", "--text", ""]], // blank clears, still supplied
    ["module.overview", {}, undefined, ["module", "overview"]],
    ["module.item", { key: "knowledge", id: "k1" }, undefined, ["module", "item", "knowledge", "k1"]],
    ["module.schema", { key: "knowledge" }, undefined, ["module", "schema", "knowledge"]],
    ["module.generations", { key: "knowledge" }, undefined, ["module", "knowledge", "generations"]],
    ["module.items", { key: "knowledge" }, ["--text", "blue", "--where", "p=high"], ["module", "items", "knowledge", "--text", "blue", "--where", "p=high"]],
  ];
  for (const [id, params, extra, want] of CASES) {
    it(`${id} (${JSON.stringify(params)}) → ${want.join(" ")}`, () => {
      expect(buildZuzuuArgv(id, params, extra)).toEqual(want);
    });
  }
});

describe("buildZuzuuArgv — refusal (the structural bug-prevention)", () => {
  it("an unknown commandId throws UnknownCommandError (no argv built)", () => {
    // `module new`/`generation mint` were the live bug — a verb the table never had.
    expect(() => buildZuzuuArgv("generation.mint" as CommandId, { module: "x" })).toThrow(UnknownCommandError);
    expect(() => buildZuzuuArgv("module.bogus" as CommandId, {})).toThrow(/not in the catalog/);
  });
  it("a missing required positional throws", () => {
    expect(() => buildZuzuuArgv("review.approve", { module: "knowledge" })).toThrow(/missing required param 'id'/);
  });
});

describe("runCommandMut — refuses an unknown command WITHOUT spawning", () => {
  it("unknown id → {ok:false} (the route answers 502, the binary is never run)", async () => {
    // root + binary are irrelevant: the refusal happens at argv-build, before any spawn.
    const r = await runCommandMut("/nonexistent", "module.new.typo" as CommandId, { id: "x" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("failed");
  });
  it("CLI-absent (real id) → {ok:false, code:'absent'} — degrades, never throws", async () => {
    const r = await runCommandMut("/tmp", "module.enable", { key: "knowledge" }, { binary: "definitely-not-a-real-binary-zzz" });
    expect(r).toEqual({ ok: false, code: "absent" });
  });
});

describe("the static catalog byte-equals `zz commands --json` (no drift)", () => {
  it("every daemon spec matches the live CLI catalog entry of the same id", () => {
    const res = spawnSync(process.execPath, [BIN, "commands", "--json"], { encoding: "utf8", timeout: 10_000 });
    expect(res.status).toBe(0);
    const live = JSON.parse(res.stdout) as { commands: CommandSpec[] };
    const byId = new Map(live.commands.map((c) => [c.id, c]));
    for (const spec of Object.values(COMMAND_CATALOG) as CommandSpec[]) {
      const liveSpec = byId.get(spec.id);
      expect(liveSpec, `the CLI catalog carries '${spec.id}'`).toBeDefined();
      // deep-equal proves path + params (incl. {const} literals) + flags match the table
      expect(liveSpec).toEqual(spec);
    }
  });
});
