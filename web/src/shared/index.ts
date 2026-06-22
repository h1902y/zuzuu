// src/shared — the wire contract both halves import via `#shared`.
//
// The ONLY thing server/ and client/ both depend on; a plain DAG (shared →
// server, shared → client, no edge back). Was the published @zuzuu-web/protocol
// package — now a plain internal module, so there is no vendor step and no
// version skew between client and server.
//
//   opcodes  the binary terminal WS frames (1-byte opcode + payload)
//   flow     the end-to-end flow-control watermarks (the anti-freeze)
//   rest     the daemon's JSON REST contract (sessions/fs/git/search/workflows)
//   zuzuu    the modules-dashboard contract (the brain surface)

export * from "./opcodes.js";
export * from "./flow.js";
export * from "./rest.js";
export * from "./zuzuu.js";
