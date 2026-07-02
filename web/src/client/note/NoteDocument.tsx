// note/NoteDocument.tsx — THE note detail rendering (§H.6): one component, every
// container (omnibar detail pane · wing · inline row expansion), width-adaptive.
// Notion document grammar: header → lead → grouped attribute cards → GFM body →
// quiet footer. READ-ONLY by doctrine — the single affordance is the "Act ⌘K"
// hint; relation rows fly the map (navigation, not mutation).
import type { ModuleItem } from "#shared/index.js";
import type { FieldDef } from "../data/field-registry.js";
import { Command } from "lucide-react";
import { Gfm } from "../lib/Gfm.js";
import { moduleHue } from "../world/model.js";
import { TypeGlyph } from "../shell/stage/TypeGlyph.js";
import { StatusPill } from "../shell/stage/StatusPill.js";
import { noteGroups, leadOf, bornHere, targetAddr, type AttrRow } from "./note-document-model.js";
import { useWorld } from "../shell/world-state.js";
import { useWorldCommand } from "../state/world-command.js";
import { Icon, Text } from "../ds/index.js";

export type NoteDocumentWidth = "panel" | "wing" | "row";

function Dot({ hue }: { hue: number }) {
  return (
    <svg aria-hidden width="8" height="8" className="shrink-0">
      <circle cx="4" cy="4" r="4" fill={`hsl(${hue} 58% 60%)`} />
    </svg>
  );
}

function GroupCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-ui border border-border bg-surface">
      <p className="border-b border-border px-3 py-1.5 text-meta font-semibold uppercase tracking-wide text-muted">{title}</p>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

function AttrLine({ row }: { row: AttrRow }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-border px-3 py-1.5 last:border-b-0">
      <span className="w-28 shrink-0 truncate text-meta text-muted">{row.label}</span>
      <span className="min-w-0 flex-1 break-words text-ui text-subtle">{row.value}</span>
      {row.formula && <span className="shrink-0 text-meta text-muted">{row.formula}</span>}
    </div>
  );
}

export function NoteDocument({ item, fields = [], width = "panel" }: {
  item: ModuleItem & { body?: string };
  fields?: FieldDef[];
  width?: NoteDocumentWidth;
}) {
  const select = useWorld((s) => s.select);
  const requestWorld = useWorldCommand((s) => s.request);
  const groups = noteGroups(item, fields);
  const lead = leadOf(item);
  const born = bornHere(item);
  const body = typeof item.body === "string" ? item.body : "";
  const two = width === "row"; // row expansion: full width, groups in two columns

  const flyTo = (target: string) => {
    const addr = targetAddr(item, target);
    const [m, id] = addr.split(":");
    if (m && id) {
      select({ kind: "note", id, module: m });
      requestWorld({ kind: "flyTo", addr });
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {/* header: type glyph + TITLE large · id beneath as quiet mono · status pill */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <TypeGlyph type={item.kind || "text"} note />
            <p className={`truncate font-semibold text-ink-100 ${width === "wing" ? "text-ui" : "text-lg"}`}>
              {item.title || item.id}
            </p>
          </div>
          <p className="mt-0.5 flex items-center gap-1.5 font-mono text-meta text-muted">
            <Dot hue={moduleHue(item.module)} />
            {item.module}:{item.id}
          </p>
        </div>
        {item.status ? <StatusPill status={item.status} /> : null}
      </div>

      {/* the lead — a summary when the note HAS one; absent = absent */}
      {lead && <p className="text-ui font-semibold leading-relaxed text-ink-100">{lead}</p>}

      {/* grouped attribute cards */}
      <div className={`grid gap-2 ${two ? "grid-cols-2" : "grid-cols-1"}`}>
        {groups.core.length > 0 && (
          <GroupCard title="Core">{groups.core.map((r) => <AttrLine key={r.key} row={r} />)}</GroupCard>
        )}
        {groups.schema.length > 0 && (
          <GroupCard title="Fields">{groups.schema.map((r) => <AttrLine key={r.key} row={r} />)}</GroupCard>
        )}
        {groups.relations.length > 0 && (
          <GroupCard title="Relations">
            {groups.relations.map((r, i) => (
              <button
                key={`${r.rtype}:${r.target}:${i}`}
                type="button"
                onClick={() => flyTo(r.target)}
                className="flex flex-col gap-0.5 border-b border-border px-3 py-1.5 text-left transition-colors last:border-b-0 hover:bg-hover"
              >
                <span className="flex items-baseline gap-3">
                  <span className="w-28 shrink-0 truncate text-meta text-muted">{r.rtype}</span>
                  <span className="min-w-0 flex-1 truncate text-ui text-accent-dim">{r.target}</span>
                </span>
                {r.note && <span className="pl-31 text-meta text-muted">{r.note}</span>}
              </button>
            ))}
          </GroupCard>
        )}
        {groups.extras.length > 0 && (
          <GroupCard title="Also carries">{groups.extras.map((r) => <AttrLine key={r.key} row={r} />)}</GroupCard>
        )}
      </div>

      {/* body: GFM, document-width; empty = the honest signal */}
      {body.trim() ? (
        <Gfm md={body} />
      ) : (
        <Text size="meta" tone="muted">no take yet — the body is opinion, and it’s empty</Text>
      )}

      {/* quiet footer + the ONE affordance (doctrine: edits only via the omnibar) */}
      <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
        <Text size="meta" tone="muted">{born ? `born: ${born}` : `${item.module}:${item.id}`}</Text>
        <span className="inline-flex items-center gap-1 text-meta text-muted">
          <Icon icon={Command} size={12} /> K to act
        </span>
      </div>
    </div>
  );
}
