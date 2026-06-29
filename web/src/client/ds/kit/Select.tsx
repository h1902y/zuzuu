// ds/kit/Select.tsx — a token-bound single-select over a fixed option list (the `select`
// FieldType). Native <select> (accessible, zero-dep); a value not in the options is kept
// as a leading option so an out-of-schema value never silently vanishes. Guard-safe.
import type { SelectHTMLAttributes } from "react";

const BASE =
  "w-full rounded-ui border border-border bg-app px-2 py-1.5 text-ui text-ink-100 outline-none transition-colors focus:border-accent-dim";

export function Select({ value, onChange, options, ...rest }: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, "value" | "onChange" | "className">) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={BASE} {...rest}>
      {value && !options.includes(value) && <option value={value}>{value}</option>}
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}
