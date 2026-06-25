// ds/kit/ThemeToggle.tsx — cycles the warm theme: Light → Dark → Auto. Token-bound,
// theme-agnostic (it just drives the preference). U3 swaps the text label for a
// Sun/Moon/Monitor icon.
import { useTheme, type ThemePref } from "../../state/theme.js";
import { Text } from "../primitives/index.js";

const LABEL: Record<ThemePref, string> = { light: "Light", dark: "Dark", system: "Auto" };

export function ThemeToggle() {
  const pref = useTheme((s) => s.pref);
  const cycle = useTheme((s) => s.cycle);
  return (
    <Text as="button" interactive size="meta" tone="muted" onClick={cycle} title="Toggle theme">
      {LABEL[pref]}
    </Text>
  );
}
