# The terminal, mechanically — PTY, opcodes, backpressure

> A companion to lesson [`09 · The workbench`](09-the-workbench.md). That page tells
> you *what* the workbench is and *why it was ported, not rewritten*. This page goes
> one layer down: the OS and networking primitives the whole thing stands on. Read it
> when you're about to touch `web/src/shared/opcodes.ts`, `shared/flow.ts`,
> `server/sessions.ts`, or `client/term/connection.ts` — or whenever "PTY" and
> "opcode" feel like words you nod at rather than know.

Everything here exists to answer one deceptively hard question: **how do you put a
real shell in a browser tab without it freezing, lying, or dying on reload?**

## The end-to-end path

When you type `ls` and see colored output, the bytes travel:

```
keystroke (browser xterm.js)
  → WebSocket binary frame → daemon (server/ws-term.ts)
  → write into the PTY master → the shell reads it on stdin
  → bash runs ls, writes to stdout → PTY master → daemon reads
  → WebSocket binary frame → xterm.js renders pixels
```

Two primitives in that loop are unfamiliar — the **PTY** and the **binary frame /
opcode**. The rest of the machinery (flow control, the mirror) exists only to keep
that loop from falling over.

## PTY — the kernel's fake terminal

Programs like `bash`, `vim`, `top`, and `claude` don't read-a-line-print-a-line.
They expect to be attached to a *terminal*: they detect their width to wrap text,
flip into "raw mode" so arrow keys and Ctrl-C work, clear the screen, emit color,
and ask "am I interactive or piped?". Wire `bash`'s stdin/stdout to a plain network
pipe and all of that breaks — `isatty()` returns false and bash degrades to a dumb
line reader: no prompt, no colors, no job control.

So the kernel offers a **pseudo-terminal** — a *fake* terminal that fools the program.
It's a pair of connected file descriptors:

```
        ┌──────────── kernel PTY pair ────────────┐
daemon  │  master  <===============>  slave        │  bash
holds → │  (write keystrokes here,    (bash attached│ ← isatty() == true,
        │   read output here)          here, fooled) │   thinks it's a real TTY
        └──────────────────────────────────────────┘
```

Bytes the daemon writes to the **master** appear on bash's stdin as if typed. Bytes
bash writes to stdout come back out the master. The kernel also carries terminal
*control* over this channel — window size, `SIGINT` on Ctrl-C, the line discipline.

`@lydell/node-pty` is the native addon that spawns a process attached to a fresh PTY
and hands the daemon the master as a Node stream. That's why it's a *native build*
and a runtime dependency: it calls the OS PTY syscalls directly. It's also the reason
the daemon **can't be a serverless function** — a PTY is a long-lived OS object with a
live process attached to it. `server/sessions.ts` owns these masters, keyed by id.

## What flows through it: bytes, some of which are commands

The PTY output isn't structured data — it's a raw **byte stream** that mixes printable
text with **escape sequences** (in-band control codes). When `ls` paints a directory
blue, the literal bytes are:

```
\x1b[34m   docs   \x1b[0m
  ↑set blue        ↑reset
```

xterm.js is a **terminal emulator**: it parses that stream and turns the escape codes
into rendered color, cursor moves, screen clears. The daemon mostly shuttles bytes
without interpreting them — with two exceptions it *does* watch for, both injected by
`server/shell-integration/`:

- **OSC 133** — command-boundary markers ("a command started / ended here"), which
  power the navigable `.cast` recordings (`server/cast.ts`).
- **OSC 7** — the shell reporting its working directory, which becomes the `Cwd` frame.

The key realization: *a terminal is a byte stream where some bytes are text and some
bytes are instructions to the renderer.* That single fact forces the next decision.

## Opcodes — why the wire isn't JSON

The daemon and browser talk over a **WebSocket**, which can send **text frames**
(UTF-8, what JSON needs) or **binary frames** (raw bytes). The obvious design —
`{"type":"output","data":"..."}` — fails twice: the PTY emits arbitrary bytes
(invalid UTF-8, control bytes) so you'd have to base64 every chunk (+33% on a `yes`
flood), and you'd parse JSON on *every* chunk just to learn "this is output, render
it."

So the terminal socket speaks a tiny **binary protocol** (`shared/opcodes.ts`). An
**opcode** — "operation code" — is the oldest idea in computing: a small fixed-size
number that names *what kind* of thing this is. A CPU instruction is an opcode byte
plus operands; here it's a frame:

```
┌────────┬───────────────────────────────┐
│ 1 byte │  payload                       │
│ opcode │  raw bytes (I/O) | JSON (ctrl) │
└────────┴───────────────────────────────┘
```

The receiver reads **one byte** and knows how to treat the rest:

```
ClientOp (browser → daemon)        ServerOp (daemon → browser)
  0x00 Input   raw keystrokes        0x00 Output   raw PTY bytes → render
  0x01 Resize  JSON {cols,rows}      0x01 Exit     JSON {exitCode}
  0x02 Ack     JSON {bytes}          0x02 Replay   raw snapshot bytes
                                     0x03 Title    JSON {title}
                                     0x04 Cwd      JSON {cwd}
```

So the hot path — terminal output — is **`0x00` + raw bytes: zero parsing, zero
encoding.** Only rare control messages pay the JSON cost. `server/frames.ts` is the
whole codec: encode = `[op, ...payload]`; decode = read byte 0, slice the rest.

(`Input` and `Output` are both `0x00` on purpose — **direction disambiguates**. A
frame from the client is always a `ClientOp`, from the server always a `ServerOp`;
they're two separate enums, not one shared space. This is the "ttyd-style" framing the
file comment names — `ttyd` popularized the convention.)

## Flow control — the part that's genuinely hard

This lives in `shared/flow.ts`, and it's where a naive terminal freezes the tab.

Run `yes` or `cat hugefile`: the PTY emits megabytes a second — far faster than the
browser can paint. Forward every byte blindly and xterm's render queue backs up,
memory balloons, the main thread saturates, the tab dies. This is the classic
**producer/consumer mismatch**, and the cure is **backpressure**: a way for the slow
consumer to tell the fast producer "slow down."

The subtlety: the daemon can't see the browser's render queue across the network, and
"I put bytes on the socket" is a lie (OS and WebSocket buffers hide a lot). So the
design measures backpressure at the *only honest point* — **after xterm has actually
painted the bytes:**

```
HIGH_WATER = 128 KB   LOW_WATER = 16 KB   ACK_INTERVAL = 32 KB
```

1. The daemon tracks **bytes-in-flight** = sent but not yet acked.
2. The browser sends an `Ack` *only after xterm finishes rendering* a chunk
   (at least every 32 KB).
3. Above **128 KB** in flight → daemon **pauses the PTY** (stops reading the master;
   the kernel pipe fills; the shell's `write()` blocks — the producer throttles *at
   the source*).
4. As acks drain it below **16 KB** → **resume**.

```
bytes-in-flight
 128KB ┤━━━━━━━━  ← cross HIGH → PAUSE the pty
       │   ╲
       │    ╲   (acks arrive as xterm renders)
  16KB ┤━━━━━╲━  ← cross LOW → RESUME the pty
       │      ╲
     0 ┴──────────────────────────► time
```

Two design choices earn their keep here:

- **Two watermarks, not one threshold** — that gap is *hysteresis*. A single line at
  128 KB would pause/resume hundreds of times a second as you hover it (flapping);
  the 16–128 KB band means "once paused, stay paused until things genuinely calm."
  Same logic as a thermostat that doesn't click every second.
- **Ack-after-render, not ack-on-receive** — the goal is to bound the *renderer's*
  backlog (the actual bottleneck), not the network's. Acking after paint makes the
  backpressure *real*, not guessed.

The `tests/e2e` flood test is the canary: it floods past 128 KB and asserts every byte
arrives. Break the ack→pause→resume loop and that test **hangs** — bytes-in-flight
never drains, the PTY stays paused forever. That's why these numbers live in
`shared/`: server and client must agree on them byte-for-byte, or one side throttles
against numbers the other has never heard of.

## The headless mirror — why a PTY outlives its socket

A WebSocket dies constantly: reload, laptop sleep, a 10-second wifi blip. But the
**shell must survive** — you don't want `npm run build` killed because you refreshed.
So the daemon **decouples the PTY from the socket**: the PTY lives in a process-local
map keyed by id; the socket is just a pipe that attaches and detaches.

That leaves one problem: a reconnecting tab is **blank** — it missed everything that
scrolled by. Replaying the entire byte history would be enormous. The fix is a
**headless mirror**: the daemon runs a real `@xterm/headless` terminal (xterm with no
display) fed the same bytes as the browser, so it always holds the *current screen +
scrollback* in memory. On reconnect the daemon serializes that state
(`@xterm/addon-serialize`) into a compact blob of escape sequences and sends it as the
**`Replay` frame (`0x02`)** — excluded from flow-control accounting, because it's a
one-shot state restore, not live output. The browser paints the snapshot instantly,
then streams live.

```
PTY ──┬──► browser socket   (comes and goes)
      └──► headless mirror   (always on; holds the screen)
                 │
       reload ──►│ serialize() → one Replay frame → fresh tab paints instantly
```

That's the whole reason "sessions survive reloads": the PTY never died, and the mirror
lets a new socket catch up in a single frame instead of replaying history.

## The terms, in one place

| Term | Meaning |
|---|---|
| **PTY** | pseudo-terminal — a kernel-faked terminal (master/slave fd pair) so CLI programs behave as if on a real TTY |
| **master / slave** | the two ends of the pair; the daemon holds the master, the shell is attached to the slave |
| **opcode** | a small fixed number (here 1 byte) naming *what kind* of message a frame is |
| **frame** | one WebSocket message = `[opcode byte][payload]` |
| **binary vs text frame** | WebSocket carries raw bytes or UTF-8; terminal I/O uses binary to skip encoding overhead |
| **escape sequence** | in-band control bytes (`\x1b[34m`) the emulator reads as color/cursor/clear |
| **OSC 133 / OSC 7** | escape sequences for command-boundary markers / cwd reporting |
| **xterm.js** | the browser terminal *emulator* — parses the byte stream, renders the screen |
| **flow control / backpressure** | throttling the PTY when the renderer falls behind |
| **watermark (high/low)** | the two thresholds (128 KB / 16 KB) with hysteresis to avoid flapping |
| **ack** | the client's "I rendered N bytes" message that drives backpressure |
| **headless mirror** | a displayless xterm on the server holding screen state for replay-on-reconnect |
| **serialize / replay** | snapshot the mirror → one frame that restores a reconnecting tab |

These primitives are exactly what `shared/` encodes — `opcodes.ts` is the frame
grammar, `flow.ts` is the backpressure constants — and they live in `shared/`
precisely because *both ends must agree on them to the byte.*
