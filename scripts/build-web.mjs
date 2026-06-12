// Stage the workbench into web-app/ for publishing inside @zuzuucodes/cli.
// (Single-package decision, 2026-06-12: one npm artifact; the web runtime's
// deps ride as the CLI's optionalDependencies, so a failed native build can
// degrade the workbench but never the CLI.)
//
//   web/ (nested project)  --npm ci + build-->  packages/daemon/{dist,web-dist}
//                          --staged here ---->  web-app/{dist,web-dist,package.json}
//
// web-app/ is git-ignored build output; CI runs this before `npm publish`.
// Zero-dep: node builtins only.

import { rmSync, cpSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const web = join(root, 'web');
const daemon = join(web, 'packages', 'daemon');
const out = join(root, 'web-app');

function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit' });
  if (r.status !== 0) { console.error(`build-web: ${cmd} ${args.join(' ')} failed (${r.status})`); process.exit(1); }
}

// 1. build the nested project (protocol → web → daemon; vendors protocol, stages web-dist)
if (!existsSync(join(web, 'node_modules'))) run('npm', ['ci'], web);
run('npm', ['run', 'build'], web);

// 2. stage
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(daemon, 'dist'), join(out, 'dist'), { recursive: true });
cpSync(join(daemon, 'web-dist'), join(out, 'web-dist'), { recursive: true });

// 3. a minimal nested package.json: keeps ESM resolution + the version banner
//    (dist reads ../package.json); deps are stripped — they resolve up the tree
//    to the CLI package's node_modules (its optionalDependencies).
const pkg = JSON.parse(readFileSync(join(daemon, 'package.json'), 'utf8'));
writeFileSync(join(out, 'package.json'), JSON.stringify({
  name: 'zuzuu-web-app', private: true, version: pkg.version, type: pkg.type ?? 'module',
}, null, 2) + '\n');

console.log(`build-web: staged web-app/ (daemon dist + web-dist, v${pkg.version})`);
