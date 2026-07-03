// src/use/table.mjs — the module-as-table boundary: export rows out, import rows in.
//
// what: `exportRows(home, module)` → the full hydrated envelopes as plain rows;
//       `toCsv(rows)` / `parseCsv(text)` — a zero-dep RFC-4180 subset (quotes,
//       embedded commas/newlines, doubled quotes) so a module round-trips through
//       a spreadsheet; import lands through the operator lane's batch create
//       (ONE transaction, ONE generation, all-or-nothing, schema-validated).
// why:  a personal app needs an escape hatch in BOTH directions — bulk rows in
//       (CSV/JSON from wherever the data lived before), the table out (to share,
//       chart, or leave). The gate stays intact: import is operator-initiated.

import { searchRows } from '../notes/rows.mjs';

/** Every row of a module, fully hydrated (lossless: custom columns ride along). */
export function exportRows(home, module) {
  const { items } = searchRows(home, { module, limit: 100000 });
  return items;
}

// a cell value → CSV text: objects/arrays as JSON, everything else stringified
const cellOut = (v) => {
  if (v == null) return '';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Rows → CSV. Columns = the union of keys in first-seen order, `id` first, `body` last. */
export function toCsv(rows) {
  const seen = new Set(['id']);
  const cols = ['id'];
  for (const r of rows) for (const k of Object.keys(r)) {
    if (!seen.has(k) && k !== 'body') { seen.add(k); cols.push(k); }
  }
  if (rows.some((r) => r.body != null && r.body !== '')) cols.push('body');
  const lines = [cols.map(cellOut).join(',')];
  for (const r of rows) lines.push(cols.map((c) => cellOut(r[c])).join(','));
  return lines.join('\n') + '\n';
}

/** CSV text → rows (RFC-4180 subset). The header row names the keys; a cell that
 *  parses as JSON (array/object/number/boolean) becomes that value; empty cells skip. */
export function parseCsv(text) {
  const records = [];
  let field = '';
  let row = [];
  let inQuotes = false;
  const pushField = () => { row.push(field); field = ''; };
  const pushRow = () => { if (row.length > 1 || row[0] !== '') records.push(row); row = []; };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') pushField();
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      pushField(); pushRow();
    } else field += ch;
  }
  if (field !== '' || row.length) { pushField(); pushRow(); }
  if (!records.length) return [];
  const header = records[0];
  const revive = (s) => {
    if (s === '') return undefined;
    if (/^(\{|\[|-?\d+(\.\d+)?$|true$|false$)/.test(s)) { try { return JSON.parse(s); } catch { return s; } }
    return s;
  };
  return records.slice(1).map((cells) => {
    const out = {};
    header.forEach((h, i) => {
      const v = revive(cells[i] ?? '');
      if (h && v !== undefined) out[h] = v;
    });
    return out;
  });
}
