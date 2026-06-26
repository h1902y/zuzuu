// shell/projects/GlobalSettings.tsx — machine-global settings (distinct from the
// per-project Settings stage). The master REGISTRY (where all projects are coordinated)
// + APPEARANCE (the theme). A modal over the Projects Home; thin .tsx, static utilities.
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sun, Moon, Monitor, Settings as SettingsIcon, type LucideIcon } from "lucide-react";
import { api } from "../../lib/api.js";
import { useTheme, type ThemePref } from "../../state/theme.js";
import { Stack, Inline, Text, Icon, Button } from "../../ds/index.js";

const THEME_OPTS: { pref: ThemePref; label: string; icon: LucideIcon }[] = [
  { pref: "light", label: "Light", icon: Sun },
  { pref: "dark", label: "Dark", icon: Moon },
  { pref: "system", label: "System", icon: Monitor },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Stack gap="sm">
      <Text size="meta" tone="subtle" weight="semibold">{title}</Text>
      <div className="rounded-lg border border-border bg-surface p-5">{children}</div>
    </Stack>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Inline gap="md" align="center" justify="between">
      <Text size="meta" tone="muted">{label}</Text>
      <div className="min-w-0">{children}</div>
    </Inline>
  );
}

export function GlobalSettings({ onClose }: { onClose: () => void }) {
  const list = useQuery({ queryKey: ["projects", "list"], queryFn: api.projects.list });
  const registry = list.data?.registry ?? null;
  const pref = useTheme((s) => s.pref);
  const setTheme = useTheme((s) => s.setTheme);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-30 flex items-start justify-center bg-scrim p-6 pt-24">
      <button type="button" aria-label="close" onClick={onClose} className="fixed inset-0 cursor-default" />
      <div className="animate-pop relative w-full max-w-xl rounded-lg border border-border bg-elevated p-6 shadow-overlay">
        <Stack gap="xl">
          <Inline gap="sm"><Icon icon={SettingsIcon} size={20} /><Text size="lg" font="display">Global settings</Text></Inline>

          <Section title="REGISTRY">
            <Stack gap="sm">
              <Text size="meta" tone="muted">The master registry coordinates all your projects — a git-native, portable index.</Text>
              {registry ? (
                <Stack gap="sm">
                  <Row label="Master location"><Text size="ui" truncate>{registry.home}</Text></Row>
                  <Row label="Identity"><Text size="meta" tone="muted">{registry.identity ?? "—"}</Text></Row>
                  <Row label="Projects coordinated"><Text size="ui">{registry.projects}</Text></Row>
                </Stack>
              ) : (
                <Text size="ui" tone="muted">
                  No registry yet — projects come from recent folders. Create one with
                  {" "}<Text as="span" mono tone="default">zz registry init</Text>{" "}in a git repo, then add projects with
                  {" "}<Text as="span" mono tone="default">zz registry add</Text>.
                </Text>
              )}
            </Stack>
          </Section>

          <Section title="APPEARANCE">
            <Inline gap="sm">
              {THEME_OPTS.map((o) => (
                <Button key={o.pref} variant={pref === o.pref ? "outline" : "ghost"} size="sm" onClick={() => setTheme(o.pref)}>
                  <Icon icon={o.icon} size={15} /> {o.label}
                </Button>
              ))}
            </Inline>
          </Section>

          <Inline gap="sm" justify="end">
            <Button variant="ghost" size="sm" onClick={onClose}>Done</Button>
          </Inline>
        </Stack>
      </div>
    </div>
  );
}
