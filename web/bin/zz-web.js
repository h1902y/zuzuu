#!/usr/bin/env node
// The zz-web executable: a thin shim onto the built bootstrap. All orchestration
// lives in src/server/cli.ts (compiled to dist/server/cli.js by Rung 6's build).
import "../dist/server/cli.js";
