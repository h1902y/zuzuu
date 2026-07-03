#!/usr/bin/env node
// bin/zuzuu.mjs — the `zz` / `zuzuu` entry: the veneer over the rebuilt kernel.
// (Repointed at the cull, rung 8e — was the v1 command surface.)
import { run } from '../src/cli/index.mjs';

// exitCode, NOT process.exit(): a hard exit drops un-flushed stdout on pipes at
// 64KB — `zz graph --json | consumer` used to hand the daemon truncated JSON.
process.exitCode = await run(process.argv.slice(2));
