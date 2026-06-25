// src/notes/project.mjs — the Project manifest (`project.md`).
//
// what: read the Project's own manifest envelope — the top of the hierarchy
//       (note › module › Project). `project.md` (type: project) declares the
//       Project's identity (title, format version) + carries the human explainer
//       as its body. Symmetric with notes/module.mjs `readManifest`.
// why:  a Project is an envelope too, so it declares itself — same as a module's
//       module.md and a note. Surfaces (digest, status, a future Project view, the
//       org roll-up) read identity here instead of guessing from the dir name.
// how:  parse `.zuzuu/project.md` with notes/note. Fail-soft — a missing/broken
//       manifest yields a minimal default, never throws. Zero-dep.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from './note.mjs';

const projectPath = (home) => join(home, 'project.md');

/**
 * Read the Project manifest. Fail-soft: missing/unparseable → a minimal default.
 * `steering` is the optional human-authored session-steering block (goals · opener ·
 * closer · drift) — a tolerant frontmatter map; absent/garbage → `{}`, never throws.
 * Only `goals` is consumed today (by the digest); the rest ride along round-trip-exact.
 * @returns {{ type, title, format, steering, body }}
 */
export function readProject(home) {
  const fallback = { type: 'project', title: null, format: null, steering: {}, body: '' };
  const path = projectPath(home);
  if (!existsSync(path)) return fallback;
  const { ok, note } = parse(readFileSync(path, 'utf8'), { id: 'project' });
  if (!ok || !note) return { ...fallback, manifestError: 'unparseable project.md' };
  const steering = note.steering && typeof note.steering === 'object' && !Array.isArray(note.steering) ? note.steering : {};
  // `role` distinguishes an ordinary Project from a `role: registry` repo (the OSS
  // registry — a binding manifest + module library, never an aggregate brain).
  return { type: 'project', title: note.title ?? null, format: note.format ?? null, role: note.role ?? null, steering, body: note.body ?? '' };
}
