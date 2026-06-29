// shell/wing/FieldInput.tsx — maps a FormField to the right kit control by FieldType
// (the FieldType registry's INPUT third: cell · field-config · input). String-in /
// string-out so it plugs straight into the form-model's string edit map. bool bridges
// the registry's ✓ / "" format so an untouched toggle never reads as dirty.
import { Input, Textarea, Select, Checkbox } from "../../ds/index.js";
import type { FormField } from "./form-model.js";

export function FieldInput({ field, value, onChange }: {
  field: FormField;
  value: string;
  onChange: (v: string) => void;
}) {
  switch (field.type) {
    case "longtext":
      return <Textarea value={value} onChange={onChange} />;
    case "select":
      return field.options?.length
        ? <Select value={value} onChange={onChange} options={field.options} />
        : <Input value={value} onChange={onChange} />; // schemaless select → free text
    case "bool":
      return <Checkbox checked={value === "✓" || value === "true"} onChange={(b) => onChange(b ? "✓" : "")} />;
    case "number":
      return <Input type="number" value={value} onChange={onChange} />;
    case "date":
      return <Input type="date" value={value} onChange={onChange} />;
    default:
      return <Input value={value} onChange={onChange} />; // text · link · multi (csv)
  }
}
