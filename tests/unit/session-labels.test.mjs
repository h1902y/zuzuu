// W1-B: user labels for sessions — a side map (.zuzuu/session-labels.json) kept
// SEPARATE from the capture-managed index, so a rename survives re-capture.
// Hermetic tmp dirs only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readSessionLabels, setSessionLabel } from '../../zuzuu/sessions/labels.mjs';

function tmpHome(fn) {
  const root = mkdtempSync(join(tmpdir(), 'zz-lbl-'));
  mkdirSync(join(root, '.zuzuu'), { recursive: true });
  try { return fn(root); } finally { rmSync(root, { recursive: true, force: true }); }
}

test('readSessionLabels: no file → empty map', () => {
  tmpHome((root) => {
    assert.deepEqual(readSessionLabels(root), {});
  });
});

test('setSessionLabel then read returns the label', () => {
  tmpHome((root) => {
    setSessionLabel(root, 'sess-1', 'fix auth bug');
    assert.equal(readSessionLabels(root)['sess-1'], 'fix auth bug');
  });
});

test('setSessionLabel trims whitespace', () => {
  tmpHome((root) => {
    setSessionLabel(root, 'sess-1', '  refactor api  ');
    assert.equal(readSessionLabels(root)['sess-1'], 'refactor api');
  });
});

test('setSessionLabel with an empty/blank label removes it', () => {
  tmpHome((root) => {
    setSessionLabel(root, 'sess-1', 'temp');
    setSessionLabel(root, 'sess-1', '   ');
    assert.equal('sess-1' in readSessionLabels(root), false);
  });
});

test('labels for multiple sessions coexist; updates replace', () => {
  tmpHome((root) => {
    setSessionLabel(root, 'a', 'one');
    setSessionLabel(root, 'b', 'two');
    setSessionLabel(root, 'a', 'one-updated');
    const m = readSessionLabels(root);
    assert.equal(m.a, 'one-updated');
    assert.equal(m.b, 'two');
  });
});

test('readSessionLabels is fail-soft on a corrupt file', () => {
  tmpHome((root) => {
    // write garbage
    writeFileSync(join(root, '.zuzuu', 'session-labels.json'), 'not json');
    assert.deepEqual(readSessionLabels(root), {});
  });
});
