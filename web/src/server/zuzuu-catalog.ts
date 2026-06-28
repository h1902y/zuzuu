// src/server/zuzuu-catalog.ts — the daemon's argv source: a typed mirror of the CLI's
// command catalog (`zz commands --json`, src/cli/commands.mjs commandCatalog()).
//
// The daemon is out-of-process (it must NOT import src/), yet it shells `zz` for every
// brain read/write. It once hand-typed argv arrays here — which is how it ended up
// shelling NONEXISTENT verbs (`module new` / `generation mint`, the live bug). This
// module closes that class structurally: `runCommand*` build argv ONLY from a
// (commandId → spec) lookup, so the daemon can only shell commands the table KNOWS, and
// `commandId` is `keyof typeof COMMAND_CATALOG` — a typo is a COMPILE error (tsc), an
// unknown id at runtime is REFUSED (buildZuzuuArgv throws). The static catalog is proven
// to byte-equal the live CLI's catalog by zuzuu-catalog.test.ts (the table drives the
// daemon; drift fails CI), so there is no startup spawn to load it — the hot path is
// untouched, and CLI-absent still degrades exactly as before (the spawn, not the catalog,
// is what's missing).
//
// A spec is `{ id, path, params, flags }`: `path` is the fixed argv prefix, `params` an
// ordered positional list (a string is a named placeholder; `{const}` a literal — the
// deprecated key-first `module <m> rollback|generations` shapes), `flags` maps a named
// param → its `--flag` (emitted only when a value is supplied, matching the old
// conditional `args.push`). The `module items` query flags ride as pre-validated `extra`.

import { runZuzuu, runZuzuuMut, runZuzuuText, type RunOpts, type ZuzuuMutResult } from "./zuzuu-cli.js";

export type ParamSpec = string | { const: string };
export interface CommandSpec {
  id: string;
  path: string[];
  params: ParamSpec[];
  /** named param → `--cli-flag`; insertion order is the argv order. */
  flags: Record<string, string>;
}

/** The daemon's slice of the CLI catalog — only the commands it shells. Each entry must
 *  byte-equal the live `zz commands --json` entry of the same id (zuzuu-catalog.test.ts).
 *  Flag-object key order IS the argv order, so it's authored to match the old call sites. */
export const COMMAND_CATALOG = {
  // ── module reads (the dashboard CRUD surface) ──
  "module.overview": { id: "module.overview", path: ["module", "overview"], params: [], flags: {} },
  "module.items": { id: "module.items", path: ["module", "items"], params: ["key"], flags: {} },
  "module.item": { id: "module.item", path: ["module", "item"], params: ["key", "id"], flags: {} },
  "module.schema": { id: "module.schema", path: ["module", "schema"], params: ["key"], flags: {} },
  // deprecated key-first lineage read (the daemon still shells this shape; argv-faithful)
  "module.generations": { id: "module.generations", path: ["module"], params: ["key", { const: "generations" }], flags: {} },
  // ── module lifecycle writes ──
  "module.new": { id: "module.new", path: ["module", "new"], params: ["id"], flags: { title: "--title", tagline: "--tagline", capabilities: "--capabilities", kinds: "--kinds", required: "--required" } },
  "module.enable": { id: "module.enable", path: ["module", "enable"], params: ["key"], flags: {} },
  "module.disable": { id: "module.disable", path: ["module", "disable"], params: ["key"], flags: {} },
  // deprecated key-first rollback (no `generation` subword — Rung 9's reconciled shape)
  "module.rollback": { id: "module.rollback", path: ["module"], params: ["key", { const: "rollback" }, "id"], flags: {} },
  // ── the review gate + the write entry-door ──
  "review.approve": { id: "review.approve", path: ["review", "approve"], params: ["module", "id"], flags: {} },
  "review.reject": { id: "review.reject", path: ["review", "reject"], params: ["module", "id"], flags: { reason: "--reason" } },
  "stage": { id: "stage", path: ["stage"], params: ["module"], flags: { op: "--op", target: "--target", change: "--change" } },
  "act": { id: "act", path: ["act"], params: ["module", "id"], flags: {} },
  "gen.mint": { id: "gen.mint", path: ["gen", "mint"], params: ["module"], flags: { from: "--from" } },
  "session.label": { id: "session.label", path: ["session", "label"], params: ["id"], flags: { text: "--text" } },
  // ── readiness text reads (no --json mode) ──
  "doctor": { id: "doctor", path: ["doctor"], params: [], flags: {} },
  "digest": { id: "digest", path: ["digest"], params: [], flags: {} },
} as const satisfies Record<string, CommandSpec>;

/** A command id the daemon may shell — anything else is a COMPILE error (tsc catches the
 *  typo before it can ever reach a spawn). The structural half of the moat on the daemon. */
export type CommandId = keyof typeof COMMAND_CATALOG;

/** Thrown when a commandId or a required positional isn't in the catalog — the
 *  nonexistent-verb bug class, refused before any spawn. */
export class UnknownCommandError extends Error {
  constructor(message: string) { super(message); this.name = "UnknownCommandError"; }
}

/** Build the zz argv for a catalog command from named params (+ optional pre-validated
 *  trailing `extra`, e.g. the `module items` query flags). Refuses an id the catalog
 *  doesn't know or a missing required positional. A flag is emitted only when its param
 *  is supplied (undefined/null omit it); positionals are always present. Pure → unit-tested. */
export function buildZuzuuArgv(
  commandId: CommandId,
  params: Record<string, string | undefined> = {},
  extra: string[] = [],
): string[] {
  const spec: CommandSpec | undefined = (COMMAND_CATALOG as Record<string, CommandSpec>)[commandId];
  if (!spec) throw new UnknownCommandError(`unknown zuzuu command '${commandId}' — not in the catalog`);
  const argv = [...spec.path];
  for (const p of spec.params) {
    if (typeof p === "string") {
      const v = params[p];
      if (v === undefined || v === null) throw new UnknownCommandError(`zuzuu command '${commandId}' is missing required param '${p}'`);
      argv.push(String(v));
    } else {
      argv.push(p.const);
    }
  }
  for (const [name, flag] of Object.entries(spec.flags)) {
    const v = params[name];
    if (v !== undefined && v !== null) argv.push(flag, String(v));
  }
  return [...argv, ...extra];
}

export interface CommandOpts extends RunOpts { extra?: string[]; }

/** A read via the catalog: build the argv, then shell `zz … --json` (runZuzuu). An
 *  unknown id / bad params (a daemon bug, not CLI-absence) degrades to null like a read
 *  miss — the caller's peek fallback covers it; never a crash. */
export function runCommand(root: string, commandId: CommandId, params?: Record<string, string | undefined>, opts: CommandOpts = {}): Promise<unknown | null> {
  let argv: string[];
  try { argv = buildZuzuuArgv(commandId, params, opts.extra); } catch { return Promise.resolve(null); }
  return runZuzuu(root, argv, opts);
}

/** A text read via the catalog (verbs with no --json mode: doctor/digest). */
export function runCommandText(root: string, commandId: CommandId, params?: Record<string, string | undefined>, opts: CommandOpts = {}): Promise<string | null> {
  let argv: string[];
  try { argv = buildZuzuuArgv(commandId, params, opts.extra); } catch { return Promise.resolve(null); }
  return runZuzuuText(root, argv, opts);
}

/** A mutation via the catalog: build the argv, then shell `zz … --json` (runZuzuuMut). An
 *  unknown id / bad params is REFUSED as `{ok:false, code:"failed"}` (no spawn) so the
 *  route answers 502 rather than executing a verb the table doesn't have. */
export function runCommandMut(root: string, commandId: CommandId, params?: Record<string, string | undefined>, opts: CommandOpts = {}): Promise<ZuzuuMutResult> {
  let argv: string[];
  try { argv = buildZuzuuArgv(commandId, params, opts.extra); }
  catch (e) { return Promise.resolve({ ok: false, code: "failed", stderr: (e as Error).message }); }
  return runZuzuuMut(root, argv, opts);
}
