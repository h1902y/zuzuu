// src/hosts/registry.mjs — the adapter registry.
//
// what: the one place host adapters register. Adding a host = one adapter file +
//       one line here (the v1 invariant: the core has no host conditionals).
// why:  observe is host-agnostic by construction — capture-core dispatches over
//       `detected()`, never over a host name.
// how:  a flat list; `detected()` filters by each adapter's own `detect()`.

import { claudeCode } from './adapters/claude-code.mjs';
import { codex } from './adapters/codex.mjs';
import { geminiCli } from './adapters/gemini-cli.mjs';
import { opencode } from './adapters/opencode.mjs';
import { pi } from './adapters/pi.mjs';

// Host-agnostic by construction: the core iterates `detected()`, never a host
// name. Each adapter is built against that host's OWN real wire data.
const ADAPTERS = [claudeCode, codex, geminiCli, opencode, pi];

export const all = () => ADAPTERS.slice();
export const byName = (name) => ADAPTERS.find((a) => a.name === name) ?? null;
export const detected = () => ADAPTERS.filter((a) => { try { return a.detect(); } catch { return false; } });
