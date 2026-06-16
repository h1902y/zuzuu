// Wave D (L5): the daemon Session turns OSC 133 "C" (command output begins)
// into asciicast `m` markers in recording() — navigable per-command chapters in
// the player. Mirror-only parse; the byte stream + client are untouched.
// Real PTY: /usr/bin/printf emits the OSC 133 sequences as output the headless
// mirror parses.

import { describe, it, expect } from "vitest";
import { SessionManager, type Session } from "../src/sessions.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function waitFor(cond: () => boolean, timeoutMs = 8000): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error("waitFor timed out");
    await sleep(40);
  }
}
/** asciicast body lines (skip the header), parsed. */
function castLines(session: Session): [number, string, string][] {
  return session
    .recording()
    .trim()
    .split("\n")
    .slice(1)
    .map((l) => JSON.parse(l) as [number, string, string]);
}

describe("recording markers from OSC 133", () => {
  it("emits one `m` marker per command-output start, numbered in order", async () => {
    const manager = new SessionManager("/tmp");
    // two OSC 133 C sequences (ESC ] 133 ; C ESC \) bracketing output text
    const seq = "\\033]133;C\\033\\\\one\\033]133;C\\033\\\\two";
    const session = manager.create(undefined, 80, 24, { command: "/usr/bin/printf", args: [seq], type: "agent" });
    await waitFor(() => !session.alive);
    await sleep(50);
    const marks = castLines(session).filter(([, code]) => code === "m");
    expect(marks.length).toBe(2);
    expect(marks.map(([, , label]) => label)).toEqual(["1", "2"]);
    manager.shutdown();
  });

  it("a session with no OSC 133 produces no markers (plain recording)", async () => {
    const manager = new SessionManager("/tmp");
    const session = manager.create(undefined, 80, 24, { command: "/bin/echo", args: ["hi"], type: "agent" });
    await waitFor(() => !session.alive);
    await sleep(50);
    expect(castLines(session).some(([, code]) => code === "m")).toBe(false);
    manager.shutdown();
  });
});
