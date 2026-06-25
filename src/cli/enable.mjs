// src/cli/enable.mjs — install/remove the host's lifecycle + gate hooks.
//
// what: `zz enable` writes the zuzuu hook block into the host's settings
//       (Claude Code: .claude/settings.json) so the agent's lifecycle events +
//       every tool call route through `zz hook`; `zz disable` removes ONLY our
//       entries. Idempotent, never clobbers the user's own hooks.
// why:  this is what makes observe + the guardrails gate actually fire during a
//       real session, without the user wiring anything.
// how:  pure settings transforms tagged by a stable SIGNATURE in the command
//       string (survives the bin rename at cull). The command ends `|| true` so
//       a missing/broken zuzuu can never block the host. v2-native (no v1 deps).

import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { repoRoot, readJson, writeJson } from '../notes/store.mjs';

const BIN = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'bin', 'zuzuu.mjs');
const SIGNATURE = '#zz-hook'; // a stable tag in the command, independent of the bin path
const commandFor = (event) => `node "${BIN}" hook ${event} || true ${SIGNATURE}`;

const LIFECYCLE = ['SessionStart', 'Stop', 'SessionEnd'];
const GATE = ['PreToolUse'];
const ALL = [...LIFECYCLE, ...GATE];
// The whole `.zuzuu/` is the agent's served home and stays readable. The session
// run-state + gate log that used to need fencing now live OUTSIDE the repo (XDG
// state dir — the agent can't reach it), so no self-deny rule is needed.
const DENY_RULES = [];

const settingsPath = (cwd) => join(repoRoot(cwd), '.claude', 'settings.json');
const readSettings = (p) => readJson(p, {});
const writeSettings = (p, obj) => writeJson(p, obj);
const clone = (o) => JSON.parse(JSON.stringify(o ?? {}));
const tagged = (cmd) => String(cmd).includes(SIGNATURE);
const hasOurs = (matchers) => (matchers || []).some((m) => (m.hooks || []).some((h) => tagged(h.command)));

/** Add our hook block + deny rules (only what's missing). Pure. */
export function addHooks(settings) {
  const s = clone(settings);
  s.hooks ||= {};
  for (const ev of ALL) { s.hooks[ev] ||= []; if (!hasOurs(s.hooks[ev])) s.hooks[ev].push({ hooks: [{ type: 'command', command: commandFor(ev) }] }); }
  if (DENY_RULES.length) { // don't write an empty permissions.deny into the user's settings
    s.permissions ||= {}; s.permissions.deny ||= [];
    for (const r of DENY_RULES) if (!s.permissions.deny.includes(r)) s.permissions.deny.push(r);
  }
  return s;
}

/** Remove ONLY our entries; keep the user's. Pure. */
export function removeHooks(settings) {
  const s = clone(settings);
  if (s.hooks) {
    for (const ev of Object.keys(s.hooks)) {
      s.hooks[ev] = (s.hooks[ev] || []).filter((m) => !(m.hooks || []).some((h) => tagged(h.command)));
      if (!s.hooks[ev].length) delete s.hooks[ev];
    }
    if (!Object.keys(s.hooks).length) delete s.hooks;
  }
  if (s.permissions?.deny) {
    s.permissions.deny = s.permissions.deny.filter((r) => !DENY_RULES.includes(r));
    if (!s.permissions.deny.length) delete s.permissions.deny;
    if (s.permissions && !Object.keys(s.permissions).length) delete s.permissions;
  }
  return s;
}

/** True if our hooks are present for every lifecycle + gate event. */
export function isInstalled(settings) {
  return ALL.every((ev) => hasOurs(settings?.hooks?.[ev]));
}

/** Install the Claude Code hook block. Returns {ok, path, installed}. */
export function enable(cwd = process.cwd()) {
  const path = settingsPath(cwd);
  writeSettings(path, addHooks(readSettings(path)));
  return { ok: true, path, installed: isInstalled(readSettings(path)) };
}

/** True if the host hooks are installed in this repo. */
export function hooksInstalled(cwd = process.cwd()) {
  return isInstalled(readSettings(settingsPath(cwd)));
}

/** Remove ONLY zuzuu's entries. Returns {ok, path, removed}. */
export function disable(cwd = process.cwd()) {
  const path = settingsPath(cwd);
  if (!existsSync(path)) return { ok: true, path, removed: false };
  writeSettings(path, removeHooks(readSettings(path)));
  return { ok: true, path, removed: true };
}
