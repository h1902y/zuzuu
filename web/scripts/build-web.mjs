// Build + stage the folded workbench into web-app/ for publishing inside
// @zuzuucodes/cli. This is the SIMPLIFIED stager (Rung 6): one tsc (server +
// shared → dist/{server,shared}) + one vite (client → dist/web) + a copy. The
// old version did `npm ci` across three workspace packages and ran a
// vendor-protocol shim to copy protocol/dist into the daemon and rewrite bare
// specifiers — both gone, because the protocol is now a plain internal module
// (src/shared) and there is one package, not three.
//
//   web/pkgRoot  --tsc(server)+vite(client)-->  dist/{server,shared,web}
//           --staged here ------------->   web-app/{dist/{server,shared,web,index.js}, package.json}
//
// web-app/ is git-ignored build output; the CLI's `zz web` launches
// web-app/dist/index.js. Deps are stripped from the staged package.json — they
// resolve up the tree to @zuzuucodes/cli's optionalDependencies. Zero-dep
// (node builtins only).

import { rmSync, cpSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), ".."); // the package root (now web/)
const repoRoot = join(pkgRoot, ".."); // web/ → repo root
const out = join(repoRoot, "web-app");
const pkg = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf8"));

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: pkgRoot, stdio: "inherit" });
  if (r.status !== 0) {
    console.error(`build-web: ${cmd} ${args.join(" ")} failed (${r.status})`);
    process.exit(1);
  }
}

// 1. build — server (tsc) + client (vite)
run("npx", ["tsc", "-p", "tsconfig.build.json"]);
run("npx", ["vite", "build"]);

// shell-integration rc snippets are assets, not TS — tsc doesn't copy them.
const siSrc = join(pkgRoot, "src", "server", "shell-integration");
const siOut = join(pkgRoot, "dist", "server", "shell-integration");
for (const f of readdirSync(siSrc)) {
  if (/\.(zsh|bash|fish)$/.test(f)) cpSync(join(siSrc, f), join(siOut, f));
}

// 2. stage into web-app/
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, "dist"), { recursive: true });
for (const d of ["server", "shared", "web"]) {
  cpSync(join(pkgRoot, "dist", d), join(out, "dist", d), { recursive: true });
}
// the entry the CLI launches; runs the bootstrap (which computes PKG_ROOT = web-app).
writeFileSync(join(out, "dist", "index.js"), `import "./server/cli.js";\n`);

// 3. a minimal package.json: ESM + the #shared subpath now pointing at the
//    STAGED dist/shared (the source package.json points it at src for dev/test),
//    + the version banner (cli.ts reads ../package.json). Deps stripped.
writeFileSync(
  join(out, "package.json"),
  JSON.stringify(
    {
      name: "zuzuu-web-app",
      private: true,
      version: pkg.version,
      type: "module",
      imports: { "#shared/*": "./dist/shared/*" },
    },
    null,
    2,
  ) + "\n",
);

console.log(`build-web: staged web-app/ (server + shared + web, v${pkg.version})`);
