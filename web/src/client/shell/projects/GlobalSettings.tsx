// shell/projects/GlobalSettings.tsx — machine-global settings (distinct from the
// per-project Settings stage). The master REGISTRY — where all projects are
// coordinated. Theme lives in the header toggle, not here. A modal over the Projects
// Home, composing the shared ds/kit/Dialog (U3, curried-plotting-coral.md) — Escape
// (when topmost) + outside-click dismiss come from Dialog's useDismiss wiring instead
// of a private keydown listener. Thin .tsx, static utilities.
import { useQuery } from "@tanstack/react-query";
import { Settings as SettingsIcon } from "lucide-react";
import { api } from "../../lib/api.js";
import { Stack, Inline, Text, Icon, Button, Dialog } from "../../ds/index.js";

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

  return (
    <Dialog
      open
      id="global-settings"
      title={<Inline gap="sm"><Icon icon={SettingsIcon} size={20} /><Text size="lg" font="display">Global settings</Text></Inline>}
      onClose={onClose}
      className="inset-x-6 top-24 mx-auto w-full max-w-xl p-6"
      footer={<Button variant="ghost" size="sm" onClick={onClose}>Done</Button>}
    >
      <Stack gap="sm">
        <Text size="meta" tone="subtle" weight="semibold">REGISTRY</Text>
        <div className="rounded-lg border border-border bg-surface p-5">
          <Stack gap="sm">
            <Text size="meta" tone="muted">The registry coordinates all your projects. It's created automatically as a local index — <Text as="span" mono tone="default">git init</Text> its folder to make it portable across machines.</Text>
            {registry ? (
              <Stack gap="sm">
                <Row label="Master location"><Text size="ui" truncate>{registry.home}</Text></Row>
                <Row label="Identity"><Text size="meta" tone="muted">{registry.identity ?? "—"}</Text></Row>
                <Row label="Projects coordinated"><Text size="ui">{registry.projects}</Text></Row>
              </Stack>
            ) : (
              <Text size="ui" tone="muted">
                Registry unavailable — falling back to recent folders. Make sure the zuzuu CLI is installed, or run
                {" "}<Text as="span" mono tone="default">zz registry ensure</Text>{" "}to create the local registry.
              </Text>
            )}
          </Stack>
        </div>
      </Stack>
    </Dialog>
  );
}
