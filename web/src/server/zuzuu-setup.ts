// src/server/zuzuu-setup.ts — the ROOT-scoped setup routes (/api/zuzuu/setup/*).
//
// The onboarding journey's verbs, surfaced to the browser. init/enable/observe
// shell the `zz` CLI exactly like the write side (runZuzuuMut → the daemon JSON-
// parses stdout; the CLI emits JSON under --json). git-init is the ONE non-zz
// action: `zz init` never runs `git init`, and a session is a git branch, so the
// not-a-repo rung needs a real mutation — gated behind an explicit { confirm:true }.
//
// All idempotent: re-running is safe (initHome skips existing, enable never
// clobbers, git-init no-ops on an existing repo). Failure mapping mirrors the
// write side: CLI absent → 503, command failed → 502, success → 200 + CLI JSON.

import { Hono } from "hono";
import type { Context } from "hono";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { runZuzuuMut } from "./zuzuu-cli.js";

export function createZuzuuSetupApi(getRoot: () => string, binary?: string): Hono {
  const app = new Hono();

  const readBody = async (c: Context): Promise<Record<string, unknown>> => {
    try { const b = await c.req.json(); return b && typeof b === "object" ? b as Record<string, unknown> : {}; }
    catch { return {}; }
  };

  /** Shell a setup verb and map the result (absent → 503, failed → 502, ok → 200 + JSON). */
  const setup = async (c: Context, args: string[]) => {
    const r = await runZuzuuMut(getRoot(), args, { binary });
    if (!r.ok) {
      return r.code === "absent"
        ? c.json({ error: "zuzuu CLI required" }, 503)
        : c.json({ error: "zuzuu command failed", stderr: r.stderr ?? "", data: r.data ?? null }, 502);
    }
    return c.json(r.data as Record<string, unknown>);
  };

  // The consented setup steps (U3): no silent setup. Each requires an explicit
  // { consent: true } in the body — the server-boundary half of the explain-then-run
  // contract (R13/R14), mirroring git-init's { confirm: true }. The client only POSTs
  // these after the user affirms the rung (KTD1); the gate here is defense-in-depth so
  // the route can never run init/enable without an explicit consent.
  const consentGated = async (c: Context, args: string[]) => {
    const body = await readBody(c);
    if (body.consent !== true) return c.json({ error: `${args[0]} requires { consent: true }` }, 400);
    return setup(c, args);
  };

  app.post("/setup/init", (c) => consentGated(c, ["init"]));      // plant .zuzuu/ + the instructions floor (consented)
  app.post("/setup/enable", (c) => consentGated(c, ["enable"]));  // wire the host's lifecycle hooks (consented — R14)
  app.post("/setup/observe", (c) => setup(c, ["observe"]));       // mine the session → staged proposals (post-session; not a consented setup step)

  // git-init — the one explicit, confirmed filesystem mutation (D6). `zz init`
  // never git-init's, but a session is a git branch, so the not-a-repo rung needs
  // a real `git init`. Idempotent: a no-op on a folder that's already a repo.
  app.post("/setup/git-init", async (c) => {
    const body = await readBody(c);
    if (body.confirm !== true) return c.json({ error: "git init requires { confirm: true }" }, 400);
    const root = getRoot();
    if (existsSync(path.join(root, ".git"))) return c.json({ ok: true, alreadyRepo: true });
    const ok = await new Promise<boolean>((resolve) => {
      let child;
      try { child = spawn("git", ["init"], { cwd: root, stdio: "ignore" }); }
      catch { resolve(false); return; }
      child.on("error", () => resolve(false));
      child.on("close", (code) => resolve(code === 0));
    });
    return ok ? c.json({ ok: true, alreadyRepo: false }) : c.json({ error: "git init failed" }, 502);
  });

  return app;
}
