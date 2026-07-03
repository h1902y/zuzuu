// note/NoteDocument.tsx — THE note detail rendering (§H.6): one component, every
// container (omnibar detail pane · wing · inline row expansion), width-adaptive.
// Notion document grammar: header → lead → grouped attribute cards → GFM body →
// collapsed History → quiet footer. READ-ONLY by doctrine — the single
// affordance is the "Act ⌘K" hint; relation rows fly the map (navigation, not
// mutation); History is a read too (§G.1 — teach the substrate).
import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ModuleItem, HistoryEntry } from "#shared/index.js";
import type { FieldDef } from "../data/field-registry.js";
import { Command } from "lucide-react";
import { Gfm } from "../lib/Gfm.js";
import { api } from "../lib/api.js";
import { relativeTimeFromIso } from "../lib/time.js";
import { notePath, modulePath } from "../lib/plain-file.js";
import { PlainFilePath } from "../lib/PlainFilePath.js";
import { moduleHue } from "../world/model.js";
import { TypeGlyph } from "../shell/stage/TypeGlyph.js";
import { StatusPill } from "../shell/stage/StatusPill.js";
import { ActorGlyph } from "../shell/stage/ActorGlyph.js";
import { noteGroups, leadOf, bornHere, targetAddr, type AttrRow } from "./note-document-model.js";
import { historyExtra, historyOpLabel } from "./note-history-model.js";
import { useWorld } from "../shell/world-state.js";
import { useWorldCommand } from "../state/world-command.js";
import { useRootMode } from "../state/root-mode.js";
import { Icon, Text } from "../ds/index.js";

export type NoteDocumentWidth = "panel" | "wing" | "row";

/** Structural match (not reference — the entry rode a separate JSON.parse than
 *  `entries`) for highlighting the History row `bornAt` names. */
const sameEntry = (a: HistoryEntry | null, b: HistoryEntry): boolean => a != null && JSON.stringify(a) === JSON.stringify(b);

function Dot({ hue }: { hue: number }) {
  return (
    <svg aria-hidden width="8" height="8" className="shrink-0">
      <circle cx="4" cy="4" r="4" fill={`hsl(${hue} 58% 60%)`} />
    </svg>
  );
}

function GroupCard({ title, titleTooltip, footnote, children }: {
  title: string;
  /** §G.3: a one-line OKF explainer riding the header as a native tooltip (same
   *  quiet-teaching pattern AttrLine already uses for a field's `description`). */
  titleTooltip?: string;
  /** §G.3: "this is a plain file — <module>/module.md", quiet, under the schema card. */
  footnote?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-ui border border-border bg-surface">
      <p
        className={`border-b border-border px-3 py-1.5 text-meta font-semibold uppercase tracking-wide text-muted ${titleTooltip ? "underline decoration-dotted decoration-muted/60 underline-offset-2" : ""}`}
        title={titleTooltip}
      >
        {title}
      </p>
      <div className="flex flex-col">{children}</div>
      {footnote && <p className="border-t border-border px-3 py-1 text-meta text-muted">{footnote}</p>}
    </div>
  );
}

function AttrLine({ row }: { row: AttrRow }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-border px-3 py-1.5 last:border-b-0">
      {/* the field-config panel's `description` (§H.5) rides as a native tooltip
          on the label — a quiet teaching surface, never a second UI element */}
      <span
        className={`w-28 shrink-0 truncate text-meta text-muted ${row.description ? "underline decoration-dotted decoration-muted/60 underline-offset-2" : ""}`}
        title={row.description}
      >
        {row.label}
      </span>
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
  // §G.3 — the plain-file link: root-mode aware (undefined while project-state is
  // still loading — the caption holds rather than guess a wrong prefix).
  const rootMode = useRootMode();

  // §G.1 — a note's history: the module's log.jsonl filtered to this note (the
  // daemon's peek-only /history route — no CLI verb backs this read). Collapsed
  // by default; the footer's "born here" line opens + scrolls to the earliest
  // create entry it names.
  const history = useQuery({
    queryKey: ["zuzuu", "history", item.module, item.id],
    queryFn: () => api.zuzuu.history(item.module, item.id),
  });
  const bornAt = history.data?.bornAt ?? null;
  const nowMs = Date.now();
  const historyRef = useRef<HTMLDetailsElement>(null);
  const bornRowRef = useRef<HTMLDivElement>(null);
  const openBornInHistory = () => {
    if (historyRef.current) historyRef.current.open = true;
    requestAnimationFrame(() => bornRowRef.current?.scrollIntoView({ block: "nearest" }));
  };

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
          // §G.3 — the contract, visible: the schema card names its own file
          // (root-mode aware — undefined while loading holds the generic line).
          <GroupCard
            title="Fields"
            footnote={`this is a plain file — ${rootMode === undefined ? `${item.module}/module.md` : modulePath(item.module, rootMode)}`}
          >
            {groups.schema.map((r) => <AttrLine key={r.key} row={r} />)}
          </GroupCard>
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
                {/* aligns under the target column: the w-28 (7rem) label + gap-3 (0.75rem) above */}
                {r.note && <span className="pl-[7.75rem] text-meta text-muted">{r.note}</span>}
              </button>
            ))}
          </GroupCard>
        )}
        {groups.extras.length > 0 && (
          // §G.3 — the envelope's tolerance, explained where it's exercised: unknown
          // frontmatter keys round-trip untouched (OKF: only `type` is required).
          <GroupCard
            title="Also carries"
            titleTooltip="Unknown frontmatter keys are never dropped — only `type` is required (the envelope's OKF tolerance); everything else round-trips untouched, and shows up here."
          >
            {groups.extras.map((r) => <AttrLine key={r.key} row={r} />)}
          </GroupCard>
        )}
      </div>

      {/* body: GFM, document-width; empty = the honest signal */}
      {body.trim() ? (
        <Gfm md={body} />
      ) : (
        <Text size="meta" tone="muted">no take yet — the body is opinion, and it’s empty</Text>
      )}

      {/* History (§G.1) — collapsed by default: the module's log.jsonl filtered to
          this note, newest first, capped 50. Peek-only (no CLI verb backs it). Most
          `ts` values are honestly null today (nothing in the write path stamps one
          yet — see src/notes/log.mjs) — relativeTimeFromIso says so rather than
          inventing "just now". */}
      {history.data && history.data.entries.length > 0 && (
        <details ref={historyRef} className="rounded-ui border border-border">
          <summary className="cursor-pointer select-none px-3 py-1.5 text-meta font-semibold uppercase tracking-wide text-muted">
            History · {history.data.entries.length}
          </summary>
          <div className="flex flex-col border-t border-border">
            {history.data.entries.map((e, i) => {
              const isBorn = sameEntry(bornAt, e);
              const extra = historyExtra(e);
              return (
                <div
                  key={i}
                  ref={isBorn ? bornRowRef : undefined}
                  className={`flex items-center gap-3 border-b border-border px-3 py-1.5 last:border-b-0 ${isBorn ? "bg-selected" : ""}`}
                >
                  <ActorGlyph actor={e.actor} />
                  <span className="w-20 shrink-0 text-meta text-subtle">{historyOpLabel(e)}</span>
                  <span className="min-w-0 flex-1 truncate text-meta text-muted">{extra ?? (isBorn ? "born here" : "—")}</span>
                  <span className="shrink-0 text-meta text-muted" title={e.ts ?? "time not recorded"}>
                    {relativeTimeFromIso(e.ts, nowMs, "time not recorded")}
                  </span>
                </div>
              );
            })}
          </div>
        </details>
      )}

      {/* quiet footer + the ONE affordance (doctrine: edits only via the omnibar) */}
      <div className="flex flex-col gap-1 border-t border-border pt-2">
        <div className="flex items-center justify-between gap-3">
          {bornAt ? (
            <Text as="button" interactive size="meta" tone="muted" onClick={openBornInHistory}>
              {born ? `born: ${born}` : "born here"}
            </Text>
          ) : (
            <Text size="meta" tone="muted">{born ? `born: ${born}` : `${item.module}:${item.id}`}</Text>
          )}
          <span className="inline-flex items-center gap-1 text-meta text-muted">
            <Icon icon={Command} size={12} /> K to act
          </span>
        </div>
        {/* §G.3 — the plain-file link: this note IS a file; show the path + copy,
            never a file-opener (the browser can't reach the local filesystem). */}
        {rootMode !== undefined && <PlainFilePath path={notePath(item.module, item.id, rootMode)} />}
      </div>
    </div>
  );
}
