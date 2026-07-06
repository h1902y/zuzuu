// src/cli/doctor.mjs — health, inventory, and crash reconciliation.
//
// what: `zz doctor` (is everything wired? any leftover/crashed session?),
//       `zz status` (detected hosts + session-branch state), `zz explain`
//       (porcelain — what this home is). All read-only.
// why:  transparency is the .git model: the home is plain text + porcelain. These
//       are the porcelain — they let a human (or agent) see the machine's state
//       without reading internals. doctor surfaces a crashed session's leftover
//       branch (the recovery path), never auto-merging it.
// how:  compose notes/store + hosts/registry + sessions/ + the check verb.
//       Zero-dep, fail-soft (a broken probe degrades to a warning).

import { existsSync } from 'node:fs';
import { gitInfo, isGitRepo, homeDir, repoRoot } from '../notes/store.mjs';
import { detected } from '../hosts/registry.mjs';
import { sessionStatus } from '../sessions/session-git.mjs';
import { hooksInstalled } from './enable.mjs';
import { leftoverWarning } from './session.mjs';
import { open } from '../serve/api.mjs';
import { toon } from '../notes/toon.mjs';
import { listTriggers } from '../grow/trigger.mjs';
import { readNote } from '../notes/repo.mjs';
import { gateWriteVerbPattern } from './commands.mjs';
import { isAutonomyEnabled } from '../grow/autonomy.mjs';
import { readTickLog } from '../grow/tick-state.mjs';

/** A structured health report: {problems[], warnings[], info[], ok}. */
export function doctorReport(cwd = process.cwd()) {
  const problems = [], warnings = [], info = [];
  const home = homeDir(repoRoot(cwd));

  const { commit, branch } = gitInfo(cwd);
  if (commit) info.push(`git: on ${branch ?? '(detached)'} @ ${commit.slice(0, 8)}`);
  // a real repo with NO commits yet (unborn HEAD) is NOT "not a git repo" — git can't
  // branch off an unborn HEAD, so session branches need a first commit, but say so
  // accurately + actionably instead of the misleading "not a git repo".
  else if (isGitRepo(cwd)) warnings.push('git repo has no commits yet — make an initial commit to enable session branches + checkpoints');
  else warnings.push('not a git repo — session branches + checkpoints are disabled');

  if (existsSync(home)) {
    const zz = open(cwd);
    const mods = zz.modules();
    info.push(`home: ${home} (${mods.length} module${mods.length === 1 ? '' : 's'})`);
    if (!mods.length) problems.push('home has no modules — run `zz init`');
    // integrity: broken links + ungated notes. check() is project-wide, so ONE call
    // covers every module (no per-module summing → no overcount).
    let broken = 0, ungated = 0;
    if (mods.length) {
      const r = zz.check(mods[0].id);
      if (r.ok) { broken = r.value.broken.length; ungated = (r.value.ungated ?? []).length; }
    }
    if (broken) warnings.push(`${broken} broken link(s) — see \`zz check\``);
    if (ungated) warnings.push(`${ungated} note(s) added outside review — see \`zz check\` (propose via \`zz stage\`; \`zz init\` reconciles seeds)`);
    // the wake source (U6, docs/plans/2026-07-06-001-feat-wake-source-tick-plan.md):
    // the honest boundary is no longer "nothing fires on its own" — an opted-in local
    // tick (`zz autonomy on`) fires ENABLED triggers while the machine is awake, still
    // gated + fail-closed (KTD2's unattended posture), still no cloud (the hosted
    // 24/7 tier stays deferred). Mirror `zz autonomy status`'s own read (U4,
    // `cli/verbs/autonomy.mjs`'s `lastTickEntry`): the opt-in flag
    // (`grow/autonomy.mjs`'s `isAutonomyEnabled`) + the last tick-decision-log entry
    // (`grow/tick-state.mjs`'s `readTickLog` — the unattended record of what
    // fired/skipped/denied each tick). Surfaced unconditionally (ON or OFF) so the
    // switch's position is never silent — same spirit as the exec-gate check above.
    if (mods.length) {
      if (isAutonomyEnabled(zz.home)) {
        const entries = readTickLog(zz.home);
        const last = entries.length ? entries[entries.length - 1] : null;
        info.push(last
          ? `autonomy: ON — last tick ${last.ts}, fired ${last.fired}`
          : 'autonomy: ON — no tick has run yet (`zz tick --once`, or `zz web --autonomy` / `zz daemon` on a cadence)');
      } else {
        const idle = listTriggers(zz.home).filter((t) => t.enabled).length;
        warnings.push(`autonomy: OFF — ${idle} enabled trigger(s) idle (run \`zz autonomy on\` to enable the local tick)`);
      }
    }
    // exec-gate staleness (SHOULD-FIX 1, docs/audits/2026-07-03-triggers-review.md): the
    // `protect-brain-exec` rule's stored PATTERN is a snapshot of gateWriteVerbPattern()
    // taken the last time `zz init` seeded/reconciled it — if a write verb is added to
    // the command table afterward (e.g. `zz trigger fire`), an EXISTING Project's stored
    // pattern goes stale and the new verb slips the Bash-bypass gate unblocked, silently.
    // A root-mode Project seeded before this fix never got the rule AT ALL (root-mode
    // used to skip every `protect-brain-*` rule, including this non-path-scoped one) —
    // surfaces the same way, as "missing entirely". `zz init` reconciles/seeds it; name
    // the gap here so it's caught before it bites, not after.
    if (mods.length) {
      try {
        const execRule = readNote(home, 'instructions', 'protect-brain-exec');
        const current = gateWriteVerbPattern();
        if (!execRule) {
          warnings.push('no protect-brain-exec exec-gate rule — an agent could shell a `zz` write verb (e.g. `zz trigger fire`) unblocked; run `zz init` to seed it');
        } else if (execRule.pattern !== current) {
          warnings.push('the protect-brain-exec exec-gate pattern is stale (a write verb was added to the command table since this Project was last seeded) — run `zz init` to reconcile it');
        }
      } catch { /* fail-soft — a broken probe degrades to silence, not a crash */ }
    }
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
  try { const lw = leftoverWarning(sessionStatus(cwd)); if (lw) log(lw); } catch { /* fail-soft */ }
  return 0;
}

const TOPICS = {
  home: 'The `.zuzuu/` home is this repo\'s Project — a directory of envelopes (markdown + frontmatter). Each subdir is a module; each items/<id>.md is a note. The whole tree is the durable Project (it travels in git); only `worktrees/` is local. The rebuildable index cache + run-state live outside the repo (OS cache/state dirs).',
  grow: 'observe → stage → review → evolve. zuzuu watches your sessions, stages changes, you approve them, the Project grows (write the note + mint a generation) — every write human-gated.',
  modules: 'knowledge (facts) · memory (episodes) · actions (runnable procedures) · instructions (steering) · guardrails (enforced tool gates). Generic — no per-module code.',
  verbs: 'query · act · check · review, plus observe · init · enable · digest · session · module · doctor.',
};

export function explain(topic, log) {
  if (topic && TOPICS[topic]) { log(TOPICS[topic]); return 0; }
  log('zz explain <topic> — ' + Object.keys(TOPICS).join(' · '));
  for (const [k, v] of Object.entries(TOPICS)) log(`\n## ${k}\n${v}`);
  return 0;
}
