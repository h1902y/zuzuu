// U1 (docs/plans/2026-07-06-001-feat-wake-source-tick-plan.md) — the zero-dep 5-field
// cron matcher: `cronDue(expr, date)` decides whether `date` falls inside `expr`'s
// window. Pure — no filesystem/repo scaffolding needed, unlike trigger.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cronDue } from '../../src/grow/cron-match.mjs';

// All dates local, per cronDue's own contract (`new Date(y, m, d, h, min)`).

test('cronDue: `* * * * *` matches every minute', () => {
  assert.equal(cronDue('* * * * *', new Date(2026, 6, 6, 0, 0)), true);
  assert.equal(cronDue('* * * * *', new Date(2026, 6, 6, 13, 37)), true);
  assert.equal(cronDue('* * * * *', new Date(2026, 6, 6, 23, 59)), true);
});

test('cronDue: `*/15 * * * *` matches :00/:15/:30/:45, not :07', () => {
  for (const m of [0, 15, 30, 45]) {
    assert.equal(cronDue('*/15 * * * *', new Date(2026, 6, 6, 10, m)), true, `:${m} should match`);
  }
  assert.equal(cronDue('*/15 * * * *', new Date(2026, 6, 6, 10, 7)), false);
  assert.equal(cronDue('*/15 * * * *', new Date(2026, 6, 6, 10, 46)), false);
});

test('cronDue: `0 9-17 * * 1-5` matches 09:00-17:00 on weekdays, not Sunday', () => {
  // 2026-07-06 is a Monday; 2026-07-12 is a Sunday.
  assert.equal(cronDue('0 9-17 * * 1-5', new Date(2026, 6, 6, 9, 0)), true);
  assert.equal(cronDue('0 9-17 * * 1-5', new Date(2026, 6, 6, 17, 0)), true);
  assert.equal(cronDue('0 9-17 * * 1-5', new Date(2026, 6, 6, 8, 0)), false, 'before the hour range');
  assert.equal(cronDue('0 9-17 * * 1-5', new Date(2026, 6, 6, 18, 0)), false, 'after the hour range');
  assert.equal(cronDue('0 9-17 * * 1-5', new Date(2026, 6, 6, 9, 30)), false, 'wrong minute');
  assert.equal(cronDue('0 9-17 * * 1-5', new Date(2026, 6, 12, 9, 0)), false, 'Sunday is not a weekday');
});

test('cronDue: `0-30/10 * * * *` matches :00/:10/:20/:30, not :40', () => {
  for (const m of [0, 10, 20, 30]) {
    assert.equal(cronDue('0-30/10 * * * *', new Date(2026, 6, 6, 0, m)), true, `:${m} should match`);
  }
  assert.equal(cronDue('0-30/10 * * * *', new Date(2026, 6, 6, 0, 40)), false);
});

// ── the dom-OR-dow rule: when BOTH day-of-month and day-of-week are restricted,
// cron's real semantics is EITHER, not AND. ──────────────────────────────────────

test('cronDue: `0 0 13 * 5` — dom-OR-dow — matches the 13th even when it is not a Friday', () => {
  // 2026-07-13 is a Monday.
  assert.equal(new Date(2026, 6, 13).getDay(), 1, 'sanity: 2026-07-13 is a Monday');
  assert.equal(cronDue('0 0 13 * 5', new Date(2026, 6, 13, 0, 0)), true);
});

test('cronDue: `0 0 13 * 5` — dom-OR-dow — matches any Friday even when it is not the 13th', () => {
  // 2026-07-17 is a Friday.
  assert.equal(new Date(2026, 6, 17).getDay(), 5, 'sanity: 2026-07-17 is a Friday');
  assert.equal(cronDue('0 0 13 * 5', new Date(2026, 6, 17, 0, 0)), true);
});

test('cronDue: `0 0 13 * 5` — neither the 13th nor a Friday does not match', () => {
  // 2026-07-14 is a Tuesday, not the 13th.
  assert.equal(cronDue('0 0 13 * 5', new Date(2026, 6, 14, 0, 0)), false);
});

test('cronDue: only dom restricted (dow `*`) requires just the day-of-month', () => {
  assert.equal(cronDue('0 0 13 * *', new Date(2026, 6, 13, 0, 0)), true);
  assert.equal(cronDue('0 0 13 * *', new Date(2026, 6, 17, 0, 0)), false, 'a Friday that is not the 13th');
});

test('cronDue: only dow restricted (dom `*`) requires just the day-of-week', () => {
  assert.equal(cronDue('0 0 * * 5', new Date(2026, 6, 17, 0, 0)), true, 'a Friday');
  assert.equal(cronDue('0 0 * * 5', new Date(2026, 6, 13, 0, 0)), false, 'the 13th but not a Friday');
});

// ── malformed / defensive — total, never throws ──────────────────────────────────

test('cronDue: a malformed expr returns false without throwing', () => {
  assert.doesNotThrow(() => cronDue('nonsense', new Date()));
  assert.equal(cronDue('nonsense', new Date()), false);
});

test('cronDue: an empty expr returns false without throwing', () => {
  assert.doesNotThrow(() => cronDue('', new Date()));
  assert.equal(cronDue('', new Date()), false);
});

test('cronDue: the wrong field count returns false without throwing', () => {
  assert.equal(cronDue('* * * *', new Date()), false, 'only 4 fields');
  assert.equal(cronDue('* * * * * *', new Date()), false, '6 fields');
});

test('cronDue: non-string expr / non-Date date are handled defensively', () => {
  assert.doesNotThrow(() => cronDue(null, new Date()));
  assert.equal(cronDue(null, new Date()), false);
  assert.equal(cronDue(undefined, new Date()), false);
  assert.doesNotThrow(() => cronDue('* * * * *', 'not-a-date'));
  assert.equal(cronDue('* * * * *', 'not-a-date'), false);
  assert.equal(cronDue('* * * * *', new Date(NaN)), false, 'an invalid Date');
});

// ── month-boundary / leap-day sanity ─────────────────────────────────────────────

test('cronDue: month-boundary — midnight Jan 1 matches, Dec 31 does not', () => {
  assert.equal(cronDue('0 0 1 1 *', new Date(2027, 0, 1, 0, 0)), true);
  assert.equal(cronDue('0 0 1 1 *', new Date(2026, 11, 31, 0, 0)), false);
});

test('cronDue: leap day — Feb 29 on a leap year matches a dom-29 expr', () => {
  assert.equal(cronDue('0 0 29 2 *', new Date(2024, 1, 29, 0, 0)), true);
  // JS itself rolls a non-existent Feb 29 (2023, not a leap year) into March 1 — the
  // matcher just reads whatever real calendar date the Date object carries.
  const rolledOver = new Date(2023, 1, 29, 0, 0);
  assert.equal(rolledOver.getMonth(), 2, 'sanity: rolled into March');
  assert.equal(cronDue('0 0 29 2 *', rolledOver), false, 'March does not match a February expr');
});
