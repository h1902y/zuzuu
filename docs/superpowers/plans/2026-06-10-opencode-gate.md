# OpenCode Guardrails Gate — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** `mns enable --host opencode` installs a guardrails gate alongside the existing capture plugin — the plugin's `tool.execute.before` hook runs the shared mns gate and **throws to block** a `deny` (fail-open; never breaks OpenCode).

**Architecture:** Design B unchanged. The plugin (bun runtime) `tool.execute.before` handler spawns `node mns hook PreToolUse --host opencode` (tool payload on stdin), reads the decision, throws on `deny`. The shared `evaluate()` engine stays the single source of truth. Real-wire-confirmed signature (`tests/fixtures/hooks/opencode.probe.jsonl`): `input={tool, sessionID, callID}`, `output={args}`; `tool.execute.before` fires for every tool (`permission.ask` does not, so throw is the gate).

**Tech Stack:** Node ≥22, ESM, zero deps, `node:test`. The plugin runs in OpenCode's bun runtime (uses `node:child_process` `spawnSync`).

---

## Conventions
- Zero deps. One test file: `node --test tests/unit/<f>.test.mjs`. All: `npm test`.
- Commit trailer (exact): `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- Explicit `git add <files>` (an unrelated CLAUDE.md edit may exist).
- The gate **fails open**: any error → no throw (tool proceeds). The plugin must **never** throw a non-deny error into OpenCode.

## Current state
- `mns/commands/enable.mjs`: `opencodePluginPath()` = `.opencode/plugin/mns.js` (singular); `opencodePlugin()` template fires `session.created|idle|deleted` via `spawn(... detached).unref()` (fire-and-forget capture). `enable`/`disable` have an opencode branch.
- `mns/commands/hook.mjs`: `gateDecision({host,payload,cwd})` → `host==='gemini-cli' ? toGeminiDecision : toPreToolUseDecision`. `GATE_EVENTS = Set(['PreToolUse','BeforeTool'])`. `runHook`: `if (host==='opencode') payload={session_id:session}; else parse stdin`.
- `mns/guardrails.mjs`: `toGeminiDecision(verdict)` → `{decision:"deny",reason}` for deny else null; `toPreToolUseDecision` → hookSpecificOutput.

## File structure
| File | Responsibility | Action |
|---|---|---|
| `mns/commands/hook.mjs` | opencode in the `{decision}` serializer; opencode gate event reads stdin | **Modify** |
| `mns/commands/enable.mjs` | plugin → plural dir + a `tool.execute.before` gate handler; disable cleans both dirs | **Modify** |
| `tests/unit/hook-hosts.test.mjs` | opencode gate decision | **Modify** |

---

## Task 1: gate decision + stdin for the opencode gate event

**Files:** Modify `mns/commands/hook.mjs`; Test `tests/unit/hook-hosts.test.mjs`

The plugin will spawn `mns hook PreToolUse --host opencode` piping `{tool_name,tool_input,session_id}` on stdin and read a `{decision:"deny",reason}` from stdout. So opencode must (a) use the `{decision}` serializer and (b) read stdin for the gate event (lifecycle still uses `--session`).

- [ ] **Step 1: Write the failing test** (append to `tests/unit/hook-hosts.test.mjs`)

```javascript
test('gateDecision: opencode deny → {decision:deny,reason} (plugin-parseable)', () => {
  withRules([SECRET_RULE], (cwd) => {
    const d = gateDecision({ host: 'opencode', payload: { session_id: 's', tool_name: 'bash', tool_input: { command: 'cat .env' } }, cwd });
    assert.equal(d.decision, 'deny');
    assert.match(d.reason, /no-secret-reads/);
  });
});
```
(`withRules`, `SECRET_RULE`, `gateDecision` already exist in this file from the gemini/codex tasks.)

- [ ] **Step 2: Run** `node --test tests/unit/hook-hosts.test.mjs` → FAIL (opencode currently uses `toPreToolUseDecision` → `.decision` undefined).

- [ ] **Step 3: Implement** (`mns/commands/hook.mjs`)

In `gateDecision`, change the serializer selection to include opencode in the `{decision}` shape:
```javascript
    return (host === 'gemini-cli' || host === 'opencode') ? toGeminiDecision(verdict) : toPreToolUseDecision(verdict);
```
In `runHook`, make the opencode **gate** event read stdin (lifecycle stays on `--session`). Replace:
```javascript
  if (host === 'opencode') {
    payload = { session_id: session };
  } else {
    // claude-code, gemini-cli, codex all pipe a JSON payload on fd 0
    try { payload = JSON.parse(readFileSync(0, 'utf8')); } catch { /* no/garbage stdin */ }
  }
```
with:
```javascript
  if (host === 'opencode' && !GATE_EVENTS.has(event)) {
    payload = { session_id: session }; // opencode lifecycle: id via --session (fire-and-forget)
  } else {
    // claude/gemini/codex always pipe JSON; opencode pipes it for the gate event too
    try { payload = JSON.parse(readFileSync(0, 'utf8')); } catch { /* no/garbage stdin */ }
  }
```

- [ ] **Step 4: Run** `node --test tests/unit/hook-hosts.test.mjs` → pass. Then `npm test 2>&1 | tail -5` → fail 0 (existing opencode lifecycle tests unbroken — they don't use GATE_EVENTS).

- [ ] **Step 5: Commit**
```bash
git add mns/commands/hook.mjs tests/unit/hook-hosts.test.mjs
git commit -m "feat(hook): opencode gate event reads stdin + uses {decision} serializer

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 2: the plugin gate handler + plural dir

**Files:** Modify `mns/commands/enable.mjs`

Rewrite `opencodePlugin()` to add a `tool.execute.before` gate, and move the plugin to the documented plural `.opencode/plugins/` dir (both load on 1.16.2; plural is the default). The gate spawns the mns engine **synchronously** (`spawnSync`, bun-compatible) with a timeout and throws only on an explicit deny.

- [ ] **Step 1: Update the path + template** (`mns/commands/enable.mjs`)

Change the path to plural:
```javascript
const opencodePluginPath = (cwd) => join(repoRoot(cwd), '.opencode', 'plugins', 'mns.js');
const opencodeLegacyPluginPath = (cwd) => join(repoRoot(cwd), '.opencode', 'plugin', 'mns.js'); // pre-2026-06 singular
```
Replace the `opencodePlugin()` template with one that adds the gate (keep capture fire-and-forget; add `spawnSync` import):
```javascript
const opencodePlugin = () => `// installed by \`mns enable --host opencode\` — live capture + guardrails gate (graceful: never breaks OpenCode).
import { spawn, spawnSync } from "node:child_process";
const NODE = ${JSON.stringify(NODE)};
const MNS = ${JSON.stringify(BIN)};
const fire = (event, id) => { try { spawn(NODE, [MNS, "hook", event, "--host", "opencode", "--session", id], { stdio: "ignore", detached: true }).unref(); } catch {} };
export const Mns = async () => ({
  event: async ({ event }) => {
    try {
      const id = event?.properties?.sessionID;
      if (!id) return;
      if (event.type === "session.created") fire("session.created", id);
      else if (event.type === "session.idle") fire("session.idle", id);
      else if (event.type === "session.deleted") fire("session.deleted", id);
    } catch {}
  },
  // The guardrails gate: tool.execute.before fires for every tool (real-wire verified).
  // input = { tool, sessionID, callID }; output = { args }. Throw to block. Fail-open.
  "tool.execute.before": async (input, output) => {
    try {
      const payload = JSON.stringify({ tool_name: input?.tool, tool_input: output?.args, session_id: input?.sessionID });
      const res = spawnSync(NODE, [MNS, "hook", "PreToolUse", "--host", "opencode"], { input: payload, encoding: "utf8", timeout: 5000 });
      const out = (res && res.stdout) || "";
      let decision = null;
      for (const line of out.split("\\n")) { const t = line.trim(); if (t.startsWith("{")) { try { decision = JSON.parse(t); } catch {} } }
      if (decision && decision.decision === "deny") throw new Error(decision.reason || "blocked by mns guardrail");
    } catch (e) {
      // Only an intentional deny throws; any gate/spawn error fails OPEN (tool proceeds).
      if (e && typeof e.message === "string" && e.message.indexOf("guardrail") !== -1) throw e;
    }
  },
});
`;
```
NOTE the fail-open subtlety: the `catch` re-throws **only** when the error message is our guardrail deny; all other errors (spawn failure, timeout, parse) are swallowed → tool proceeds. (The deny `Error` message comes from `toGeminiDecision` as `guardrail <rule>: <reason>`, so it contains "guardrail".)

- [ ] **Step 2: Update enable/disable** (`mns/commands/enable.mjs`)

In `enable`'s opencode branch, write to the plural path + remove a stale singular plugin, and update the console note:
```javascript
  if ((args.host || 'claude-code') === 'opencode') {
    const path = opencodePluginPath();
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, opencodePlugin());
    const legacy = opencodeLegacyPluginPath();
    if (existsSync(legacy)) rmSync(legacy, { force: true }); // migrate singular → plural
    console.log('mns enabled for OpenCode — live capture + guardrails gate installed');
    console.log(`  plugin : ${path}`);
    console.log('  events : session.created/idle/deleted (capture) · tool.execute.before (gate)');
    console.log('  note   : no clean end signal — ended/killed sessions reconcile via `mns doctor`');
    console.log('  scope  : new OpenCode sessions in this repo; disable: mns disable --host opencode');
    return;
  }
```
In `disable`'s opencode branch, remove both plural + legacy singular:
```javascript
  if ((args.host || 'claude-code') === 'opencode') {
    let removed = false;
    for (const p of [opencodePluginPath(), opencodeLegacyPluginPath()]) {
      if (existsSync(p)) { rmSync(p, { force: true }); removed = true; }
    }
    console.log(removed ? 'mns disabled for OpenCode — plugin removed' : 'nothing to disable (no OpenCode plugin)');
    return;
  }
```
(Confirm `existsSync`, `rmSync`, `mkdirSync`, `dirname`, `writeFileSync` are imported — they are.)

- [ ] **Step 3: Verify the generated plugin** (no host run)
```bash
cd /Users/hkc/Documents/motorsandsensors
D=$(mktemp -d) && cd "$D" && git init -q && node /Users/hkc/Documents/motorsandsensors/bin/mns.mjs init >/dev/null
node /Users/hkc/Documents/motorsandsensors/bin/mns.mjs enable --host opencode
echo "--- plugin path + content ---" && ls .opencode/plugins/ && grep -c "tool.execute.before" .opencode/plugins/mns.js
node /Users/hkc/Documents/motorsandsensors/bin/mns.mjs disable --host opencode && ls .opencode/plugins/ 2>/dev/null || echo "(removed)"
```
Expected: `.opencode/plugins/mns.js` exists, contains the `tool.execute.before` handler; disable removes it. Then `cd /Users/hkc/Documents/motorsandsensors && npm test 2>&1 | tail -5` → fail 0.

- [ ] **Step 4: Commit**
```bash
git add mns/commands/enable.mjs
git commit -m "feat(enable): OpenCode guardrails gate via tool.execute.before (plural plugins dir)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 3: Dogfood the gate on a real OpenCode session

**Files:** none (verification; self-served — OpenCode + OpenRouter available)

- [ ] **Step 1: Arena + deny rule**
```bash
A=~/Documents/mns-opencode-dogfood && rm -rf "$A" && mkdir -p "$A" && cd "$A" && git init -q
B=/Users/hkc/Documents/motorsandsensors/bin/mns.mjs
node "$B" init >/dev/null && node "$B" enable --host opencode >/dev/null
printf 'secret notes — gated\n' > "$A/notes.txt"
node -e 'const fs=require("node:fs"),p=process.argv[1];const r=JSON.parse(fs.readFileSync(p));r.rules.push({id:"block-notes",action:"deny",tool:"*",pattern:"notes\\.txt",reason:"notes are gated"});fs.writeFileSync(p,JSON.stringify(r,null,2))' "$A/.mns/guardrails/rules.json"
echo "arena ready"
```

- [ ] **Step 2: Run a real OpenCode session that hits the gated file**
```bash
cd ~/Documents/mns-opencode-dogfood && opencode run -m openrouter/google/gemini-2.5-flash "use the bash tool to run: cat notes.txt" > /tmp/oc-dogfood.log 2>&1
```
(Headless with the ultracheap model; if it hangs post-tool per #17516, the gate decision still fires before — check the log/guardrails trail.)

- [ ] **Step 3: Verify the block + the log**
```bash
A=~/Documents/mns-opencode-dogfood
echo "=== guardrail decision logged? ===" && cat "$A"/.mns/live/guardrails-*.jsonl 2>/dev/null
echo "=== run log (should show the tool blocked / error) ===" && grep -iE "guardrail|block|deny|error" /tmp/oc-dogfood.log | head
echo "=== live session captured? ===" && (cd "$A" && node /Users/hkc/Documents/motorsandsensors/bin/mns.mjs status 2>&1 | grep -i opencode | head -2)
```
Expected: a `{host:"opencode",...,action:"deny",rule:"block-notes"}` line in the guardrails log, the run shows the `cat notes.txt` tool was blocked (the model couldn't read it), and an opencode live session recorded. Record the result (incl. interactive-only, if the gate only fires interactively).

- [ ] **Step 4 (if headless gate doesn't fire):** record the finding and note interactive confirmation needed (Codex pattern); ship what verifies.

---

## Self-review (coverage of the spec)
- Gate via `tool.execute.before` throw (Phase-0 mechanism) → Tasks 1+2. Plural dir → Task 2. Fail-open + timeout → Task 2. `{decision}` serializer + opencode gate stdin → Task 1. Dogfood → Task 3.
- Capture path unchanged (finding #3 disproven — no sessionID fix needed). `ask` defers (no native permission.ask reliance). LOG entry: combined exp-12 in the pi plan (executes last).
