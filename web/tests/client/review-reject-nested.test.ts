// shell/review/ProposalCard.tsx + ReviewQueue.tsx source wiring (U6, curried-
// plotting-coral.md) — U5 flagged: with the review overlay's own useDismiss
// registration (id "review") live, opening a card's Reject taxonomy sub-mode made
// Escape fire BOTH closeReject() AND the review's topmost-Escape close — one
// keystroke closed everything instead of backing out one level. The fix nests the
// reject sub-mode as its OWN overlay (id "review-reject") on the shared stack while
// it's open, so it — not "review" — is topmost and answers Escape alone. Framework-
// free / no-DOM: the stack's topmost-only mechanism itself is U1-tested
// (overlay-stack.test.ts, dismiss-model.test.ts); here we assert the SOURCE composes
// it correctly, the same convention dialog.test.ts / popover.test.ts use.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const cardSrc = readFileSync(fileURLToPath(new URL("../../src/client/shell/review/ProposalCard.tsx", import.meta.url)), "utf8");
const queueSrc = readFileSync(fileURLToPath(new URL("../../src/client/shell/review/ReviewQueue.tsx", import.meta.url)), "utf8");

describe("ProposalCard.tsx — the reject sub-mode registers as a NESTED overlay above \"review\"", () => {
  it("imports useDismiss from the ds surface", () => {
    expect(cardSrc).toMatch(/import \{ Stack, Inline, Text, Button, Chip, ProposalBadge, useDismiss \} from "\.\.\/\.\.\/ds\/index\.js";/);
  });

  it("registers overlay id \"review-reject\", closing via the SAME closeReject the cancel button and keyboard model already use, enabled only while rejecting", () => {
    expect(cardSrc).toMatch(
      /useDismiss\(\{\s*id:\s*"review-reject",\s*onClose:\s*closeReject,\s*enabled:\s*isRejecting,\s*ref:\s*rejectRef\s*\}\);/,
    );
  });

  it("the useDismiss call is UNCONDITIONAL — sits after closeReject/isRejecting are defined, not inside the mode==='rejecting' render branch", () => {
    const dismissAt = cardSrc.indexOf("useDismiss({");
    const modeRenderAt = cardSrc.indexOf('mode === "rejecting" ?');
    expect(dismissAt).toBeGreaterThan(-1);
    expect(modeRenderAt).toBeGreaterThan(-1);
    expect(dismissAt).toBeLessThan(modeRenderAt);
  });

  it("the reject taxonomy's rendered container carries rejectRef — the nested overlay's own DOM anchor", () => {
    expect(cardSrc).toMatch(/<div ref=\{rejectRef\}>/);
  });
});

describe("ReviewQueue.tsx — Escape for the keyboard reject-taxonomy no longer double-closes the review overlay", () => {
  it("the local keyboard handler's OWN Escape branch for reject-mode is gone — the nested overlay (ProposalCard) is the sole handler now", () => {
    // the digit/j-k/Enter branches inside `if (rejectMode.open && rejectingId)` still
    // exist; only the `if (e.key === "Escape") { …closeReject()… }` line is removed.
    expect(queueSrc).not.toMatch(/if \(e\.key === "Escape"\) \{ e\.preventDefault\(\); closeReject\(\); return; \}/);
  });

  it("the reject-mode keyboard block still exists (digit/j-k/Enter untouched)", () => {
    expect(queueSrc).toMatch(/if \(rejectMode\.open && rejectingId\) \{/);
    expect(queueSrc).toMatch(/reasonIndexFromKey\(e\.key, REJECT_REASONS\.length\)/);
    expect(queueSrc).toMatch(/return; \/\/ swallow anything else/);
  });
});
