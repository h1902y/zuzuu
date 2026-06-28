// ds/kit/Brand.tsx — the zuzuu brand lockup. Three variants:
//   "mark"   → the logo only (the glitch-Z mark, /z.png — the real brand asset)
//   "lockup" → the mark + the "zuzuu" wordmark   (logo + text)
//   "full"   → the mark + the "zuzuucodes" wordmark (logo + full text)
// The mark is the actual brand image (never reinvented); the wordmark is the MARVIN
// logotype face Bagel Fat One (--font-logo, self-hosted via @fontsource — no CDN).
// Composed from static, token-bound utilities only (guard-safe — no inline styles).
//
// Vertical centering: the chunky rounded logotype carries heavy top-side bearing, so the
// wordmark gets a small per-size optical lift to align its center with the square mark.
// (The lift values are tuned by eye — re-check on a visual pass after the face swap.)

export type BrandVariant = "mark" | "lockup" | "full";
export type BrandSize = "sm" | "md" | "lg";

const SIZE: Record<BrandSize, { mark: string; word: string; lift: string }> = {
  sm: { mark: "h-7 w-7", word: "text-sm", lift: "-translate-y-1" },
  md: { mark: "h-9 w-9", word: "text-xl", lift: "-translate-y-1.5" },
  lg: { mark: "h-12 w-12", word: "text-xl", lift: "-translate-y-1.5" },
};

const WORD: Record<Exclude<BrandVariant, "mark">, string> = {
  lockup: "zuzuu",
  full: "zuzuucodes",
};

export function Brand({ variant = "lockup", size = "md" }: { variant?: BrandVariant; size?: BrandSize }) {
  const s = SIZE[size];
  return (
    <span className="inline-flex select-none items-center gap-2">
      <img src="/z.png" alt="" aria-hidden className={`shrink-0 rounded-ui ${s.mark}`} />
      {variant !== "mark" && (
        <span className={`font-logo leading-none text-ink-100 ${s.word} ${s.lift}`}>{WORD[variant]}</span>
      )}
      <span className="sr-only">zuzuu</span>
    </span>
  );
}
