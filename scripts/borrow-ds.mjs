#!/usr/bin/env node
// scripts/borrow-ds.mjs — pull the BORROWED design system (the bible) into this repo.
//
// zuzuu's canonical design system is borrowed from the studio repo's design-sync bundle
// (editorial-brutalist "The Bottom Line" / window.ZuzuuDS). This script re-pulls the
// compiled, versioned bundle into web/vendor/zuzuu-ds/ so the borrow is reproducible —
// run it again whenever studio re-syncs its DS.
//
//   node scripts/borrow-ds.mjs [<source-ds-bundle-dir>]
//
// Default source: ~/Documents/studio/ds-bundle. Pass a path to override (e.g. a clone
// elsewhere). Only the CONSUMABLE artifact is copied; the design-tool-local scratch
// (.review.html, .ds-build-meta.json, screenshots, the recompile sentinel) is left behind.
import { cpSync, mkdirSync, rmSync, existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const DEST = resolve(import.meta.dirname, "..", "web", "vendor", "zuzuu-ds");
const SRC = resolve(process.argv[2] ?? join(homedir(), "Documents", "studio", "ds-bundle"));

// the durable, consumable bundle — everything a design built with this DS needs at runtime,
// plus the per-component contracts and the version anchor. (Excludes design-tool scratch.)
const KEEP = [
  "_ds_bundle.js",   // the IIFE → window.ZuzuuDS.* (the real compiled components)
  "_ds_bundle.css",  // component styles
  "styles.css",      // the stylesheet entry (@imports _ds_bundle.css + tokens/fonts)
  "_ds_sync.json",   // the version anchor (styleSha + per-component render hashes)
  "README.md",       // the DS's own conventions / usage
  "components",       // <Name>/{.jsx re-export stub, .d.ts, .prompt.md, .html}
  "_vendor",          // react/react-dom the preview cards load
  "_preview",         // compiled preview modules
  "guidelines",       // design guidelines, if any
  "tokens",           // token files, if any
];

if (!existsSync(SRC)) {
  console.error(`✗ source DS bundle not found: ${SRC}`);
  console.error(`  pass the studio ds-bundle path: node scripts/borrow-ds.mjs <dir>`);
  process.exit(1);
}

rmSync(DEST, { recursive: true, force: true });
mkdirSync(DEST, { recursive: true });
let copied = 0;
for (const name of KEEP) {
  const from = join(SRC, name);
  if (!existsSync(from)) continue;
  cpSync(from, join(DEST, name), { recursive: true });
  copied++;
}

let version = "(no _ds_sync.json)";
try {
  const anchor = JSON.parse(readFileSync(join(DEST, "_ds_sync.json"), "utf8"));
  version = (anchor.styleSha ?? "").slice(0, 12) + ` · ${Object.keys(anchor.renderHashes ?? {}).length} components`;
} catch {}

console.log(`✓ borrowed DS → web/vendor/zuzuu-ds/  (${copied} entries)`);
console.log(`  from:    ${SRC}`);
console.log(`  version: ${version}`);
