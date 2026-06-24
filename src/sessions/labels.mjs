// src/sessions/labels.mjs — user-given session labels (W1-B).
//
// what: a human name for a session ("fix auth bug"), stored in
//       `.zuzuu/session-labels.json` as { id: label } and shown in the workbench
//       instead of just the host.
// why:  a human name survives across sessions independent of the git-branch
//       lifecycle — a small, durable side-map keyed by session id.
// how:  read/write a small JSON side-map; fail-soft (missing/corrupt → {}). Zero-dep.

import { join } from 'node:path';
import { homeDir, repoRoot, readJson, writeJson } from '../notes/store.mjs';

const labelsFile = (cwd) => join(homeDir(repoRoot(cwd)), 'session-labels.json');

/** { id: label } for this home, or {} (fail-soft on missing/corrupt). */
export function readSessionLabels(cwd = process.cwd()) {
  const data = readJson(labelsFile(cwd), {});
  return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
}

/** Set (or, with a blank label, clear) one session's label. Returns the map. */
export function setSessionLabel(cwd, id, label) {
  const map = readSessionLabels(cwd);
  const trimmed = String(label ?? '').trim();
  if (trimmed) map[id] = trimmed;
  else delete map[id];
  writeJson(labelsFile(cwd), map);
  return map;
}
