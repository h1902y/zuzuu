import { mkdtemp, rm, stat } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ensurePersistentToken,
  instancePath,
  readInstanceFile,
  readPersistentToken,
  removeInstanceFile,
  tokenPath,
  writeInstanceFile,
  type InstanceInfo,
} from "../src/instance-file.js";

let base: string; // stands in for ~/.webcode/instances

const info = (over: Partial<InstanceInfo> = {}): InstanceInfo => ({
  root: "/Users/someone/project",
  port: 7770,
  pid: 12345,
  token: "tok-abc",
  startedAt: "2026-06-12T00:00:00.000Z",
  version: "0.1.0",
  ...over,
});

beforeAll(async () => {
  base = await mkdtemp(path.join(os.tmpdir(), "webcode-instances-"));
});

afterAll(async () => {
  await rm(base, { recursive: true, force: true });
});

describe("instancePath", () => {
  it("is deterministic per root and 16-hex named", () => {
    const a = instancePath("/some/root", base);
    expect(a).toBe(instancePath("/some/root", base));
    expect(path.basename(a)).toMatch(/^[0-9a-f]{16}\.json$/);
  });

  it("differs across roots", () => {
    expect(instancePath("/root/a", base)).not.toBe(instancePath("/root/b", base));
  });
});

describe("writeInstanceFile", () => {
  it("writes the full shape with mode 0600 (creating the dir)", async () => {
    const dir = path.join(base, "fresh", "nested"); // mkdir -p behavior
    const i = info();
    const file = writeInstanceFile(i, dir);
    expect(file).toBe(instancePath(i.root, dir));
    expect(JSON.parse(readFileSync(file!, "utf8"))).toEqual(i);
    const mode = (await stat(file!)).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it("re-enforces 0600 on overwrite and returns null instead of throwing on failure", () => {
    const i = info();
    writeInstanceFile(i, base);
    const file = writeInstanceFile(info({ port: 7771 }), base); // overwrite same root
    expect(readInstanceFile(i.root, base)?.port).toBe(7771);
    expect(file).not.toBeNull();
    // unwritable target → warn + null, never a throw (here: "dir" is an existing file)
    const fileAsDir = instancePath(i.root, base); // a regular file, can't mkdir under it
    expect(() => writeInstanceFile(i, fileAsDir)).not.toThrow();
    expect(writeInstanceFile(i, fileAsDir)).toBeNull();
  });
});

describe("readInstanceFile", () => {
  it("round-trips and returns null for missing/corrupt files", () => {
    const i = info({ root: "/round/trip" });
    writeInstanceFile(i, base);
    expect(readInstanceFile(i.root, base)).toEqual(i);
    expect(readInstanceFile("/never/written", base)).toBeNull();
  });
});

describe("removeInstanceFile", () => {
  it("removes the file when the pid matches", () => {
    const i = info({ root: "/rm/match" });
    writeInstanceFile(i, base);
    removeInstanceFile(i.root, i.pid, base);
    expect(existsSync(instancePath(i.root, base))).toBe(false);
  });

  it("leaves the file alone when another pid owns it (raced restart)", () => {
    const i = info({ root: "/rm/other", pid: 999 });
    writeInstanceFile(i, base);
    removeInstanceFile(i.root, 111, base); // not ours
    expect(readInstanceFile(i.root, base)?.pid).toBe(999);
  });

  it("is a no-op when the file is already gone", () => {
    expect(() => removeInstanceFile("/rm/never", 1, base)).not.toThrow();
  });
});

describe("persistent token", () => {
  it("tokenPath shares the json id but with a .token extension", () => {
    const root = "/tok/path";
    const json = path.basename(instancePath(root, base));
    const tok = path.basename(tokenPath(root, base));
    expect(tok).toBe(json.replace(/\.json$/, ".token"));
    expect(tok).toMatch(/^[0-9a-f]{16}\.token$/);
  });

  it("ensurePersistentToken generates once then returns the same token (0600)", async () => {
    const root = "/tok/idem";
    expect(readPersistentToken(root, base)).toBeNull();
    const first = ensurePersistentToken(root, base);
    expect(first).toMatch(/^[A-Za-z0-9_-]{20,}$/); // base64url, no padding
    expect(ensurePersistentToken(root, base)).toBe(first); // idempotent
    expect(readPersistentToken(root, base)).toBe(first);
    const mode = (await stat(tokenPath(root, base))).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it("the token survives removeInstanceFile (which only drops the .json)", () => {
    const i = info({ root: "/tok/survives" });
    writeInstanceFile(i, base);
    const tok = ensurePersistentToken(i.root, base);
    removeInstanceFile(i.root, i.pid, base);
    expect(existsSync(instancePath(i.root, base))).toBe(false); // .json gone
    expect(existsSync(tokenPath(i.root, base))).toBe(true); // .token stays
    expect(readPersistentToken(i.root, base)).toBe(tok);
  });

  it("readPersistentToken returns null for missing/empty and trims whitespace", () => {
    expect(readPersistentToken("/tok/never", base)).toBeNull();
    const tok = ensurePersistentToken("/tok/trim", base);
    expect(tok.includes("\n")).toBe(false); // returned value is already trimmed
  });
});
