// src/sessions/labels.mjs — user-given session labels (W1-B).
//
// what: a human name for a session ("fix auth bug"), stored in
//       `.zuzuu/session-labels.json` as { id: label } and shown in the workbench
//       instead of just the host.
// why:  kept deliberately SEPARATE from the capture-managed index (sessions.json),
//       whose records are replaced on every re-capture — so a rename survives.
// how:  read/write a small JSON side-map; fail-soft (missing/corrupt → {}). Zero-dep.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { paths } from '../notes/store.mjs'; // 8b: re-pointed off v1 core onto the substrate

const labelsFile = (cwd) => join(paths(cwd).home, 'session-labels.json');

/** { id: label } for this home, or {} (fail-soft on missing/corrupt). */
export function readSessionLabels(cwd = process.cwd()) {
  try {
    const f = labelsFile(cwd);
    if (!existsSync(f)) return {};
    const data = JSON.parse(readFileSync(f, 'utf8'));
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
}

/** Set (or, with a blank label, clear) one session's label. Returns the map. */
export function setSessionLabel(cwd, id, label) {
  const map = readSessionLabels(cwd);
  const trimmed = String(label ?? '').trim();
  if (trimmed) map[id] = trimmed;
  else delete map[id];
  const f = labelsFile(cwd);
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, JSON.stringify(map, null, 2) + '\n');
  return map;
}
