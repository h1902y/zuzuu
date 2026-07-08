// src/cli/verbs/steer.mjs — the `steer` plane: the session-start/close briefs
// (agent-facing prose; deliberately no --json — the text IS the format).
// Composed into THE table by ../commands.mjs.

import { open } from '../../serve/api.mjs';
import { digestText } from '../../serve/digest.mjs';
import { openerText, closerText, steerText, writeHandoff, parkItem, clearParking } from '../../serve/steering.mjs';

export const steerRows = [
  {
    path: ['digest'], plane: 'steer', json: false, permission: 'read', agentInvokable: true,
    usage: 'digest', summary: 'the session-start brief (agent-facing)',
    handler: ({ cwd, log }) => {
      const text = digestText(cwd);
      log(text || '(empty Project — run `zz init`)');
      return 0;
    },
  },
  {
    path: ['start'], plane: 'steer', json: false, permission: 'read', agentInvokable: true,
    usage: 'start', summary: 'the recommended session opener (paste as your first message)',
    handler: ({ cwd, log }) => {
      log(openerText(cwd) || '(no Project — run `zz init`)');
      return 0;
    },
  },
  {
    path: ['wrap'], plane: 'steer', json: false, permission: 'read', agentInvokable: true,
    usage: 'wrap [--note <text>]', summary: 'the recommended session closer; --note saves a handoff',
    handler: ({ args, cwd, log }) => {
      if (args.note) writeHandoff(open(cwd).home, args.note);
      log(closerText(cwd) || '(no Project — run `zz init`)');
      if (args.note) log('\n(handoff saved — `zz start` will surface it next session)');
      return 0;
    },
  },
  {
    path: ['steer'], plane: 'steer', json: false, permission: 'read', agentInvokable: true,
    usage: 'steer [--park <item>]', summary: 'stay on scope — drift signals, parking lot, and guidance',
    handler: ({ args, cwd, log }) => {
      const home = open(cwd).home;
      if (args.clear) { clearParking(home); log('parking lot cleared'); return 0; }
      if (args.park) { parkItem(home, args.park); log(`parked: ${args.park}`); return 0; }
      log(steerText(cwd));
      return 0;
    },
  },
];
