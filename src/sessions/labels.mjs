// zuzuu/sessions/labels.mjs — user-given session labels (W1-B).
//
// A label is a human name for a session ("fix auth bug") shown in the workbench
// instead of just the host. Stored in `.zuzuu/session-labels.json` as { id:
// label } — deliberately SEPARATE from the capture-managed index
// (sessions.json), whose records are REPLACED on every re-capture
// (store.upsertSession). Keeping labels in a side map means a rename survives
// re-capture. Fail-soft: a missing/corrupt file reads as {}.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { paths } from '../kernel/store.mjs'; // 8b: re-pointed off v1 core onto the kernel

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
