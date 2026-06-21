// zuzuu/hosts/registry.mjs — the adapter registry.
//
// what: the one place host adapters register. Adding a host = one adapter file +
//       one line here (the v1 invariant: the core has no host conditionals).
// why:  observe is host-agnostic by construction — capture-core dispatches over
//       `detected()`, never over a host name.
// how:  a flat list; `detected()` filters by each adapter's own `detect()`.

import { claudeCode } from './adapters/claude-code.mjs';

// Claude Code is the richest + first host. OpenCode / Codex / Gemini / pi
// adapters drop in here as they are harvested (each against its own real wire data).
export const ADAPTERS = [claudeCode];

export const all = () => ADAPTERS.slice();
export const byName = (name) => ADAPTERS.find((a) => a.name === name) ?? null;
export const detected = () => ADAPTERS.filter((a) => { try { return a.detect(); } catch { return false; } });
