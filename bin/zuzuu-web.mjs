#!/usr/bin/env node
// Direct entry to the bundled workbench daemon (the `zuzuu web` command is the
// porcelain; this bin exists for people who want the daemon itself).
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const entry = join(dirname(fileURLToPath(import.meta.url)), '..', 'web-app', 'dist', 'index.js');
if (!existsSync(entry)) {
  console.error('zuzuu-web: the bundled workbench is not staged.');
  console.error('  installed package → reinstall: npm i -g @zuzuucodes/cli (without --omit=optional)');
  console.error('  repo checkout     → build it:  npm run build:web');
  process.exit(1);
}
await import(entry);
