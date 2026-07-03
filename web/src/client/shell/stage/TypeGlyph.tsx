// shell/stage/TypeGlyph.tsx — the field-type glyph (§H.4.1): every column header
// carries its type; a note's kind gets the same treatment in the document header.
// One lucide glyph per FieldType + ƒ (sigma) for computed columns.
import { AlignLeft, Calendar, CaseSensitive, ChevronDownCircle, Hash, Link2, Sigma, Tags, ToggleLeft, FileText } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Icon, Text } from "../../ds/index.js";

const GLYPHS: Record<string, LucideIcon> = {
  text: CaseSensitive,
  longtext: AlignLeft,
  select: ChevronDownCircle,
  multi: Tags,
  link: Link2,
  date: Calendar,
  number: Hash,
  bool: ToggleLeft,
};

export function TypeGlyph({ type, computed, note = false }: { type: string; computed?: boolean; note?: boolean }) {
  const G: LucideIcon = computed ? Sigma : note ? FileText : (GLYPHS[type] ?? CaseSensitive);
  return <Text tone="muted"><Icon icon={G} size={12} /></Text>;
}
