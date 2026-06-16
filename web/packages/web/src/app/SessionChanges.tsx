// The "Changes" view (the git-native wedge): what a session actually changed —
// a list of changed files (+/−) each expandable to its unified diff. Read-only,
// fail-soft: a session whose diff can't be resolved (merged branch gone) reads
// "Diff not available"; one with no net change reads "No changes". Source =
// `zuzuu session diff <id>` via the daemon (never touches the PTY/working tree).
import { useState, type ReactNode } from "react";
import type { SessionDiffFile, SessionFileAuthor, ZuzuuSessionEntry } from "@zuzuu-web/protocol";
import { useSessionDiffQuery, useSessionFileDiffQuery, useSessionFileAuthorsQuery } from "./queries";
import { Spinner, cx } from "../components/ui";
import { fmtDuration } from "../panel/sections";
import { summarizeOutcome } from "./outcome";

/** Compact, read-only outcome summary at the top of the Changes view: the whole
 *  run in one line — files +/− · turns · tools · errors · duration. */
function OutcomeCard({ session, diffTotals }: { session: ZuzuuSessionEntry; diffTotals: { files: number; additions: number; deletions: number } | null }) {
  const o = summarizeOutcome(session, diffTotals);
  const dur = fmtDuration(o.durationMs);
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--border)] bg-card px-3 py-1.5 text-meta text-muted-foreground">
      <span className="wc-mono inline-flex items-center gap-1.5">
        <span className="wc-sans text-foreground">
          {o.files} file{o.files === 1 ? "" : "s"}
        </span>
        {o.additions > 0 && <span className="text-success">+{o.additions}</span>}
        {o.deletions > 0 && <span className="text-error">−{o.deletions}</span>}
      </span>
      <span className="wc-mono">{o.turns} turn{o.turns === 1 ? "" : "s"}</span>
      <span className="wc-mono">{o.tools} tool{o.tools === 1 ? "" : "s"}</span>
      <span className={cx("wc-mono", o.errors > 0 && "text-error")}>
        {o.errors} error{o.errors === 1 ? "" : "s"}
      </span>
      {dur && <span className="wc-mono ml-auto">{dur}</span>}
    </div>
  );
}

/** git status letter → tone. */
function statusTone(status: string): "add" | "remove" | "change" {
  if (status === "A") return "add";
  if (status === "D") return "remove";
  return "change"; // M / R / C / …
}

/** Colorized unified-diff lines (no Monaco — a session diff is read-only). */
function UnifiedDiff({ text }: { text: string }) {
  if (!text.trim()) return <div className="wc-mono p-2 text-meta text-muted-foreground">No textual diff.</div>;
  return (
    <pre className="wc-mono overflow-x-auto px-3 py-2 text-meta leading-relaxed">
      {text.split("\n").map((line, i) => {
        const tone =
          line.startsWith("@@")
            ? "text-accent-dim"
            : line.startsWith("+") && !line.startsWith("+++")
              ? "text-success"
              : line.startsWith("-") && !line.startsWith("---")
                ? "text-error"
                : line.startsWith("diff ") || line.startsWith("index ") || line.startsWith("+++") || line.startsWith("---")
                  ? "text-muted-foreground"
                  : "text-foreground/80";
        return (
          <div key={i} className={tone}>
            {line || " "}
          </div>
        );
      })}
    </pre>
  );
}

function FileRow({ sessionId, file, author }: { sessionId: string; file: SessionDiffFile; author?: SessionFileAuthor }) {
  const [open, setOpen] = useState(false);
  const diffQ = useSessionFileDiffQuery(sessionId, file.path, open);
  const tone = statusTone(file.status);
  return (
    <div className="border-b border-[var(--border)] last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-[var(--accent)]"
      >
        <span
          className={cx(
            "wc-mono inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-meta font-medium",
            tone === "add"
              ? "text-success bg-[color-mix(in_oklab,var(--color-success)_12%,transparent)]"
              : tone === "remove"
                ? "text-error bg-[color-mix(in_oklab,var(--color-error)_12%,transparent)]"
                : "text-warn bg-[color-mix(in_oklab,var(--color-warn)_12%,transparent)]",
          )}
          title={file.status}
        >
          {file.status}
        </span>
        <span className="wc-mono min-w-0 flex-1 truncate text-ui text-foreground">{file.path}</span>
        {/* W2b: the turn that wrote this file (best-effort — absent → nothing) */}
        {author && (
          <span
            className="wc-mono shrink-0 rounded-[var(--radius-sm)] bg-[var(--accent)] px-1.5 text-meta text-muted-foreground"
            title={`written by the ${author.turn} turn${author.ts ? ` at ${author.ts}` : ""}`}
          >
            {author.turn}
          </span>
        )}
        {file.additions > 0 && <span className="wc-mono shrink-0 text-meta text-success">+{file.additions}</span>}
        {file.deletions > 0 && <span className="wc-mono shrink-0 text-meta text-error">−{file.deletions}</span>}
        <svg
          viewBox="0 0 16 16"
          className={cx("h-3 w-3 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
        >
          <path d="M6 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="border-t border-[var(--border)] bg-card">
          {diffQ.isPending ? (
            <div className="flex items-center gap-2 px-3 py-2 text-meta text-muted-foreground">
              <Spinner /> loading diff…
            </div>
          ) : (
            <>
              <UnifiedDiff text={diffQ.data?.diff ?? ""} />
              {diffQ.data?.truncated && (
                <div className="px-3 pb-2 text-meta text-muted-foreground">…diff truncated</div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function SessionChanges({ session, alive }: { session: ZuzuuSessionEntry; alive: boolean }) {
  const sessionId = session.id;
  const q = useSessionDiffQuery(sessionId, true);
  // W2b: trace-linked authors (best-effort; absent → no badge). Gated on a
  // resolvable diff so we don't query authors when there's nothing changed.
  const authorsQ = useSessionFileAuthorsQuery(sessionId, q.data?.available === true);
  const authors = authorsQ.data?.authors ?? {};
  void alive; // polling cadence is handled in the query; alive kept for parity/intent

  if (q.isPending) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-ui text-muted-foreground">
        <Spinner /> loading changes…
      </div>
    );
  }

  const d = q.data;
  const diffTotals = d?.available ? d.totals : null;

  let body: ReactNode;
  if (!d || !d.available) {
    body = (
      <div className="flex flex-1 items-center justify-center p-8 text-center">
        <p className="max-w-xs text-ui leading-relaxed text-muted-foreground">
          Diff not available — this session's branch was merged or removed.
        </p>
      </div>
    );
  } else if (d.files.length === 0) {
    body = (
      <div className="flex flex-1 items-center justify-center p-8 text-center">
        <p className="max-w-xs text-ui leading-relaxed text-muted-foreground">No changes in this session yet.</p>
      </div>
    );
  } else {
    body = (
      <div className="min-h-0 flex-1 overflow-y-auto">
        {d.files.map((f) => (
          <FileRow key={f.path} sessionId={sessionId} file={f} author={authors[f.path]} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <OutcomeCard session={session} diffTotals={diffTotals} />
      {body}
    </div>
  );
}
