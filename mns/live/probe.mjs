// mns/live/probe.mjs — Phase-0 observation tool (the real-wire-data rule).
//
// Records EXACTLY what a host hands a hook so we can wire the real mapping
// instead of trusting docs. Installed as a throwaway hook command per candidate
// event; the user runs a real session; we then read the capture file to learn
// which events fire, how the payload arrives (argv vs stdin), and its shape.
//
// Contract: never throws, always exits 0 (must not disturb the host session).
//
// usage (as a hook command):
//   node probe.mjs --host <h> --event <EV> --out <abs path to .jsonl> [host's own args…]

import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

const argOf = (k, d = null) => {
  const i = process.argv.indexOf(k);
  return i !== -1 && i + 1 < process.argv.length ? process.argv[i + 1] : d;
};

const host = argOf('--host', 'unknown');
const event = argOf('--event', 'unknown');
const out = argOf('--out', null);

// Read whatever the host piped on stdin (most hosts deliver the payload here).
let stdin = null;
try {
  stdin = readFileSync(0, 'utf8');
} catch {
  /* no/closed stdin */
}

const record = {
  at: new Date().toISOString(),
  host,
  event,
  argv: process.argv.slice(2), // exactly how the host invoked us
  stdin: stdin && stdin.length ? stdin : null,
  cwd: process.cwd(),
  env: { GEMINI_SESSION: process.env.GEMINI_SESSION_ID ?? null, CODEX: process.env.CODEX_SESSION_ID ?? null },
};

try {
  if (out) {
    mkdirSync(dirname(out), { recursive: true });
    appendFileSync(out, JSON.stringify(record) + '\n');
  }
} catch {
  /* observation must never break the host */
}

process.exit(0);
