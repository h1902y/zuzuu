// ds/kit/Brand.tsx — the zuzuu brand lockup. Three variants:
//   "mark"   → the app-icon badge only (a coral "z" tile)
//   "lockup" → the mark + the "zuzuu" wordmark   (logo + text)
//   "full"   → the mark + the "zuzuucodes" wordmark (logo + full text)
// The logotype face is Train One (--font-logo, via the Google Fonts CDN link in
// index.html); the mark tile rides the FIXED coral accent. Composed from static,
// token-bound utilities only (guard-safe — no inline styles / arbitrary values).
//
// Vertical centering: Train One carries heavy top-side bearing, so the wordmark's
// glyph sits low in its line box. The badge centers its glyph via `grid place-items-
// center`; the wordmark gets a small per-size optical lift so its center aligns with
// the badge's (translate utilities are standard, not arbitrary).

export type BrandVariant = "mark" | "lockup" | "full";
export type BrandSize = "sm" | "md" | "lg";

const SIZE: Record<BrandSize, { badge: string; glyph: string; word: string; lift: string }> = {
  sm: { badge: "h-7 w-7", glyph: "text-base", word: "text-lg", lift: "-translate-y-px" },
  md: { badge: "h-9 w-9", glyph: "text-xl", word: "text-2xl", lift: "-translate-y-0.5" },
  lg: { badge: "h-12 w-12", glyph: "text-2xl", word: "text-2xl", lift: "-translate-y-0.5" },
};

const WORD: Record<Exclude<BrandVariant, "mark">, string> = {
  lockup: "zuzuu",
  full: "zuzuucodes",
};

export function Brand({ variant = "lockup", size = "md" }: { variant?: BrandVariant; size?: BrandSize }) {
  const s = SIZE[size];
  return (
    <span className="inline-flex select-none items-center gap-2">
      <span
        aria-hidden
        className={`grid shrink-0 place-items-center rounded-ui bg-accent font-logo leading-none text-ink-950 ${s.badge} ${s.glyph}`}
      >
        z
      </span>
      {variant !== "mark" && (
        <span className={`font-logo leading-none text-ink-100 ${s.word} ${s.lift}`}>{WORD[variant]}</span>
      )}
      <span className="sr-only">zuzuu</span>
    </span>
  );
}
