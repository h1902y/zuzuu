// ds/kit/Input.tsx — the one token-bound text/number/date input. Replaces inline-styled
// <input> across forms (guard-safe: no className prop, no arbitrary values). Controlled.
import type { InputHTMLAttributes } from "react";

const BASE =
  "w-full rounded-ui border border-border bg-app px-2 py-1.5 text-ui text-ink-100 outline-none transition-colors placeholder:text-muted focus:border-accent-dim";

export function Input({ value, onChange, type = "text", ...rest }: {
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "number" | "date";
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "className">) {
  return <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className={BASE} {...rest} />;
}
