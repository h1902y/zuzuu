// The daemon's auth + request-origin gates, extracted from server.ts:
// Host-header allowlist (DNS rebinding), Origin allowlist (cross-site WS
// hijacking / CSRF), and token-in-URL → HttpOnly cookie auth. One AuthGate
// instance guards both the Hono HTTP app and the WS upgrade path.

import crypto from "node:crypto";
import type { MiddlewareHandler } from "hono";
import { getCookie, setCookie } from "hono/cookie";

const AUTH_COOKIE = "webcode_auth";
const COOKIE_MAX_AGE = 30 * 24 * 3600;

export interface AuthGateConfig {
  port: number;
  token: string;
  /** extra allowed origins, e.g. the Vite dev server */
  extraOrigins?: string[];
  /** public hostname the VM is reached at in hosted mode (e.g. "app.fly.dev") */
  publicHost?: string;
}

export class AuthGate {
  private readonly allowedHosts: Set<string>;
  private readonly allowedOrigins: Set<string>;
  private readonly token: string;
  /**
   * The cookie value handed out after a valid token exchange — a STATELESS
   * derivation of the token (sha256), not a random per-session secret. This is
   * the core of cross-restart auth: any daemon started with the same token
   * derives the same cookie value, so a browser cookie set by one daemon is
   * accepted by a later daemon (with the persisted token, this survives
   * restarts). Security is unchanged: the cookie is only ever set after the
   * caller presents the real token; it's HttpOnly+SameSite=Strict so a local
   * page can neither read it nor forge it (it can't compute sha256(token)).
   */
  private readonly cookieValue: string;

  constructor(cfg: AuthGateConfig) {
    this.token = cfg.token;
    this.cookieValue = crypto.createHash("sha256").update(cfg.token).digest("base64url");
    const hostNames = ["127.0.0.1", "localhost", "[::1]"];
    this.allowedHosts = new Set(hostNames.flatMap((h) => [h, `${h}:${cfg.port}`]));
    this.allowedOrigins = new Set([
      ...hostNames.map((h) => `http://${h}:${cfg.port}`),
      ...(cfg.extraOrigins ?? []),
    ]);
    // hosted: also accept the public hostname (Fly's edge sets Host to it);
    // Host/Origin defense stays on, just widened to the one public origin.
    if (cfg.publicHost) {
      this.allowedHosts.add(cfg.publicHost.toLowerCase());
      this.allowedOrigins.add(`https://${cfg.publicHost}`);
      this.allowedOrigins.add(`http://${cfg.publicHost}`);
    }
  }

  /** Host allowlist defeats DNS rebinding: rebinding changes DNS, not the Host header. */
  hostAllowed(host: string | undefined): boolean {
    return !!host && this.allowedHosts.has(host.toLowerCase());
  }

  /** Origin allowlist defeats cross-site WS hijacking / CSRF from arbitrary websites. */
  originAllowed(origin: string | undefined): boolean {
    return origin === undefined || this.allowedOrigins.has(origin);
  }

  /** WS upgrade path: is the request's cookie the token-derived value? */
  cookieAuthed(cookieHeader: string | undefined): boolean {
    if (!cookieHeader) return false;
    const match = /(?:^|;\s*)webcode_auth=([^;]+)/.exec(cookieHeader);
    return !!match && timingSafeEqualStr(match[1]!, this.cookieValue);
  }

  /**
   * The WS-upgrade gate: Host + Origin + cookie checks in order, returning the
   * first failure. The socket-path mirror of gate()+requireAuth() — keeping all
   * auth decisions in this one file rather than hand-wired at the upgrade site.
   */
  upgradeAllowed(headers: { host?: string; origin?: string; cookie?: string }):
    | { ok: true }
    | { ok: false; status: number; msg: string } {
    if (!this.hostAllowed(headers.host)) return { ok: false, status: 403, msg: "Forbidden" };
    if (!this.originAllowed(headers.origin)) return { ok: false, status: 403, msg: "Forbidden" };
    if (!this.cookieAuthed(headers.cookie)) return { ok: false, status: 401, msg: "Unauthorized" };
    return { ok: true };
  }

  /** App-wide gate: Host/Origin allowlists + the ?token= → cookie exchange. */
  gate(): MiddlewareHandler {
    return async (c, next) => {
      if (!this.hostAllowed(c.req.header("host"))) {
        return c.text("forbidden host", 403);
      }
      if (!this.originAllowed(c.req.header("origin"))) {
        return c.text("forbidden origin", 403);
      }
      // Token exchange: any page request carrying ?token= gets a cookie.
      const token = c.req.query("token");
      if (token && !c.req.path.startsWith("/api/")) {
        if (!timingSafeEqualStr(token, this.token)) return c.text("invalid token", 403);
        setCookie(c, AUTH_COOKIE, this.cookieValue, {
          httpOnly: true,
          sameSite: "Strict",
          path: "/",
          maxAge: COOKIE_MAX_AGE,
        });
        const url = new URL(c.req.url);
        url.searchParams.delete("token");
        // /auth?token=… exists so the Vite dev server can proxy the
        // exchange; land on the app root afterwards either way.
        const dest = url.pathname === "/auth" ? "/" : url.pathname + url.search;
        return c.redirect(dest);
      }
      await next();
    };
  }

  /** /api/* gate: only cookie-authenticated sessions pass. */
  requireAuth(): MiddlewareHandler {
    return async (c, next) => {
      if (!timingSafeEqualStr(getCookie(c, AUTH_COOKIE) ?? "", this.cookieValue)) {
        return c.json({ error: "unauthorized" }, 401);
      }
      await next();
    };
  }
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}
