// ds/kit/ThemeToggle.tsx — cycles the warm theme: Light → Dark → Auto, shown as a
// Sun / Moon / Monitor icon. Token-bound; the icon inherits the muted text color.
import { Sun, Moon, Monitor, type LucideIcon } from "lucide-react";
import { useTheme, type ThemePref } from "../../state/theme.js";
import { Text } from "../primitives/index.js";
import { Icon } from "./Icon.js";

const ICON: Record<ThemePref, LucideIcon> = { light: Sun, dark: Moon, system: Monitor };

export function ThemeToggle() {
  const pref = useTheme((s) => s.pref);
  const cycle = useTheme((s) => s.cycle);
  return (
    <Text as="button" interactive tone="muted" onClick={cycle} title={`Theme: ${pref}`}>
      <Icon icon={ICON[pref]} size={16} />
    </Text>
  );
}
