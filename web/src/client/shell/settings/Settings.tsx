// shell/settings/Settings.tsx — the per-project Settings surface (P3.3). Calm
// sections: Project (identity + state), Agent/Host (detected host + enable —
// "host wiring"), Guardrails (the execution-gate rule set — "guardrails
// state"), Sessions, Instructions (the prepacked default module), and Under
// the hood (§G.4 — the substrate's own files, named + linked, plus "daemon
// info": port, root, root-mode). Theme lives in the header toggle, not here.
// Reads project-state + workspace + the instructions/guardrails modules;
// actions go through the setup verbs. Thin .tsx; settings-model is the tested
// logic. Static utils.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api.js";
import { toast } from "../../state/toast.js";
import { hostStatusLabel, canEnable, projectStateLabel, rootModeLabel, daemonPortLabel } from "./settings-model.js";
import { useKickoffPref } from "../../state/kickoff-pref.js";
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

/** §G.4 — one substrate file: its name, a one-sentence plain explainer, and a link
 *  to its guide page (the observability creed: every magic moment is one click from
 *  the plain file that explains it — this row is that click for the SETTLED files). */
function SubstrateRow({ file, blurb, href }: { file: string; blurb: string; href: string }) {
  return (
    <Stack gap="none">
      <Inline gap="sm" align="baseline">
        <Text size="ui" mono weight="medium">{file}</Text>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-meta text-accent-dim underline decoration-border underline-offset-2 hover:text-accent"
        >
          guide
        </a>
      </Inline>
      <Text size="meta" tone="muted">{blurb}</Text>
    </Stack>
  );
}

export function Settings() {
  const qc = useQueryClient();
  const workspace = useQuery({ queryKey: ["workspace"], queryFn: api.workspace });
  const projectState = useQuery({ queryKey: ["zuzuu", "project-state"], queryFn: api.zuzuu.projectState });
  const instructions = useQuery({ queryKey: ["zuzuu", "module", "instructions"], queryFn: () => api.zuzuu.module("instructions") });
  // §G.4 "guardrails state": the guardrails module (rule notes — pattern → action)
  // is a real content module like any other, so it reads through the same generic
  // /module/:key route the Instructions section already uses — no new daemon
  // surface needed for this.
  const guardrails = useQuery({ queryKey: ["zuzuu", "module", "guardrails"], queryFn: () => api.zuzuu.module("guardrails") });
  const kickoff = useKickoffPref();

  if (projectState.isLoading) return <Loading label="reading settings…" />;
  const host = projectState.data?.host ?? { kind: null, enabled: false };
  const items = instructions.data?.items ?? [];
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
              <Text size="meta" tone="muted">The execution gate's rule set — deny/ask/allow patterns evaluated before an agent-initiated run (the fail-closed floor beneath the review gate).</Text>
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
                <Text size="ui" tone="muted">{guardrails.isLoading ? "…" : "No guardrail rules yet."}</Text>
              )}
            </Stack>
          </Section>

          <Section title="Sessions">
            <Stack gap="sm">
              <Row label="Auto session-start check">
                <Button variant="outline" size="sm" onClick={() => kickoff.setEnabled(!kickoff.enabled)}>
                  {kickoff.enabled ? "On" : "Off"}
                </Button>
              </Row>
              <Text size="meta" tone="muted">
                When on, starting an agent session sends it a first message — a short orientation plus a readiness line (the zz doctor verdict + pending-review count) — so the agent confirms the workspace is in place before your first task.
              </Text>
            </Stack>
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

          <Section title="Under the hood">
            <Stack gap="lg">
              <Text size="meta" tone="muted">
                zuzuu has no database and no server-side state of its own — these plain files ARE the Project. Every magic moment (a ghost, a generation, a spotlight) traces back to one of them.
              </Text>
              <Stack gap="md">
                <SubstrateRow
                  file="log.jsonl"
                  blurb="Every mutation to a module's notes — who did it, when, and why. This is what feeds a note's History."
                  href="https://github.com/h1902y/zuzuu/wiki/Observability#logjsonl"
                />
                <SubstrateRow
                  file="generations.json"
                  blurb="Each module's generation ledger, paired with a git commit per generation — rollback restores real bytes, never a custom pointer-flip."
                  href="https://github.com/h1902y/zuzuu/wiki/Observability#generationsjson"
                />
                <SubstrateRow
                  file="module.md"
                  blurb="The table's contract — declared columns, types, defaults. No `fields` block means schemaless: any frontmatter goes."
                  href="https://github.com/h1902y/zuzuu/wiki/Modules-as-Tables"
                />
                <SubstrateRow
                  file="project.md"
                  blurb="The root-mode marker — its presence tells zuzuu the modules live right here, no `.zuzuu/` folder needed."
                  href="https://github.com/h1902y/zuzuu/wiki/Observability#projectmd"
                />
              </Stack>
              <Stack gap="sm">
                <Text size="meta" tone="subtle" weight="semibold">DAEMON</Text>
                <Row label="Port"><Text size="meta" mono tone="muted">{daemonPortLabel(window.location.port)}</Text></Row>
                <Row label="Project root"><Text size="meta" mono tone="muted" truncate>{workspace.data?.root ?? "…"}</Text></Row>
                <Row label="Root-mode">
                  <Text size="meta" tone="muted">{projectState.data ? rootModeLabel(projectState.data.rootMode) : "…"}</Text>
                </Row>
              </Stack>
            </Stack>
          </Section>
        </Stack>
      </div>
    </div>
  );
}
