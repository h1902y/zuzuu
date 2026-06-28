// ds/kit/Chip.tsx — a small labeled pill for type/status markers. Token-bound tones
// (the module hues + a neutral default); the label text carries the meaning, the tone
// the urgency. Static, token-bound utilities only (guard-safe).
export type ChipTone =
  | "neutral" | "knowledge" | "memory" | "actions" | "instructions" | "guardrails"
  | "success" | "warning" | "danger" | "info";

const TONE: Record<ChipTone, string> = {
  neutral: "text-muted",
  knowledge: "text-mod-knowledge",
  memory: "text-mod-memory",
  actions: "text-mod-actions",
  instructions: "text-mod-instructions",
  guardrails: "text-mod-guardrails",
  // status tones — color carries STATE (deny/error · ask/pending · allow/done)
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  info: "text-info",
};

export function Chip({ label, tone = "neutral" }: { label: string; tone?: ChipTone }) {
  return (
    <span className={`inline-flex items-center rounded-ui border border-border px-1.5 py-0.5 text-meta font-medium leading-none ${TONE[tone]}`}>
      {label}
    </span>
  );
}
