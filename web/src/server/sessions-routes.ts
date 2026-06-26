// src/server/sessions-routes.ts — the /api/sessions REST surface.
//
// list · create · read-one · close. Pulled out of server.ts because the create
// route is the single most complex handler in the daemon: an argv allowlist +
// args/type/host validation, then the Wave-B concurrency dance (a root-launched
// agent gets its OWN git worktree so multiple agents run without fighting over
// the one working tree). The squash-merge-on-exit lifecycle stays on the server
// (it serializes closes) and is injected as `closeAgentSession`.

import crypto from "node:crypto";
import { Hono } from "hono";
import type { CreateSessionRequest, SessionCloseResult, SessionDetail } from "#shared/index.js";
import type { Session } from "./session.js";
import { SessionManager } from "./session-manager.js";
import { runZuzuuMut } from "./zuzuu-cli.js";
import { safeJoin } from "./safe-path.js";

export interface SessionsApiDeps {
  /** live getter — switchTo() replaces the manager, so read it per request */
  sessions: () => SessionManager;
  /** live getter — the workspace root is switchable at runtime */
  root: () => string;
  /** commands a `command` session may argv-spawn (host coding-agent CLIs) */
  commandAllowlist: Set<string>;
  /** zuzuu binary override (tests) */
  zuzuuBinary?: string;
  /** agent PTY exited → squash-merge its branch back (serialized on the server) */
  closeAgentSession: (s: Session) => Promise<SessionCloseResult>;
}

export function createSessionsApi(deps: SessionsApiDeps): Hono {
  const app = new Hono();

  app.get("/", (c) => c.json(deps.sessions().list()));

  app.post("/", async (c) => {
    let body: CreateSessionRequest = {};
    try {
      body = await c.req.json<CreateSessionRequest>();
    } catch {
      // empty body is fine
    }
    // Direct command sessions: the allowlist keeps the spawn surface honest
    // (authenticated localhost daemon or not). Argv only — never a shell.
    if (body.command !== undefined) {
      if (typeof body.command !== "string" || !deps.commandAllowlist.has(body.command)) {
        return c.json({ error: "command not allowed" }, 400);
      }
      if (
        body.args !== undefined &&
        (!Array.isArray(body.args) || !body.args.every((a) => typeof a === "string"))
      ) {
        return c.json({ error: "args must be an array of strings" }, 400);
      }
    } else if (body.args !== undefined) {
      return c.json({ error: "args require command" }, 400);
    }
    if (body.type !== undefined && body.type !== "shell" && body.type !== "agent") {
      return c.json({ error: "bad type" }, 400);
    }
    if (body.host !== undefined && (typeof body.host !== "string" || body.host.length > 64)) {
      return c.json({ error: "bad host" }, 400);
    }

    const root = deps.root();
    let cwd = body.cwd ? safeJoin(root, body.cwd) : root;
    const type = body.type ?? "shell";

    // Wave B concurrency: an agent launched at the workspace root gets its OWN
    // git worktree; any failure (non-git workspace, absent CLI) falls back to
    // the in-place model. An explicit subdir cwd opts out (runs in place there).
    let agentId: string | undefined;
    let sessionWorktree = false;
    if (type === "agent" && !body.cwd) {
      const prep = await openAgentWorktree(root, deps.zuzuuBinary);
      cwd = prep.cwd;
      agentId = prep.agentId;
      sessionWorktree = prep.worktree;
    }

    const session = deps.sessions().create(cwd, body.cols, body.rows, {
      ...(body.command !== undefined ? { command: body.command, args: body.args ?? [] } : {}),
      type,
      ...(body.host !== undefined ? { host: body.host } : {}),
      ...(agentId ? { id: agentId } : {}),
      ...(sessionWorktree ? { sessionWorktree: true } : {}),
      ...(type === "agent" ? { onClose: (s: Session) => deps.closeAgentSession(s) } : {}),
    });
    return c.json(session.info(), 201);
  });

  // Single-session read: the SPA polls this once after the Exit frame to pick up
  // closeResult (the agent-exit auto-merge outcome). Awaiting whenClosed() means
  // a poll that races the merge still gets the result.
  app.get("/:id", async (c) => {
    const session = deps.sessions().get(c.req.param("id"));
    if (!session) return c.json({ error: "no such session" }, 404);
    await session.whenClosed();
    const body: SessionDetail = {
      ...session.info(),
      ...(session.closeResult !== undefined
        ? { closeResult: session.closeResult as SessionCloseResult }
        : {}),
    };
    return c.json(body);
  });

  // End a session. For an AGENT this AWAITS the squash-merge close hook (+ the
  // close-time observe) so the end is as complete as a natural exit, and returns
  // the close result (merge outcome + post-close pending count) for the close card.
  // A shell ends instantly (null result). The session is dropped after the merge.
  app.delete("/:id", async (c) => {
    const mgr = deps.sessions();
    const session = mgr.get(c.req.param("id"));
    if (!session) return c.json({ error: "no such session" }, 404);
    const closeResult = await session.endGraceful();
    mgr.drop(session.id);
    return c.json({ ok: true, ...(closeResult ? { closeResult: closeResult as SessionCloseResult } : {}) });
  });

  return app;
}

/**
 * Pre-generate an agent id, open a git worktree for it (own checked-out dir +
 * branch, shared .git), and return its cwd. The id is returned regardless of
 * worktree success so a fall-back in-place session still uses the pre-generated
 * id; on success the session id MUST equal it so close can find the worktree.
 */
async function openAgentWorktree(
  root: string,
  binary?: string,
): Promise<{ cwd: string; agentId: string; worktree: boolean }> {
  const agentId = crypto.randomBytes(8).toString("hex");
  const wt = await runZuzuuMut(root, ["session", "worktree", "open", agentId], { binary });
  const data = wt.ok ? (wt.data as { ok?: boolean; worktree?: string }) : null;
  if (data?.ok && typeof data.worktree === "string") return { cwd: data.worktree, agentId, worktree: true };
  return { cwd: root, agentId, worktree: false };
}
