import os from "node:os";
import { describe, expect, it } from "vitest";
import { parseOsc7 } from "../../src/server/sessions.js";
import { buildInjection } from "../../src/server/shell-integration/inject.js";

describe("parseOsc7", () => {
  it("decodes file:// payloads", () => {
    expect(parseOsc7("file://localhost/Users/me/p%20ath")).toBe("/Users/me/p ath");
    expect(parseOsc7("file:///abs/path")).toBe("/abs/path");
    expect(parseOsc7("file://host/a/b/c")).toBe("/a/b/c");
  });
  it("rejects non-file payloads", () => {
    expect(parseOsc7("7;notafile")).toBeNull();
    expect(parseOsc7("")).toBeNull();
  });
});

describe("buildInjection", () => {
  it("returns ZDOTDIR injection for zsh that loads our snippet", () => {
    const inj = buildInjection("/bin/zsh");
    expect(inj).not.toBeNull();
    expect(inj!.env.ZDOTDIR).toContain("webcode-si-");
    expect(inj!.args).toContain("-l");
    // the temp .zshrc must contain the OSC 133 emitter
    const fs = require("node:fs") as typeof import("node:fs");
    const path = require("node:path") as typeof import("node:path");
    const rc = fs.readFileSync(path.join(inj!.env.ZDOTDIR!, ".zshrc"), "utf8");
    expect(rc).toContain("133;A");
    expect(rc).toContain("133;D");
    expect(rc).toContain("]7;file://");
    fs.rmSync(inj!.tempDir!, { recursive: true, force: true });
  });

  it("returns --rcfile injection for bash", () => {
    const inj = buildInjection("/usr/bin/bash");
    expect(inj!.args[0]).toBe("--rcfile");
    expect(inj!.args).toContain("-i");
    const fs = require("node:fs") as typeof import("node:fs");
    const rc = fs.readFileSync(inj!.args[1]!, "utf8");
    expect(rc).toContain("133;C");
    fs.rmSync(inj!.tempDir!, { recursive: true, force: true });
  });

  it("returns null for unknown shells", () => {
    expect(buildInjection("/bin/nu")).toBeNull();
    expect(buildInjection("/usr/bin/pwsh")).toBeNull();
  });
});
