// src/notes/toon.mjs — token-dense list output for agents (AXI principle).
//
// what: serialize a list of rows to TOON — `name[count]{fields}:` + comma rows.
// why:  ~40% fewer tokens than JSON (no braces/quotes/commas-per-row). The agent
//       reads query results cheaply; output stays compact per turn.
// how:  one header line declaring count + fields, then one line per row. A value
//       with a comma/newline is quoted; the empty list is an explicit zero-state.

const cell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? JSON.stringify(s) : s;
};

/**
 * @param {string} name   the collection name (e.g. "notes")
 * @param {object[]} rows
 * @param {string[]} fields  columns, in order
 * @param {string[]} [help]  optional next-step command templates
 */
export function toon(name, rows, fields, help = []) {
  const lines = [`${name}[${rows.length}]{${fields.join(',')}}:`];
  if (rows.length === 0) lines[0] = `${name}[0]: (none)`;
  for (const r of rows) lines.push(`  ${fields.map((f) => cell(r[f])).join(',')}`);
  if (help.length) lines.push(`help[]: ${help.join(' · ')}`);
  return lines.join('\n');
}
