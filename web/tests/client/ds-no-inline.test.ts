// U8 — zero-inline enforcement. The design-system surfaces (ds/, and the data/ +
// shell/ surfaces built on it in Phases C/D) must carry NO inline styles and NO
// arbitrary Tailwind values — every visual choice flows through a token-bound recipe.
// This is the CI guard (the project has no eslint config; enforcement is a test).
// The structural floors also hold: ds component props omit `className`/`style` (no
// prop ⇒ no override), and Phase D adds the @theme {--*: initial} token reset (no
// token ⇒ no class) once the legacy utility-string client is gone.
import { describe, it, expect } from "vitest";
import { readdirSync, statSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const clientRoot = fileURLToPath(new URL("../../src/client", import.meta.url));
const SCAN_DIRS = ["ds", "data", "shell"]; // the design-system-driven surfaces

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : (/\.tsx?$/.test(p) ? [p] : []);
  });
}
const files = SCAN_DIRS.flatMap((d) => walk(join(clientRoot, d)));

describe("zero-inline styling — the design system is the only styling surface", () => {
  it("scans at least the ds/ surface (guard is wired)", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("no inline style={…} in ds/data/shell", () => {
    const offenders = files.filter((f) => /\bstyle=\{/.test(readFileSync(f, "utf8")));
    expect(offenders, `inline style found in: ${offenders.join(", ")}`).toEqual([]);
  });

  it("no arbitrary Tailwind values in className string literals (token-bound only)", () => {
    // catches className="w-[240px]" / class="text-[13px]" — never TS like arr[0] or Foo<T>[]
    const arb = /class(Name)?\s*=\s*["'`][^"'`]*-\[/;
    const offenders = files.filter((f) => arb.test(readFileSync(f, "utf8")));
    expect(offenders, `arbitrary Tailwind value in: ${offenders.join(", ")}`).toEqual([]);
  });
});
