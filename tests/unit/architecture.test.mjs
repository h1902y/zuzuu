// reading-the-code.md rule 6: the concept tree is an acyclic import graph, and
// only grow/ writes the brain. This pins both as executable documentation — it
// would have caught the grow⇄hosts cycle the ce review found.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src');

function srcFiles(dir = SRC, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) srcFiles(p, out);
    else if (e.endsWith('.mjs')) out.push(p);
  }
  return out;
}
const dirOf = (abs) => relative(SRC, abs).split('/')[0]; // the top-level concept dir
const importsOf = (abs) => [...readFileSync(abs, 'utf8').matchAll(/from '(\.\.?\/[^']+)'/g)]
  .map((m) => relative(SRC, join(dirname(abs), m[1])).split('/')[0]);

test('rule 6: the concept-directory import graph is acyclic (a DAG)', () => {
  // build dir → set of dirs it imports from
  const edges = new Map();
  for (const f of srcFiles()) {
    const from = dirOf(f);
    for (const to of importsOf(f)) if (to !== from && !to.startsWith('.')) (edges.get(from) ?? edges.set(from, new Set()).get(from)).add(to);
  }
  // DFS cycle detection
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map([...edges.keys()].map((k) => [k, WHITE]));
  const stack = [];
  const dfs = (n) => {
    color.set(n, GRAY); stack.push(n);
    for (const m of edges.get(n) ?? []) {
      if (color.get(m) === GRAY) assert.fail(`import cycle: ${[...stack, m].join(' → ')}`);
      if ((color.get(m) ?? WHITE) === WHITE) dfs(m);
    }
    color.set(n, BLACK); stack.pop();
  };
  for (const n of edges.keys()) if (color.get(n) === WHITE) dfs(n);
});

test('rule 6: use/ never writes the brain (no import of review/propose/snapshot)', () => {
  // use/ reads and runs; a run may append telemetry to the git-ignored runs.jsonl
  // (grow/log) — but it must never touch the brain-WRITE path (propose/review/
  // snapshot). Only grow/ writes notes, and only through review (the gate).
  const WRITERS = ['review', 'propose', 'snapshot'];
  for (const f of srcFiles(join(SRC, 'use'))) {
    const bad = [...readFileSync(f, 'utf8').matchAll(/from '(\.\.?\/[^']+)'/g)]
      .map((m) => m[1]).filter((p) => WRITERS.some((w) => p.endsWith(`/${w}.mjs`)));
    assert.deepEqual(bad, [], `${relative(SRC, f)} must not import the brain-write path`);
  }
});
