// shell/settings/Settings.tsx — the per-project Settings surface (P3.3). Four calm
// sections: Project (identity + state), Agent/Host (detected host + enable), Guardrails
// (the safety floor's rules), Appearance (the warm theme). Reads project-state +
// workspace + the guardrails module; the few actions go through the existing setup
// verbs + the theme store. Thin .tsx; settings-model is the tested logic. Static utils.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sun, Moon, Monitor, type LucideIcon } from "lucide-react";
import { api } from "../../lib/api.js";
import { useTheme, type ThemePref } from "../../state/theme.js";
import { toast } from "../../state/toast.js";
import { hostStatusLabel, canEnable, projectStateLabel } from "./settings-model.js";
import { Stack, Inline, Text, Icon, Button, Loading } from "../../ds/index.js";

const THEME_OPTS: { pref: ThemePref; label: string; icon: LucideIcon }[] = [
  { pref: "light", label: "Light", icon: Sun },
  { pref: "dark", label: "Dark", icon: Moon },
  { pref: "system", label: "System", icon: Monitor },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Stack gap="sm">
      <Text size="meta" tone="subtle" weight="semibold">{title.toUpperCase()}</Text>
      <div className="rounded-lg border border-border bg-surface p-6">{children}</div>
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

export function Settings() {
  const qc = useQueryClient();
  const workspace = useQuery({ queryKey: ["workspace"], queryFn: api.workspace });
  const projectState = useQuery({ queryKey: ["zuzuu", "project-state"], queryFn: api.zuzuu.projectState });
  const guardrails = useQuery({ queryKey: ["zuzuu", "module", "guardrails"], queryFn: () => api.zuzuu.module("guardrails") });
  const pref = useTheme((s) => s.pref);
  const setTheme = useTheme((s) => s.setTheme);

  if (projectState.isLoading) return <Loading label="reading settings…" />;
  const host = projectState.data?.host ?? { kind: null, enabled: false };
  const rules = guardrails.data?.items ?? [];

  async function enable() {
    try { await api.setup.enable(); toast("Agent enabled"); void qc.invalidateQueries({ queryKey: ["zuzuu"] }); }
    catch { toast("Couldn’t enable the agent", "error"); }
  }

  return (
    <div className="h-full overflow-y-auto px-8 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <Stack gap="xl">
          <Text size="2xl" font="display">Settings</Text>

          <Section title="Project">
            <Stack gap="sm">
              <Row label="Name"><Text size="ui">{workspace.data?.name ?? "…"}</Text></Row>
              <Row label="Path"><Text size="meta" tone="muted" truncate>{workspace.data?.root ?? "…"}</Text></Row>
              <Row label="Status"><Text size="ui">{projectState.data ? projectStateLabel(projectState.data.state) : "…"}</Text></Row>
              {workspace.data?.version && <Row label="Version"><Text size="meta" tone="muted">{workspace.data.version}</Text></Row>}
            </Stack>
          </Section>

          <Section title="Agent / Host">
            <Inline gap="md" justify="between" align="center">
              <Text size="ui">{hostStatusLabel(host)}</Text>
              {canEnable(host) && <Button variant="primary" size="sm" onClick={() => void enable()}>Enable</Button>}
            </Inline>
          </Section>

          <Section title="Guardrails">
            <Stack gap="sm">
              <Text size="meta" tone="muted">The enforced tool gate — the safety floor every Project ships with.</Text>
              {rules.length ? (
                <Stack gap="xs">
                  {rules.map((r) => (
                    <Inline key={r.id} gap="sm" justify="between">
                      <Text size="ui" truncate>{r.title || r.id}</Text>
                      {r.status && <Text size="meta" tone="muted">{r.status}</Text>}
                    </Inline>
                  ))}
                </Stack>
              ) : (
                <Text size="ui" tone="muted">{guardrails.isLoading ? "…" : "No rules yet."}</Text>
              )}
            </Stack>
          </Section>

          <Section title="Appearance">
            <Inline gap="sm">
              {THEME_OPTS.map((o) => (
                <Button key={o.pref} variant={pref === o.pref ? "outline" : "ghost"} size="sm" onClick={() => setTheme(o.pref)}>
                  <Icon icon={o.icon} size={15} /> {o.label}
                </Button>
              ))}
            </Inline>
          </Section>
        </Stack>
      </div>
    </div>
  );
}
