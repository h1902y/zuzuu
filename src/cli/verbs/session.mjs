// src/cli/verbs/session.mjs — the `session` plane: the per-session git surface.
// Thin rows over cli/session.mjs's sub-dispatcher; the namespace-root row carries
// the write-subcommand declarations the execution gate derives its deny set from.
// Composed into THE table by ../commands.mjs.

import { sessionCommand } from '../session.mjs';

export const sessionRows = [
  {
    path: ['session'], plane: 'session', json: true, permission: 'admin', agentInvokable: false,
    // The session handler sub-dispatches its OWN write verbs (not standalone rows): the
    // deprecated aliases merge/finalize/continue/discard (byte-equivalent to land/hold/
    // resume/drop, which DO have rows) AND the destructive worktree ops. Without these in
    // the deny set, the gate denied `zz session drop --yes` but ALLOWED the alias `zz session
    // discard --yes` (and `zz session worktree discard <id> --yes`) — the agent could delete a
    // held session branch + checkpoints at the merge gate. `status`/`label` stay reads (allowed).
    writeSubcommands: ['merge', 'finalize', 'continue', 'discard', 'worktree close', 'worktree finalize', 'worktree discard'],
    usage: 'session [status | land | hold | resume | drop | worktree … | label]',
    summary: 'inspect & steer the per-session git substrate',
    handler: ({ args, cwd, log, warn }) => sessionCommand(args, cwd, log, warn),
  },
  {
    path: ['session', 'land'], plane: 'session', json: true, permission: 'admin', agentInvokable: false,
    usage: 'session land [id]', summary: 'land a session — squash-merge (auto-detects worktree vs in-place)',
    handler: ({ args, cwd, log, warn }) => sessionCommand({ ...args, _: ['land', ...args._] }, cwd, log, warn),
  },
  {
    path: ['session', 'hold'], plane: 'session', json: true, permission: 'admin', agentInvokable: false,
    usage: 'session hold [id]', summary: 'hold a session for the merge gate (auto-detects worktree)',
    handler: ({ args, cwd, log, warn }) => sessionCommand({ ...args, _: ['hold', ...args._] }, cwd, log, warn),
  },
  {
    path: ['session', 'resume'], plane: 'session', json: true, permission: 'admin', agentInvokable: false,
    usage: 'session resume [id]', summary: 'resume a held session (back onto its branch)',
    handler: ({ args, cwd, log, warn }) => sessionCommand({ ...args, _: ['resume', ...args._] }, cwd, log, warn),
  },
  {
    path: ['session', 'drop'], plane: 'session', json: true, permission: 'admin', agentInvokable: false,
    usage: 'session drop [id] --yes', summary: 'drop a session — DELETE its branch + checkpoints',
    handler: ({ args, cwd, log, warn }) => sessionCommand({ ...args, _: ['drop', ...args._] }, cwd, log, warn),
  },
];
