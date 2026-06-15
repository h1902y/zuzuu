// The context-aware session composer (U2) — the bottom bar of the center.
// Two states, derived from whether an agent is live:
//   • IDLE   — a real prompt box ("What should <host> do?") + host pill + Send.
//              Typing a task and pressing ↵ launches the host ALREADY working
//              on it (the task is injected as the terminal's first input — see
//              startAgentSession's prompt option / termRegistry pending input).
//              Quick-start chips PRE-FILL the box (real choices, not launchers).
//   • ACTIVE — collapses to "● <host> · running" + Stop. No dropdown/chips/box:
//              you continue in the Terminal tab (terminal-first).
import { createPortal } from "react-dom";
import { forwardRef, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { zuzuuApi } from "../lib/zuzuu-api";
import { agentTabTitle, buildHostRows, composerDefaultHost, resolveStart, type HostRow } from "../modules/host-launch";
import { startAgentSession } from "../lib/agent-launch";
import { useSessions } from "../state/sessions";
import { composerMode, EXTERNAL_VIEW_NOTE, hasTask, idlePlaceholder, QUICK_CHIPS } from "./composer-state";
import { Bar, Button, Kbd, Spinner, StatusDot, cx } from "./ui";

// ── host glyph paths (16×16 stroke) — one per host, identity-only ─────────
// These glyphs appear only in the picker and the host pill — not as status.
const HOST_GLYPHS: Record<string, string> = {
  // Claude: A-shape letterform (anthropic-ish)
  claude: "M8 2.5L3 13.5h3l1-2.5h4l1 2.5h3L8 2.5zM5.5 9l2.5-5 2.5 5",
  // Gemini: four-point star / diamond cross
  gemini: "M8 2v5M8 9v5M2 8h5M9 8h5",
  // Codex: code brackets < >
  codex: "M5.5 4L2.5 8l3 4M10.5 4l3 4-3 4",
  // pi: the greek letter π
  pi: "M3.5 5.5H12.5M6.5 5.5v7M10 5.5c0 3.5-.5 5.5-2 7",
  // OpenCode: terminal prompt >_
  opencode: "M3 4l3.5 4L3 12M8.5 12H13",
};

/** One-line description for each host shown in the picker dropdown. */
const HOST_DESC: Record<string, string> = {
  claude: "Anthropic's coding agent — strong reasoning and editing",
  gemini: "Google's CLI agent — multimodal and fast iteration",
  codex: "OpenAI's coding agent — tight IDE integration",
  pi: "pi — the lightweight owned harness (stage 3)",
  "zuzuu code": "OpenCode bundled — always available, no install needed",
};

/** Map a row command to its glyph/desc key. */
function hostKey(command: string): string {
  return command === "zuzuu code" ? "opencode" : command;
}

/** Launch the selected host with an optional first task. resolveStart applies
 *  the argv-first hybrid (positional prompt arg where supported, else keystroke
 *  injection). Single-active-agent rule lives in startAgentSession: while one is
 *  alive, this focuses it instead of spawning a second one. */
export function startHostRow(rowCommand: string, prompt?: string): void {
  const start = resolveStart(rowCommand, prompt);
  if (start) {
    void startAgentSession(start.spec, { injectPrompt: start.injectPrompt }).catch((err: Error) =>
      window.alert(err.message),
    );
  }
}

// ── HostPill ─────────────────────────────────────────────────────────────────
// The quiet pill that summarises the selected host. Clicking opens the picker.
function HostPill({
  label,
  command,
  pillRef,
  expanded,
  onClick,
}: {
  label: string;
  command: string;
  pillRef: React.RefObject<HTMLButtonElement | null>;
  expanded: boolean;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  const glyph = HOST_GLYPHS[hostKey(command)];
  return (
    <button
      ref={pillRef}
      onClick={onClick}
      aria-haspopup="menu"
      aria-expanded={expanded}
      title={`Host: ${label} — click to change`}
      className={cx(
        "wc-sans wc-focus flex shrink-0 items-center gap-1.5",
        "rounded-[var(--radius-ui)] border border-[var(--border)] bg-popover px-2 py-1",
        "text-meta text-foreground transition-colors hover:border-[var(--border)] hover:text-foreground",
      )}
    >
      {glyph && (
        <svg
          viewBox="0 0 16 16"
          className="h-3 w-3 shrink-0 text-ink-400"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
        >
          <path d={glyph} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      <span>{label}</span>
      {/* chevron-down */}
      <svg
        viewBox="0 0 16 16"
        className="h-3 w-3 shrink-0 text-muted-foreground"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      >
        <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

// ── HostPickerMenu ────────────────────────────────────────────────────────────
// A portal menu that opens above the composer (the bar lives at the bottom).
// Two-line rows: label (+ "not installed" badge) + a one-line description.
// Mirrors MenuPopover's portal/close behavior without reusing it because we
// need the two-line row shape that MenuItem.hint can't express.
function HostPickerMenu({
  rows,
  anchorEl,
  onSelect,
  onClose,
}: {
  rows: HostRow[];
  anchorEl: HTMLElement | null;
  onSelect: (command: string) => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  // Measure and place the menu above the anchor (the pill button).
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el || !anchorEl) return;
    const anchor = anchorEl.getBoundingClientRect();
    const mw = el.offsetWidth;
    const mh = el.offsetHeight;
    const GAP = 4;
    // Prefer opening above the pill; never go off-screen.
    let top = anchor.top - GAP - mh;
    if (top < 8) top = anchor.bottom + GAP; // flip below if no room above
    // Align left edge of menu with pill, clamp to viewport.
    let left = anchor.left;
    left = Math.max(8, Math.min(left, window.innerWidth - 8 - mw));
    setPos({ left, top });
  }, [anchorEl]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t)) return;
      if (anchorEl?.contains(t)) return; // let the pill's own click toggle
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onScroll = (e: Event) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      onClose();
    };
    window.addEventListener("mousedown", onDown, true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onClose);
    return () => {
      window.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onClose);
    };
  }, [anchorEl, onClose]);

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      style={{
        position: "fixed",
        left: pos?.left ?? 0,
        top: pos?.top ?? 0,
        visibility: pos ? undefined : "hidden",
        boxShadow: "var(--shadow-menu)",
      }}
      onClick={(e) => e.stopPropagation()}
      className="wc-pop-in z-[80] w-64 overflow-hidden rounded-[var(--radius-ui)] border border-[var(--border)] bg-popover py-1"
    >
      <div className="wc-eyebrow px-3 py-1.5">Host</div>
      {rows.map((row) => {
        const glyph = HOST_GLYPHS[hostKey(row.command)];
        const desc = HOST_DESC[row.command] ?? "";
        return (
          <button
            key={row.command}
            role="menuitem"
            aria-disabled={!row.detected || undefined}
            onClick={() => {
              if (!row.detected) return;
              onSelect(row.command);
              onClose();
            }}
            className={cx(
              "flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors",
              row.detected ? "hover:bg-[var(--accent)]" : "cursor-default opacity-50",
            )}
          >
            {glyph ? (
              <svg
                viewBox="0 0 16 16"
                className={cx(
                  "mt-0.5 h-3.5 w-3.5 shrink-0",
                  row.detected ? "text-muted-foreground" : "text-muted-foreground",
                )}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
              >
                <path d={glyph} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <span className="mt-0.5 w-3.5 shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <div
                className={cx(
                  "wc-sans text-ui font-medium",
                  row.detected ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {row.label}
                {!row.detected && (
                  <span className="ml-1.5 text-meta font-normal text-muted-foreground">not installed</span>
                )}
              </div>
              {desc && (
                <div className="wc-sans mt-0.5 text-meta leading-relaxed text-muted-foreground">{desc}</div>
              )}
            </div>
          </button>
        );
      })}
    </div>,
    document.body,
  );
}

// ── SessionComposer ───────────────────────────────────────────────────────────
export interface SessionComposerProps {
  /** True when the center is VIEWING a session that runs in the user's own
   *  terminal (view-only). The composer can't reach it, so the idle box makes
   *  clear that Send starts a NEW session rather than replying to it. */
  viewingExternal?: boolean;
}
export const SessionComposer = forwardRef<HTMLDivElement, SessionComposerProps>(function SessionComposer(
  { viewingExternal = false },
  ref,
) {
  const hostsQ = useQuery({ queryKey: ["zuzuu", "hosts"], queryFn: zuzuuApi.hosts, refetchInterval: 8000 });
  const rows = buildHostRows(hostsQ.data?.hosts ?? []);
  const dflt = composerDefaultHost(rows);

  // The actively-selected host (defaults to the first detected row).
  const [selectedCommand, setSelectedCommand] = useState<string | null>(null);
  const activeCommand = selectedCommand ?? dflt?.command ?? null;
  const activeRow = rows.find((r) => r.command === activeCommand) ?? dflt;

  // Alive agent session — drives idle↔active. Single-active-agent v1 → ≤1.
  const { tabs, close } = useSessions();
  const aliveTab = tabs.find((t) => t.type === "agent" && t.alive);
  const mode = composerMode(Boolean(aliveTab));

  // Idle prompt-box value (the task to start the host with).
  const [prompt, setPrompt] = useState("");

  // Host-picker state + pill/textarea refs.
  const pillRef = useRef<HTMLButtonElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [pickerOpen, setPickerOpen] = useState(false);

  // Launch the selected host, handing it the typed task (blank → host opens
  // idle). Clear the box after. Send is allowed on empty too.
  function handleSend() {
    if (!activeRow) return;
    startHostRow(activeRow.command, prompt);
    setPrompt("");
  }

  function handleStop() {
    if (aliveTab) void close(aliveTab.id).catch(() => {});
  }

  // Active: minimal "● <host> · running" + Stop. You talk to the agent in the
  // Terminal tab (terminal-first) — no dropdown, no chips, no input box. Until
  // the PTY produces its first output, the session is still booting → show
  // "starting…" with a spinner (honest: we know started-vs-not, but NOT the
  // agent's thinking-vs-idle, so we never claim "working").
  if (mode === "active") {
    const hostLabel = agentTabTitle(aliveTab?.host);
    const starting = !aliveTab?.started;
    return (
      <div ref={ref} className="outline-none">
        <Bar border="t" surface="surface" className="!gap-2">
          {starting ? <Spinner /> : <StatusDot tone="ok" pulse title="Session running" />}
          <span className="wc-sans shrink-0 text-ui text-foreground">
            {hostLabel} <span className="text-muted-foreground">· {starting ? "starting…" : "running"}</span>
          </span>
          <span className="wc-sans hidden min-w-0 truncate text-meta text-muted-foreground sm:inline">
            {starting ? "Booting the host…" : "Continue in the Terminal tab"}
          </span>
          <div className="flex-1" />
          <Button variant="danger" size="sm" onClick={handleStop} title="Stop the running session" className="shrink-0">
            <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor">
              <rect x="4" y="4" width="8" height="8" rx="1" />
            </svg>
            Stop
          </Button>
        </Bar>
      </div>
    );
  }

  // Idle: a real prompt box. ↵ sends (Shift+↵ = newline). External
  // focus (onStartNew/onFocusComposer → ref.focus()) redirects into the box.
  return (
    <div
      ref={ref}
      tabIndex={-1}
      className="wc-focus border-t border-[var(--border)] bg-card px-3 py-2.5 outline-none"
      onFocus={() => textareaRef.current?.focus()}
    >
      {/* viewing a session that lives in the user's terminal: Send can't reply
          to it — it starts a new one. Say so right at the box. */}
      {viewingExternal && (
        <p className="wc-sans mb-1.5 text-meta text-muted-foreground">{EXTERNAL_VIEW_NOTE}</p>
      )}
      {/* native textarea (the Textarea primitive isn't a forwardRef) carrying
          the same wc-input styling so we can focus it imperatively */}
      <textarea
        ref={textareaRef}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
        }}
        rows={2}
        placeholder={idlePlaceholder(activeRow?.label, viewingExternal)}
        aria-label="Describe a task for your agent"
        className="wc-input w-full resize-none px-2 py-1.5"
      />

      <div className="mt-2 flex items-end justify-between gap-2">
        {/* host pill + quick-start chips (chips PRE-FILL the box, never launch) */}
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {activeRow ? (
            <HostPill
              label={activeRow.label}
              command={activeRow.command}
              pillRef={pillRef}
              expanded={pickerOpen}
              onClick={(e) => {
                e.stopPropagation();
                setPickerOpen((v) => !v);
              }}
            />
          ) : (
            <div className="flex items-center gap-1.5 px-2">
              <Spinner />
              <span className="wc-sans text-meta text-muted-foreground">Loading hosts…</span>
            </div>
          )}
          {QUICK_CHIPS.map((chip) => (
            <button
              key={chip.label}
              title={`Pre-fill: ${chip.fill}`}
              onClick={() => {
                setPrompt(chip.fill);
                textareaRef.current?.focus();
              }}
              className={cx(
                "wc-sans wc-focus inline-flex items-center rounded-full",
                "border border-[var(--border)] px-2.5 py-0.5 text-meta text-muted-foreground",
                "transition-colors hover:border-[var(--border)] hover:text-foreground",
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* ↵ hint + Send */}
        <div className="flex shrink-0 items-center gap-2">
          <span className="wc-sans hidden items-center gap-1 text-meta text-muted-foreground sm:flex">
            <Kbd>↵</Kbd> Send
          </span>
          <Button
            variant="primary"
            size="sm"
            disabled={!activeRow}
            onClick={handleSend}
            title={
              activeRow
                ? hasTask(prompt)
                  ? `Start ${activeRow.label} on this task`
                  : `Start ${activeRow.label}`
                : "No host available"
            }
          >
            <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M8 13V3M4 7l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Send
          </Button>
        </div>
      </div>

      {/* host picker — portal-rendered above the pill, closes on outside click */}
      {pickerOpen && (
        <HostPickerMenu
          rows={rows}
          anchorEl={pillRef.current}
          onSelect={(command) => {
            setSelectedCommand(command);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
});
