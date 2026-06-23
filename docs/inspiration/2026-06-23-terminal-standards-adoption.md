---
title: Can we adopt a standard for the terminal layer instead of building it?
date: 2026-06-23
kind: prior-art-audit / decision
method: 3 parallel web-researchers — SSH-over-web · WebTransport 2026 · broad standards sweep
verdict: No standard exists for the core; adopt at the layers where standards DO exist (already done); hedge the transport behind a pluggable seam; WebTransport is cloud-waves-only and gated.
---

# Adopting a standard vs. building the terminal layer

The owner's goal: stop maintaining hand-rolled protocol / flow-control / replay; adopt an
open standard instead. Three researchers evaluated SSH, WebTransport, and a broad sweep
of every other candidate. The blunt finding: **there is no standard to adopt for the
core terminal stream — and the part you'd most want to outsource (render-gated flow
control + reconnect-replay) is exactly the part no standard covers.** Every serious
browser-facing product rolls its own, for principled reasons. The honest move is to
adopt standards at the layers where they exist (you already do), and hedge the one layer
where a standard is genuinely coming (the cloud transport).

## The layered truth: what's standardized, where

| Layer | Standard exists? | Status in zuzuu |
|---|---|---|
| Byte semantics (escape codes) | **Yes** — ECMA-48 / ISO 6429, DEC modes | ✅ Adopted via xterm.js |
| Shell integration / cwd | **De-facto** — OSC 133 / OSC 7 | ✅ Adopted (`shell-integration/`) |
| **Paste / input batching** | **Yes** — bracketed paste (`\x1b[200~`) | ➡️ The mechanism for the **composer** input path |
| Recording | **De-facto** — asciicast v2 | ✅ Adopted (`cast.ts`) |
| Transport (today) | **Yes** — WebSocket (RFC 6455) | ✅ Used |
| **Frame protocol** (1-byte opcode) | **None** — ttyd convention only; no IANA subprotocol | 🔨 Hand-rolled — nothing to adopt |
| **Render-gated flow control** | **None** — xterm.js docs say "no standard exists" | 🔨 Hand-rolled — *irreducibly yours* |
| **Reconnect / replay** | **None** — every product differs | 🔨 Hand-rolled (headless mirror) |
| Transport (cloud, future) | **Emerging** — WebTransport (HTTP/3+QUIC) | ⏳ Cloud-waves-only, gated (below) |

The recurring conclusion across all three reports: **render-gating and replay are
application-layer by necessity** — no transport standard (SSH windows, QUIC flow control,
HTTP/2 WINDOW_UPDATE) is renderer-aware, so none can replace the ack-after-paint loop.
That layer is not a gap in your engineering; it's the part that resists standardization.

## Verdict 1 — SSH: reject (net-addition, not reduction)

SSH is the standard for *reaching a remote shell you can't directly touch*. **zuzuu's
daemon already holds the PTY on the same VM** — there is no remote hop. Adopting SSH
means running an ssh client+server on one machine to reach a local PTY: synthesizing the
problem SSH solves. You'd delete the opcode protocol + flow control, but **keep** xterm.js,
the WebSocket, a new WS↔SSH bridge, key management, the headless mirror (SSH has no
replay), *and still need* render-gating (SSH's RFC-4254 window is transport-level).

Revealed preference confirms it: every browser-facing product (Gitpod gRPC supervisor,
Coder WS+WireGuard, Codespaces VS Code proto, Teleport protobuf-over-WS) rolls its own
for the browser hop. **SSH appears only for non-browser hops or crypto-in-depth over an
already-encrypted tunnel.** Nobody speaks raw SSH to a browser.

## Verdict 2 — WebTransport: cloud-waves-only, gated on three unlocks

The one place a standard genuinely helps — but not yet, and only partially.

**What it gives:** one connection multiplexing many streams (kills per-session WS + HOL
blocking) and QUIC connection migration (WiFi↔cellular roaming). **What it does NOT
replace:** the render-gated ack (QUIC flow control is transport-level, confirmed vs RFC
9000), the opcode framing (streams are raw bytes — you still frame), the headless-mirror
replay (a new QUIC session starts fresh), and the WebSocket fallback.

**It's a parallel stack, not a swap**, and it's gated on three things that are NOT true today:

1. **Browser:** Baseline as of Safari 26.4 (Mar 2026), ~85% global — usable *if version-gated*; public access still needs a WS fallback for the old-iOS tail (so you'd maintain **both**).
2. **Node server:** only `@fails-components/webtransport` exists (native libquiche, *separate* HTTP/3 listener, no Hono interop, **broken on Node 24** per issue #417, maintainer calls it "duct tape"). Native Node HTTP/3 doesn't exist yet.
3. **Fly.io:** does **not** terminate QUIC at the edge; UDP needs a dedicated IPv4 (~$4/mo), no IPv6-UDP path, ~1300-byte MTU after WireGuard, and documented QUIC-delivery reliability incidents. Connection migration *through* Fly's UDP proxy is unconfirmed/fragile.

**Adopt when:** native Node HTTP/3 lands **and** Fly ships (or proves) stable QUIC ingress. Until then it deletes nothing you couldn't delete with a pluggable seam.

## Verdict 3 — the broad sweep: nothing else fits the core

- **terminado JSON framing** (xterm.js `attach` addon) — *adoptable but a regression.* Text frames (~10% overhead) on the hot path is exactly what zuzuu's binary opcode avoids; the agent itself says "do NOT use if you need binary-clean I/O." Skip.
- **gRPC-Web / Connect** — **eliminated.** Full-duplex bidi from the browser is "not planned"; a terminal needs simultaneous keystroke-up + output-down. Blocked pending WebTransport.
- **WAMP** — registered WS subprotocol but RPC/pub-sub overkill, needs a broker, and its IANA URL was pulled (Oct 2025, ecosystem contraction). Skip.
- **MessagePack / CBOR** — solves a non-problem (control frames are tiny; the I/O path is already optimal binary). Skip.
- **ALiS (asciinema live-stream)** — *borrow the design, optionally the wire format.* Its Init event (ship current VT state to late joiners) is **exactly zuzuu's headless-mirror replay** — you already implement the pattern. Adopting the ALiS wire format would buy live `asciinema-player` viewing as a **feature** (additive), not a core simplification. Worth it only if "watch a live session in the player" becomes a product goal.
- **IANA registry:** **no terminal/PTY/shell subprotocol exists or is being proposed.** The only remote-interactive entries are `rfb` (VNC, pixels) and MicroPython's `WebREPL`. RFB is the right *mental model* for reconnect (push state to late joiners), nothing to adopt.

## The decision

**You cannot adopt your way out of the core — and shouldn't.** The render-gated flow
control and the reconnect-replay are the parts no standard covers, the parts the
benchmark found best-in-class, and the parts that are your actual moat. Stop trying to
outsource them. Adopt standards where they exist (byte semantics, bracketed paste,
asciicast — all already in), and make the **one cheap structural move** that buys all
future optionality:

> **Introduce a pluggable transport seam** — a thin `send(bytes)` / `onMessage(bytes)`
> interface that the opcode/ack/replay logic sits *above*. Today it's backed by `ws`;
> tomorrow a WebTransport implementation slots in for the cloud waves **without touching
> the protocol**. This is not "adopt a standard," it's "be ready to adopt one" — and it's
> a few hundred lines, mostly a refactor of `ws-term.ts` / `connection.ts`.

That seam is the real answer to "I don't want to be locked into hand-rolled transport":
it isolates the (irreducibly custom) protocol from the (eventually-standardizable)
transport, so the cloud transport can become a standard later while the core stays yours.

### Net actions

1. **Reject SSH.** Wrong topology; net-addition.
2. **Don't adopt** terminado / gRPC-Web / WAMP / CBOR — regression or non-fit.
3. **Confirm already-adopted standards:** ECMA-48, OSC 133/7, bracketed paste, asciicast v2 (via xterm.js / `cast.ts`). These *are* the standards at the layers that have them.
4. **Do the pluggable-transport refactor** (the hedge — cheap, high-optionality).
5. **WebTransport:** revisit at cloud wave E, gated on native-Node-HTTP/3 + Fly-QUIC stability. Even then it's partial (multiplexing + roaming, never render-gating).
6. **Optional feature, not a simplification:** ALiS wire format if live asciinema-player viewing is wanted.
