// shell/stage/AcpView.tsx source wiring (U6, curried-plotting-coral.md) — the ACP
// stage used to be "sticky": its compose `<textarea>` had no Escape of its own, and
// WorkbenchShell.tsx's global Escape handler deliberately bails on a focused
// INPUT/TEXTAREA (to protect the real terminal's typing) — so Escape did nothing
// while chatting. Framework-free / no-DOM: the dismiss wiring itself is U1-tested
// (dismiss-model.test.ts, overlay-stack.test.ts); here we assert the SOURCE composes
// it correctly (the same convention dialog.test.ts / popover.test.ts use for seams
// that aren't pure functions) AND that the shell's terminal-typing guard is untouched.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const acpSrc = readFileSync(fileURLToPath(new URL("../../src/client/shell/stage/AcpView.tsx", import.meta.url)), "utf8");
const shellSrc = readFileSync(fileURLToPath(new URL("../../src/client/shell/WorkbenchShell.tsx", import.meta.url)), "utf8");
const termViewSrc = readFileSync(fileURLToPath(new URL("../../src/client/term/TermView.tsx", import.meta.url)), "utf8");

describe("AcpView.tsx source wiring — a real exit for the sticky agent view", () => {
  it("imports useDismiss from the ds surface, not a hand-rolled listener", () => {
    expect(acpSrc).toMatch(/import \{ Stack, Inline, Text, Button, Icon, useDismiss \} from "\.\.\/\.\.\/ds\/index\.js";/);
    expect(acpSrc).not.toMatch(/addEventListener\(["']keydown["']/);
  });

  it("registers the stage as overlay id \"acp\", closing via select(null) — the same exit Escape uses everywhere else", () => {
    expect(acpSrc).toMatch(/const onClose = \(\) => select\(null\);/);
    expect(acpSrc).toMatch(/useDismiss\(\{\s*id:\s*"acp",\s*onClose,\s*closeOnOutside:\s*false,\s*ref\s*\}\);/);
  });

  it("closeOnOutside is OFF — a full-stage view has no meaningful outside (no scrim), unlike a floating Popover/Dialog", () => {
    expect(acpSrc).toContain("closeOnOutside: false");
  });

  it("useDismiss is called in AcpView (the stage wrapper), above any conditional render", () => {
    const dismissAt = acpSrc.indexOf("useDismiss({");
    const wrapperAt = acpSrc.indexOf("export function AcpView(");
    const conversationAt = acpSrc.indexOf("export function AcpConversation(");
    expect(dismissAt).toBeGreaterThan(wrapperAt);
    expect(dismissAt).toBeLessThan(conversationAt);
  });

  it("renders a VISIBLE dismiss affordance (an X) in the conversation header, discoverable beyond the Escape keystroke", () => {
    expect(acpSrc).toMatch(/aria-label="close agent view"/);
    expect(acpSrc).toMatch(/icon=\{X\}/);
  });

  it("the visible affordance only renders when onClose is supplied — the omnibar's compact chat panel (no onClose) gets no button, since it already backs out via the palette's own Esc/view-stack pop", () => {
    expect(acpSrc).toMatch(/\{onClose && \(/);
  });

  it("AcpConversation's compact usage stays a plain conversation surface — onClose is optional, not required", () => {
    expect(acpSrc).toMatch(/onClose\?:\s*\(\)\s*=>\s*void/);
  });
});

describe("WorkbenchShell.tsx — the terminal's own typing protection is untouched by this fix", () => {
  it("the global Escape/shortcut handler still bails out for a focused INPUT/TEXTAREA/contentEditable", () => {
    expect(shellSrc).toContain('if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable) return;');
  });

  it("the real terminal (term/TermView.tsx) never composes useDismiss — it stays outside the shared overlay stack entirely, unweakened by this fix", () => {
    expect(termViewSrc).not.toMatch(/useDismiss/);
  });

  it("the terminal stage is a totally separate branch from the ACP stage in the shell's render — never routed through AcpView", () => {
    expect(shellSrc).toMatch(/sel\.stage === "terminal" && sessionNode/);
    expect(shellSrc).toMatch(/sel\.stage === "acp" && selected\?\.kind === "acp"/);
  });
});
