// `mns capture` — parse a host transcript, write a git-native trace + session record.

import { ADAPTERS, byName, detected } from '../../experiments/experiment-1-trace-capture/adapters/registry.mjs';
import { eventsToSpans } from '../../experiments/experiment-1-trace-capture/core/spans.mjs';
import { toExportRequest } from '../../experiments/experiment-1-trace-capture/core/otlp.mjs';
import { EventKind, Status } from '../../experiments/experiment-1-trace-capture/core/event.mjs';
import { makeSession } from '../session.mjs';
import { writeTrace, upsertSession, gitInfo, paths } from '../store.mjs';

function chooseRef(adapter, args) {
  if (args.file) return args.file;
  const sessions = adapter.listSessions({ cwd: process.cwd(), project: args.project });
  let pool = sessions;
  if (args.session) pool = pool.filter((s) => s.sessionId === args.session || s.sessionId.includes(args.session));
  if (!pool.length) throw new Error(`no matching session for ${adapter.name} (found ${sessions.length})`);
  return pool[0].ref;
}

export function capture(args) {
  const adapter = args.host ? byName(args.host) : detected()[0];
  if (!adapter) {
    console.error(args.host ? `unknown host: ${args.host} (known: ${ADAPTERS.map((a) => a.name).join(', ')})` : 'no host detected — run `mns status`');
    process.exit(1);
  }

  const trace = adapter.parse(chooseRef(adapter, args));
  const { traceId, spans } = eventsToSpans(trace);
  const request = toExportRequest({ traceId, spans }, { host: trace.host, sessionId: trace.sessionId });
  const traceRef = writeTrace(trace.host, trace.sessionId, [request]);

  const root = trace.events.find((e) => e.kind === EventKind.SESSION) || trace.events[0];
  const counts = {
    turns: trace.events.filter((e) => e.kind === EventKind.TURN).length,
    tools: trace.events.filter((e) => e.kind === EventKind.TOOL_CALL).length,
    errors: trace.events.filter((e) => e.kind === EventKind.TOOL_CALL && e.status === Status.ERROR).length,
  };
  const record = makeSession({
    id: trace.sessionId,
    host: trace.host,
    startedAt: new Date(root.startMs).toISOString(),
    endedAt: new Date(root.endMs).toISOString(),
    traceId,
    traceRef,
    git: gitInfo(),
    counts,
  });
  upsertSession(record);

  const { index } = paths();
  console.log(`captured ${record.host} session ${record.id}`);
  console.log(`  status   : ${record.status}`);
  console.log(`  spans    : ${spans.length}  (turns:${counts.turns}, tools:${counts.tools}, errors:${counts.errors})`);
  console.log(`  git      : ${record.git.commit ? record.git.commit.slice(0, 8) : '(no repo)'} ${record.git.branch || ''}`);
  console.log(`  trace    : ${traceRef}  (git-ignored)`);
  console.log(`  indexed  : ${index}  (tracked)`);
  console.log(`  inspect  : mns trace --last`);
}
