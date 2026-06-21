#!/usr/bin/env node
// bin/zuzuu.mjs — the `zz` / `zuzuu` entry: the veneer over the rebuilt kernel.
// (Repointed at the cull, rung 8e — was the v1 command surface.)
import { run } from '../zuzuu/cli/index.mjs';

const code = await run(process.argv.slice(2));
process.exit(code);
