// ds/kit/Textarea.tsx — the token-bound multiline input (longtext fields, the note body).
// Guard-safe (no className prop). Controlled.
import type { TextareaHTMLAttributes } from "react";

const BASE =
  "min-h-24 w-full rounded-ui border border-border bg-app px-2 py-1.5 text-ui text-ink-100 outline-none transition-colors placeholder:text-muted focus:border-accent-dim";

export function Textarea({ value, onChange, ...rest }: {
  value: string;
  onChange: (v: string) => void;
} & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange" | "className">) {
  return <textarea value={value} onChange={(e) => onChange(e.target.value)} className={BASE} {...rest} />;
}
