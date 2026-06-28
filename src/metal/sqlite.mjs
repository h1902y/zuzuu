// src/metal/sqlite.mjs — the lazy node:sqlite loader.
//
// what: `sqlite()` → the `DatabaseSync` class, lazily required on first use.
// why:  the index (notes/index.mjs) is the one consumer of node:sqlite, but merely
//       IMPORTING the index must never hard-require sqlite (an older Node, or a build
//       without the experimental module, should still load the rest of the system).
//       Centralizing the lazy require here keeps that guarantee in one named place.
// how:  `createRequire` so the `require('node:sqlite')` is deferred to call time, and
//       memoized. The only importer of node:sqlite in the note core. Zero-dep.

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let DatabaseSync = null;

/** The node:sqlite `DatabaseSync` class — required on first call, then memoized. */
export const sqlite = () => (DatabaseSync ??= require('node:sqlite').DatabaseSync);
