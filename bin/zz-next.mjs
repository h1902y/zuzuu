#!/usr/bin/env node
// bin/zz-next.mjs — the v2 CLI entry (the `zz` veneer over the rebuilt kernel).
// Temporary name while v1's bin/zuzuu.mjs still ships; at the cull rung (8) the
// published `zz`/`zuzuu` bins repoint here.
import { run } from '../zuzuu/cli/index.mjs';

const code = await run(process.argv.slice(2));
process.exit(code);
