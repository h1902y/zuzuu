// zuzuu/cli/doctor.mjs — health, inventory, and crash reconciliation.
//
// what: `zz doctor` (is everything wired? any leftover/crashed session?),
//       `zz status` (detected hosts + recorded sessions), `zz explain` (porcelain
//       — what this home is). All read-only.
// why:  transparency is the .git model: the home is plain text + porcelain. These
//       are the porcelain — they let a human (or agent) see the machine's state
//       without reading internals. doctor surfaces a crashed session's leftover
//       branch (the recovery path), never auto-merging it.
// how:  compose kernel/store + hosts/registry + sessions/ + the check verb.
//       Zero-dep, fail-soft (a broken probe degrades to a warning).

import { existsSync } from 'node:fs';
import { gitInfo, homeDir, repoRoot } from '../notes/store.mjs';
import { readIndex } from '../sessions/record.mjs';
import { detected } from '../hosts/registry.mjs';
import { sessionStatus } from '../sessions/session-git.mjs';
import { hooksInstalled } from './enable.mjs';
import { leftoverWarning } from './session.mjs';
import { open } from '../serve/api.mjs';
import { toon } from '../notes/toon.mjs';

/** A structured health report: {problems[], warnings[], info[], ok}. */
export function doctorReport(cwd = process.cwd()) {
  const problems = [], warnings = [], info = [];
  const home = homeDir(repoRoot(cwd));

  const { commit, branch } = gitInfo(cwd);
  if (commit) info.push(`git: on ${branch ?? '(detached)'} @ ${commit.slice(0, 8)}`);
  else warnings.push('not a git repo — session branches + checkpoints are disabled');

  if (existsSync(home)) {
    const zz = open(cwd);
    const mods = zz.modules();
    info.push(`home: ${home} (${mods.length} module${mods.length === 1 ? '' : 's'})`);
    if (!mods.length) problems.push('home has no modules — run `zz init`');
    // integrity: broken links across modules
    let broken = 0;
    for (const m of mods) { const r = zz.check(m.id); if (r.ok) broken += r.value.broken.length; }
    if (broken) warnings.push(`${broken} broken link(s) — see \`zz check\``);
  } else {
    problems.push(`no .zuzuu/ home — run \`zz init\``);
  }

  const hosts = detected();
  if (hosts.length) info.push(`hosts detected: ${hosts.map((h) => h.name).join(', ')}`);
  else warnings.push('no coding-agent hosts detected on this machine');

  info.push(`hooks: ${hooksInstalled(cwd) ? 'installed' : 'not installed (run `zz enable`)'}`);

  // a leftover/crashed session branch — surface the recovery path, never auto-act
  try { const lw = leftoverWarning(sessionStatus(cwd)); if (lw) warnings.push(lw); } catch { /* fail-soft */ }

  return { problems, warnings, info, ok: problems.length === 0 };
}

export function doctor(cwd, log) {
  const r = doctorReport(cwd);
  for (const i of r.info) log(`  · ${i}`);
  for (const w of r.warnings) log(`  ⚠ ${w}`);
  for (const p of r.problems) log(`  ✗ ${p}`);
  log(r.ok ? `\n✓ healthy${r.warnings.length ? ` (${r.warnings.length} warning${r.warnings.length === 1 ? '' : 's'})` : ''}` : `\n✗ ${r.problems.length} problem(s)`);
  return r.ok ? 0 : 1;
}

export function status(cwd, log) {
  const rows = detected().map((h) => {
    let n = 0; try { n = h.listSessions({ cwd }).length; } catch { /* flaky host */ }
    return { host: h.name, sessions: n };
  });
  log(toon('hosts', rows, ['host', 'sessions']));
  const idx = readIndex(cwd);
  log(toon('recorded', idx.sessions.slice(0, 10).map((s) => ({ id: String(s.id).slice(0, 12), host: s.host, status: s.status })), ['id', 'host', 'status']));
  try { const lw = leftoverWarning(sessionStatus(cwd)); if (lw) log(lw); } catch { /* fail-soft */ }
  return 0;
}

const TOPICS = {
  home: 'The `.zuzuu/` home is a directory of envelopes (markdown + frontmatter). Each subdir is a module; each items/<id>.md is a zu. Tracked = the durable brain; .live/ + .generations/.store/ = local/derived.',
  loop: 'observe → enhance → propose → review → write + snapshot. zuzuu watches your sessions, suggests changes, you approve them, the brain grows — every write human-gated.',
  modules: 'knowledge (facts) · memory (episodes) · actions (runnable procedures) · instructions (steering) · guardrails (enforced tool gates). Generic — no per-module code.',
  verbs: 'query · act · enhance · review · check, plus init · enable · digest · session · module · doctor.',
};

export function explain(topic, log) {
  if (topic && TOPICS[topic]) { log(TOPICS[topic]); return 0; }
  log('zz explain <topic> — ' + Object.keys(TOPICS).join(' · '));
  for (const [k, v] of Object.entries(TOPICS)) log(`\n## ${k}\n${v}`);
  return 0;
}
