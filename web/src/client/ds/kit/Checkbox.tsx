// ds/kit/Checkbox.tsx — a token-bound boolean toggle (the `bool` FieldType). Native
// checkbox tinted with the coral accent; optional inline label. Guard-safe.
export function Checkbox({ checked, onChange, label }: {
  checked: boolean;
  onChange: (b: boolean) => void;
  label?: string;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 rounded-sm accent-accent"
      />
      {label && <span className="text-ui text-subtle">{label}</span>}
    </label>
  );
}
