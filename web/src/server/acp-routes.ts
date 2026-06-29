// web/src/server/acp-routes.ts — REST surface for the ACP drive lane (Spike #2).
// POST /api/acp creates a session (spawns the adapter + handshake) → { id }; the
// browser then attaches the structured stream over WS /ws/acp/:id. DELETE closes it.
import { Hono } from "hono";
import type { AcpManager } from "./acp.js";

export function createAcpApi(deps: { acp: () => AcpManager }): Hono {
  const app = new Hono();

  app.post("/", async (c) => {
    try {
      const s = await deps.acp().create();
      return c.json({ id: s.id });
    } catch (e) {
      return c.json({ error: String((e as Error)?.message ?? e) }, 500);
    }
  });

  app.delete("/:id", (c) => {
    deps.acp().close(c.req.param("id"));
    return c.json({ ok: true });
  });

  return app;
}
