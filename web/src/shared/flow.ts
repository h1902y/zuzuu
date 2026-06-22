// src/shared/flow.ts — end-to-end terminal flow control (the anti-freeze).
//
// The single mechanism that keeps a flood (`yes`, a giant `cat`) from freezing
// the tab: the server counts bytes sent-but-not-yet-acked; above HIGH_WATER it
// PAUSES the PTY, and resumes once the client's acks drain it below LOW_WATER.
// The client acks only AFTER xterm has actually rendered the bytes, so
// backpressure is real, not guessed. Server (sessions.ts) and client
// (connection.ts) must agree on these exact numbers — hence they live here.

/** Pause the PTY when bytes-in-flight exceed this. */
export const FLOW_HIGH_WATER = 128 * 1024;
/** Resume the PTY once bytes-in-flight fall below this. */
export const FLOW_LOW_WATER = 16 * 1024;
/** The client sends an ack at least every this-many bytes it has written. */
export const ACK_INTERVAL = 32 * 1024;
