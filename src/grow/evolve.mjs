// src/grow/evolve.mjs — the single-change write path (sugar over commit).
//
// what: `evolve(home, module, staged)` — apply ONE approved staged change and mint a
//       generation. The convenience the loop's 4th beat reads as: write the note + log
//       the mutation + mint, for one change.
// why:  there is exactly ONE writer now — `grow/commit` (the moat). `evolve` is a
//       batch-of-one over it, kept as a named single-change entry point (review's gate,
//       grow/edit's scoped writes). Keeping it thin is the point: no second write path,
//       no second minter — just commit with a one-op batch.
// how:  normalize the staged change into a commit op (inject the module), commit it,
//       and unwrap the single result. Zero-dep, fail-soft.

import { commit } from './commit.mjs';

/**
 * Apply an approved staged change AND mint a generation — the single-change path
 * (review.approve, grow/edit). A multi-change batch goes straight to `commit` (grow/plan).
 * @returns {{ ok, op?, note?, error? }}
 */
export function evolve(home, module, staged, actor = 'operator') {
  const res = commit(home, { actor }, [{ ...staged, module }], {
    mintedFrom: [staged.id],
    label: `${staged.op} ${module}`,
  });
  if (!res.ok) return { ok: false, error: res.error, refused: res.refused };
  return res.results[0];
}
