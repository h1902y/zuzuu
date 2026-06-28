// src/grow/review.mjs — the human gate.
//
// what: the decision. Look up a pending staged change and dispose it — approve (run
//       `evolve` to write+mint+log, then archive) or reject (archive, write
//       nothing). This is the ONLY door to the Project.
// why:  the moat — the one defense against knowledge-poisoning that every
//       automated competitor lacks. No write happens without passing here. Keeping
//       review = decision only (the writing lives in `evolve`) is what makes the
//       ontology's observe → stage → review → evolve read as four named beats.
// how:  approve = readStaged → commit (the one write boundary) → archive-on-success;
//       reject = archive. The interactive ceremony is a thin CLI wrapper over these.
//       Zero-dep, fail-soft.

import { commit } from './commit.mjs';
import { readStaged, archiveStaged } from './stage.mjs';

/**
 * Approve a staged change: hand it to `commit` as a one-op batch and, on success, archive
 * it (consumed). The `actor` is threaded from the boundary — approve IS the human gate, so
 * it's `operator` in practice; commit REFUSES a non-operator (an agent can't approve its own
 * proposal in-process), and a refused/failed commit leaves it staged — a retry is safe
 * (writes are idempotent), so a partial failure never double-applies on re-approve.
 * @returns {{ ok, op?, note?, error?, refused? }}
 */
export function approve(home, module, id, actor = 'operator') {
  const p = readStaged(home, module, id);
  if (!p) return { ok: false, error: `no staged change '${id}'` };
  const res = commit(home, { actor }, [{ ...p, module }], { mintedFrom: [p.id], label: `${p.op} ${module}` });
  if (!res.ok) return { ok: false, error: res.error, refused: res.refused };
  const r = res.results[0];
  if (r.ok) archiveStaged(home, module, id, 'approved');
  return r;
}

/** Reject a staged change — archive it, write nothing. */
export function reject(home, module, id, reason = '') {
  if (!readStaged(home, module, id)) return { ok: false, error: `no staged change '${id}'` };
  archiveStaged(home, module, id, 'rejected');
  return { ok: true, rejected: id, reason };
}
