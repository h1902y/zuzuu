// src/server/index.ts — the daemon factory (the composable seam).
//
// createDaemon(cfg) wraps the WebcodeServer (the HTTP + WS engine in server.ts)
// in a tiny { listen, close } handle. The CLI bootstrap — arg parsing, free-port
// scan, token persistence, the singleton instance file, browser open, the
// WEBCODE_HOSTED gate — lives in cli.ts → bin/zz-web.js. Tests construct the
// WebcodeServer (or this factory) directly; nothing imports the bin.

import { WebcodeServer, type ServerConfig } from "./server.js";

export { WebcodeServer } from "./server.js";
export type { ServerConfig } from "./server.js";

export interface Daemon {
  /** Start listening; `onReady` receives the actually-bound port (after the scan). */
  listen(onReady?: (port: number) => void): void;
  /** Stop the live PTYs + close the HTTP/WS server. */
  close(): void;
}

export function createDaemon(cfg: ServerConfig): Daemon {
  const server = new WebcodeServer(cfg);
  return {
    listen: (onReady = () => {}) => server.start(onReady),
    close: () => server.stop(),
  };
}
