// The Session brief — the digest renamed: "what the agent was told now"
// (.zuzuu/.live/digest.md, regenerated each session). Renders UNDER the
// pinned active session in §2 as a calm disclosure card — expandable inline,
// openable in the editor. Restyled as a quiet bordered summary card consistent
// with the calm sessions table and trace design.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { zuzuuApi } from "../lib/zuzuu-api";
import { useExplorer } from "../state/explorer";
import { DIGEST_PATH } from "./module-paths";

export function SessionBrief() {
  const q = useQuery({ queryKey: ["zuzuu", "digest"], queryFn: zuzuuApi.digest, refetchInterval: 6000 });
  const [expanded, setExpanded] = useState(false);
  const text = q.data?.text ?? "";
  const hasText = text.trim() !== "";
  const firstLine = hasText ? (text.trim().split("\n")[0] ?? "") : "";

  return (
    <div className="flex flex-col gap-1.5 border-l-2 border-border pl-2.5">
      {/* collapsed header row: toggle + first-line preview + open link */}
      <div className="flex items-baseline gap-2">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="wc-sans flex items-baseline gap-1 text-meta text-ink-500 transition-colors hover:text-ink-300"
          title={expanded ? "Collapse the session brief" : "Expand the session brief"}
          aria-expanded={expanded}
        >
          {/* chevron — inline svg so we control size exactly */}
          <svg
            viewBox="0 0 16 16"
            className="mt-px h-2.5 w-2.5 shrink-0 transition-transform"
            style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="M6 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>Session brief</span>
        </button>

        {/* first-line preview when collapsed */}
        {!expanded && (
          <span className="wc-sans min-w-0 truncate text-meta text-ink-600">
            {hasText ? firstLine : "none yet"}
          </span>
        )}

        {/* open-in-editor link */}
        {hasText && (
          <button
            onClick={() => useExplorer.getState().openPreviewPath(DIGEST_PATH)}
            className="wc-sans ml-auto shrink-0 text-meta text-ink-500 transition-colors hover:text-accent"
            title={`Open ${DIGEST_PATH} in the editor`}
          >
            open ›
          </button>
        )}
      </div>

      {/* expanded body */}
      {expanded && (
        !hasText ? (
          <div className="wc-sans text-meta text-ink-600">
            no brief yet — generated each session
          </div>
        ) : (
          <pre className="wc-mono max-h-36 overflow-auto whitespace-pre-wrap rounded-[var(--radius-ui)] border border-border bg-surface p-[var(--spacing-card)] text-meta text-ink-300">
            {text}
          </pre>
        )
      )}
    </div>
  );
}
