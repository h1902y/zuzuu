// src/notes/index.mjs — the derived query cache.
//
// what: a node:sqlite index over every note in the project — built FROM the files,
//       never authoritative. Powers query-on-demand: search, filter, and walk
//       relations without loading the corpus into anyone's context.
// why:  the files are the Project; this is a regenerable cache. The agent QUERIES
//       instead of ingesting — context-frugal. (The #1 novel bet: portable,
//       zero-dep, CLI-native graph+relational query over markdown.)
// how:  notes + prop(KV) + link(graph) tables + an FTS5 body index + recursive
//       CTE traversal. node:sqlite is lazy-loaded (createRequire) so importing
//       this never hard-requires sqlite. Rebuilt when any source file changes.

import { createRequire } from 'node:module';
import { existsSync, readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { parse } from './note.mjs';
import { itemsDir, cacheDir } from './store.mjs';

const require = createRequire(import.meta.url);
let DatabaseSync = null;
const sqlite = () => (DatabaseSync ??= require('node:sqlite').DatabaseSync);

// The cache is a rebuildable derived artifact — it lives OUTSIDE the repo, in the
// XDG cache dir keyed to this project, never in the tracked `.zuzuu/` tree.
const dbPath = (home) => join(cacheDir(home), 'index.db');
const str = (v) => (v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v));

const SCHEMA = `
CREATE TABLE notes (addr TEXT PRIMARY KEY, module TEXT, id TEXT, type TEXT, title TEXT, status TEXT, body TEXT);
CREATE TABLE prop (addr TEXT, key TEXT, value TEXT);
CREATE TABLE link (src TEXT, type TEXT, dst TEXT);
CREATE VIRTUAL TABLE fts USING fts5(addr UNINDEXED, title, body);
CREATE TABLE meta (k TEXT PRIMARY KEY, v TEXT);
CREATE INDEX prop_kv ON prop(key, value);
CREATE INDEX link_dst ON link(dst);
CREATE INDEX link_src ON link(src, type);
CREATE INDEX notes_id ON notes(id);
`;

// This DB is a fully-regenerable CACHE — it rebuilds from the files on any change,
// so crash-durability is irrelevant. Trade it for speed: no journal, no fsync.
const CACHE_PRAGMAS = 'PRAGMA journal_mode=OFF; PRAGMA synchronous=OFF; PRAGMA temp_store=MEMORY; PRAGMA mmap_size=268435456;';

/** Open a connection with the cache pragmas set. */
function connect(path) {
  const db = new (sqlite())(path);
  db.exec(CACHE_PRAGMAS);
  return db;
}

/** List module dirs in the home (skip dot-dirs + non-dirs). */
function moduleDirs(home) {
  if (!existsSync(home)) return [];
  return readdirSync(home, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => e.name);
}

/** A signature of the corpus (sorted addr:mtime) — drives staleness. */
function corpusSig(home) {
  const parts = [];
  for (const module of moduleDirs(home)) {
    const dir = itemsDir(home, module);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.md')) continue;
      const st = statSync(join(dir, f));
      // size as well as mtime: a content change that keeps the mtime (rollback
      // restoring blob bytes, fast successive writes within mtime resolution)
      // changes the size, so the stale index rebuilds.
      parts.push(`${module}/${f}:${st.mtimeMs}:${st.size}`);
    }
  }
  return createHash('sha256').update(parts.sort().join('\n')).digest('hex');
}

/** Build the index from scratch into an in-memory-or-file db. */
function build(home, db) {
  db.exec(SCHEMA);
  db.exec('BEGIN'); // one transaction → one fsync, not one per insert (≈100× faster)
  const insZu = db.prepare('INSERT OR REPLACE INTO notes VALUES (?,?,?,?,?,?,?)');
  const insProp = db.prepare('INSERT INTO prop VALUES (?,?,?)');
  const insLink = db.prepare('INSERT INTO link VALUES (?,?,?)');
  const insFts = db.prepare('INSERT INTO fts VALUES (?,?,?)');

  for (const module of moduleDirs(home)) {
    const dir = itemsDir(home, module);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.md')) continue;
      const id = f.slice(0, -3);
      const addr = `${module}:${id}`;
      const { ok, note } = parse(readFileSync(join(dir, f), 'utf8'), { id });
      if (!ok || !note) continue; // fail-soft: a bad file just isn't indexed
      insZu.run(addr, module, id, note.type ?? '', note.title ?? '', note.status ?? 'active', note.body ?? '');
      insFts.run(addr, note.title ?? '', note.body ?? '');
      for (const [key, val] of Object.entries(note)) {
        if (key === 'body' || key === 'id') continue;
        if (key === 'relations' && val && typeof val === 'object' && !Array.isArray(val)) {
          for (const [rtype, dsts] of Object.entries(val)) {
            // normalize a bare-id target ('render') to a full addr ('actions:render')
            // — observe/relate write bare ids, and the graph walk joins on the full
            // addr, so without this `related()` returns nothing for them.
            for (const d of [].concat(dsts)) { const dv = str(d); insLink.run(addr, rtype, dv.includes(':') ? dv : `${module}:${dv}`); }
          }
        }
        if (key === 'tags') for (const t of [].concat(val)) insProp.run(addr, 'tag', str(t));
        insProp.run(addr, key, str(val));
      }
    }
  }
  db.prepare('INSERT INTO meta VALUES (?,?)').run('sig', corpusSig(home));
  db.exec('COMMIT');
  return db;
}

/** Open the index, rebuilding if missing or stale. Returns a live db handle. */
export function open(home) {
  const path = dbPath(home);
  const sig = corpusSig(home);
  if (existsSync(path)) {
    let db = null;
    try {
      db = connect(path); // connect() runs PRAGMAs — on a corrupt file this throws → caught → rebuild
      const cur = db.prepare('SELECT v FROM meta WHERE k=?').get('sig');
      if (cur && cur.v === sig) return db; // fresh: caller owns + closes it
    } catch { /* corrupt / unopenable → fall through to rebuild */ }
    if (db) db.close(); // stale or corrupt → drop it
  }
  // (re)build into the file db — ensure the (out-of-repo) cache dir exists first
  const { rmSync, mkdirSync } = require('node:fs');
  if (existsSync(path)) rmSync(path);
  else mkdirSync(cacheDir(home), { recursive: true });
  return build(home, connect(path));
}

// ── query primitives ───────────────────────────────────────────────────────

const qualify = (cols) => cols.replace(/\b(addr|type|title|status|body)\b/g, 'notes.$1');
const BRIEF_SEL = qualify('addr, type, title, status'); // precomputed (not per-call)
const FULL_SEL = qualify('addr, type, title, status, body');

/**
 * Make arbitrary user text a SAFE FTS5 query. The raw value is parsed by FTS5 as a
 * QUERY EXPRESSION, so a quote/colon/`*`/`AND` crashes or silently mis-matches.
 * Wrap each whitespace token in a quoted string (quotes doubled to escape) so every
 * character is literal, then AND them. '' when nothing usable (→ no text filter).
 */
function ftsQuery(text) {
  return (String(text).match(/\S+/g) || []).map((t) => `"${t.replace(/"/g, '""')}"`).join(' ');
}

/** Build the shared FROM + WHERE + args for a filter set (search and count reuse it). */
function plan({ text = '', module = '', type = '', tag = '' }) {
  const where = [];
  const args = [];
  let from = 'notes';
  const fts = text ? ftsQuery(text) : '';
  if (fts) { from = 'notes JOIN fts ON fts.addr = notes.addr'; where.push('fts MATCH ?'); args.push(fts); }
  if (module) { where.push('notes.module = ?'); args.push(module); }
  if (type) { where.push('notes.type = ?'); args.push(type); }
  if (tag) { where.push('notes.addr IN (SELECT addr FROM prop WHERE key=? AND value=?)'); args.push('tag', tag); }
  return { from, whereSql: where.length ? ` WHERE ${where.join(' AND ')}` : '', args };
}

/**
 * Search the index. Composable filters; brief by default. User `text` is sanitized,
 * so it never crashes on FTS metacharacters.
 * @returns {Array<{addr,type,title,status,body?}>}
 */
export function search(home, { limit = 50, full = false, ...filters } = {}) {
  const db = open(home);
  try {
    const { from, whereSql, args } = plan(filters);
    const sql = `SELECT ${full ? FULL_SEL : BRIEF_SEL} FROM ${from}${whereSql} LIMIT ${Number(limit) || 50}`;
    return db.prepare(sql).all(...args);
  } finally { db.close(); }
}

/** Walk relations from an addr up to `depth` hops (recursive CTE). */
export function related(home, addr, { depth = 1, type = '' } = {}) {
  const db = open(home);
  try {
    const typeFilter = type ? 'AND l.type = ?' : '';
    const sql = `
      WITH RECURSIVE walk(addr, hop) AS (
        SELECT ?, 0
        UNION
        SELECT l.dst, walk.hop + 1 FROM link l JOIN walk ON l.src = walk.addr
        WHERE walk.hop < ? ${typeFilter}
      )
      SELECT z.addr, z.type, z.title, z.status, walk.hop
      FROM walk JOIN notes z ON z.addr = walk.addr
      WHERE walk.hop > 0 ORDER BY walk.hop, z.addr`;
    const args = type ? [addr, Number(depth) || 1, type] : [addr, Number(depth) || 1];
    return db.prepare(sql).all(...args);
  } finally { db.close(); }
}

/** Count matching notes with `SELECT COUNT(*)` — never materializes rows. */
export function count(home, opts = {}) {
  const db = open(home);
  try {
    const { from, whereSql, args } = plan(opts);
    return db.prepare(`SELECT COUNT(*) AS n FROM ${from}${whereSql}`).get(...args).n;
  } finally { db.close(); }
}

/** Per-module note counts in ONE query — the digest fast path (was M opens). */
export function moduleCounts(home) {
  const db = open(home);
  try {
    const rows = db.prepare('SELECT module, COUNT(*) AS n FROM notes GROUP BY module').all();
    return Object.fromEntries(rows.map((r) => [r.module, r.n]));
  } finally { db.close(); }
}

/** Integrity: relations whose target isn't a known note (broken links). */
export function brokenLinks(home) {
  const db = open(home);
  try {
    // a target is broken if it matches neither a known full addr nor a bare id
    return db.prepare(`
      SELECT l.src, l.type, l.dst FROM link l
      WHERE l.dst != ''
        AND l.dst NOT IN (SELECT addr FROM notes)
        AND l.dst NOT IN (SELECT id FROM notes)
      ORDER BY l.src`).all();
  } finally { db.close(); }
}

