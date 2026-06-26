// shell/settings/Settings.tsx — the per-project Settings surface (P3.3). Three calm
// sections: Project (identity + state), Agent/Host (detected host + enable), Instructions
// (the prepacked default module — the enforced safety-floor rules + best-practice
// guidance). Theme lives in the header toggle, not here. Reads project-state +
// workspace + the instructions module; actions go through the setup verbs. Thin .tsx;
// settings-model is the tested logic. Static utils.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api.js";
import { toast } from "../../state/toast.js";
import { hostStatusLabel, canEnable, projectStateLabel } from "./settings-model.js";
import { Stack, Inline, Text, Button, Loading } from "../../ds/index.js";

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
  const instructions = useQuery({ queryKey: ["zuzuu", "module", "instructions"], queryFn: () => api.zuzuu.module("instructions") });

  if (projectState.isLoading) return <Loading label="reading settings…" />;
  const host = projectState.data?.host ?? { kind: null, enabled: false };
  const items = instructions.data?.items ?? [];

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

          <Section title="Instructions">
            <Stack gap="sm">
              <Text size="meta" tone="muted">The prepacked default module — the enforced safety-floor rules plus best-practice guidance every Project ships with.</Text>
              {items.length ? (
                <Stack gap="xs">
                  {items.map((r) => (
                    <Inline key={r.id} gap="sm" justify="between">
                      <Text size="ui" truncate>{r.title || r.id}</Text>
                      {r.status && <Text size="meta" tone="muted">{r.status}</Text>}
                    </Inline>
                  ))}
                </Stack>
              ) : (
                <Text size="ui" tone="muted">{instructions.isLoading ? "…" : "No instructions yet."}</Text>
              )}
            </Stack>
          </Section>
        </Stack>
      </div>
    </div>
  );
}
