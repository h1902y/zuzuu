import type { ReactNode } from "react";
import { Button } from "../../components/ui";
import { moduleHue, type ModuleDisplay } from "./kit";

/** One entry in the icon-row-triplet explainer — icon path + label + caption. */
export interface ExplainerEntry {
  /** 16×16 stroke path */
  icon: string;
  label: string;
  caption: string;
}

/** The inline empty state that teaches: 48px muted module icon, a headline,
 *  ONE teaching sentence, and an optional CTA. Display comes from the
 *  manifest ui descriptor (moduleDisplay), so declarative modules teach
 *  too.
 *
 *  Optional additions (additive — existing callers unaffected):
 *  - `preview`   A faint (low-opacity, pointer-events-none) mock of the
 *                filled surface rendered ABOVE the headline.
 *  - `explainer` Three icon+label+caption rows that teach a new noun inline. */
export function TeachingEmpty({
  display,
  moduleId,
  cta,
  preview,
  explainer,
}: {
  display: ModuleDisplay;
  /** the module's id — tints the empty-state icon with its identity hue */
  moduleId?: string;
  cta?: { label: string; onClick: () => void };
  /** Optional faint preview of the filled surface (pointer-events-none). */
  preview?: ReactNode;
  /** Optional icon-row-triplet for teaching a new noun (max 3 entries). */
  explainer?: ExplainerEntry[];
}) {
  const hue = moduleId ? moduleHue(moduleId) : "var(--muted-foreground)";
  return (
    <div className="wc-rise-in flex flex-col items-center gap-2.5 px-4 py-7 text-center">
      {/* faint filled-state preview — above the headline, pointer-events-none */}
      {preview && (
        <div
          className="mb-1 w-full overflow-hidden rounded-[var(--radius-ui)] border border-border/40"
          style={{ opacity: 0.35, pointerEvents: "none", userSelect: "none" }}
          aria-hidden
        >
          {preview}
        </div>
      )}

      <span
        className="mb-0.5 flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{
          background: `color-mix(in oklab, ${hue} 10%, transparent)`,
          boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${hue} 18%, transparent)`,
        }}
      >
        <svg viewBox="0 0 16 16" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.1" style={{ color: `color-mix(in oklab, ${hue} 78%, var(--color-ink-400))` }}>
          <path d={display.icon} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <div className="wc-sans text-title font-semibold text-foreground">{display.emptyHeadline}</div>
      <p className="wc-sans max-w-64 text-meta leading-relaxed text-muted-foreground">{display.teach}</p>

      {/* icon-row-triplet explainer — teaches the concept in three beats */}
      {explainer && explainer.length > 0 && (
        <div className="mt-1 flex w-full max-w-xs flex-col gap-2 text-left">
          {explainer.slice(0, 3).map((e) => (
            <div key={e.label} className="flex items-start gap-2.5">
              <span
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded"
                style={{
                  background: `color-mix(in oklab, ${hue} 10%, transparent)`,
                }}
              >
                <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.4" style={{ color: `color-mix(in oklab, ${hue} 70%, var(--color-ink-400))` }}>
                  <path d={e.icon} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <div className="min-w-0">
                <span className="wc-sans text-meta font-semibold text-foreground">{e.label}</span>
                <span className="wc-sans text-meta text-muted-foreground"> — {e.caption}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {cta && (
        <Button size="sm" variant="subtle" onClick={cta.onClick}>
          {cta.label}
        </Button>
      )}
    </div>
  );
}
