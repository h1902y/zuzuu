// src/use/view.mjs — windowed read of a note body.
//
// what: the `view` verb — read a slice of one note's body (offset + limit), with a
//       PARTIAL notice + total line count, so an agent can page a long note instead
//       of dumping or truncating it (the SWE-agent/Claude-Code file-viewer pattern).
// why:  `query` returns token-dense summaries; there was no way to read a long
//       Knowledge note's body without pulling the whole thing into context.
// how:  parse the note, slice its body lines. Read-only. Zero-dep, fail-soft.

import { existsSync, readFileSync } from 'node:fs';
import { parse } from '../notes/note.mjs';
import { itemPath } from '../notes/store.mjs';

/**
 * Read a windowed slice of a note's body.
 * @returns {{ ok, addr?, type?, title?, total?, offset?, shown?, partial?, body?, error? }}
 */
export function viewNote(home, module, id, { offset = 0, limit = 0 } = {}) {
  const path = itemPath(home, module, id);
  if (!existsSync(path)) return { ok: false, error: `no note '${module}:${id}'` };
  const { note } = parse(readFileSync(path, 'utf8'), { id });
  const lines = String(note?.body ?? '').split('\n');
  const start = Math.max(0, offset);
  const end = limit > 0 ? Math.min(lines.length, start + limit) : lines.length;
  return {
    ok: true, addr: `${module}:${id}`, type: note?.type, title: note?.title,
    total: lines.length, offset: start, shown: Math.max(0, end - start),
    partial: start > 0 || end < lines.length,
    body: lines.slice(start, end).join('\n'),
  };
}
