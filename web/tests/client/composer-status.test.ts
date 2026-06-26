// composer/composer-status — the send-state label the footer shows.
import { describe, it, expect } from "vitest";
import { composerStatus } from "../../src/client/composer/composer-status.js";

describe("composerStatus", () => {
  it("ready + empty queue → Ready, not busy", () =>
    expect(composerStatus(true, 0)).toEqual({ label: "Ready", busy: false }));
  it("ready + queued → shows the queue depth (still not busy)", () =>
    expect(composerStatus(true, 2)).toEqual({ label: "2 queued", busy: false }));
  it("working → busy, plain", () =>
    expect(composerStatus(false, 0)).toEqual({ label: "Working…", busy: true }));
  it("working + queued → busy with the depth", () =>
    expect(composerStatus(false, 3)).toEqual({ label: "Working · 3 queued", busy: true }));
});
