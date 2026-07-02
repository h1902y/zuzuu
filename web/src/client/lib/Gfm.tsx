// lib/Gfm.tsx — the safe GFM renderer over gfm-model's block tree (§H.1).
// React elements only (no dangerouslySetInnerHTML anywhere) — the parser never
// emits raw HTML, so escaping is by construction. ds tokens; quiet typography.
import type { ReactNode } from "react";
import { parseGfm, type Block, type Inline } from "./gfm-model.js";

function InlineSpan({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((n, i) => {
        switch (n.t) {
          case "text": return <span key={i}>{n.text}</span>;
          case "code": return <code key={i} className="rounded-ui bg-elevated px-1 py-0.5 text-meta text-ink-100">{n.text}</code>;
          case "strong": return <strong key={i} className="font-semibold text-ink-100"><InlineSpan nodes={n.children} /></strong>;
          case "em": return <em key={i}><InlineSpan nodes={n.children} /></em>;
          case "link": return (
            <a key={i} href={n.href} target="_blank" rel="noopener noreferrer" className="text-accent-dim underline decoration-border underline-offset-2 hover:text-accent">
              {n.text}
            </a>
          );
        }
      })}
    </>
  );
}

function BlockEl({ b }: { b: Block }) {
  switch (b.t) {
    case "heading": {
      const cls = b.depth <= 2 ? "text-ui font-semibold text-ink-100" : "text-ui font-medium text-ink-100";
      return <p className={`${cls} mt-3 first:mt-0`}><InlineSpan nodes={b.children} /></p>;
    }
    case "para":
      return <p className="text-ui leading-relaxed text-subtle"><InlineSpan nodes={b.children} /></p>;
    case "code":
      return (
        <pre className="overflow-x-auto rounded-ui border border-border bg-elevated p-3 text-meta text-subtle">
          <code>{b.text}</code>
        </pre>
      );
    case "list":
      return (
        <ul className={`flex flex-col gap-1 pl-1 ${b.ordered ? "list-decimal pl-5" : ""}`}>
          {b.items.map((it, i) => (
            <li key={i} className="flex items-start gap-2 text-ui text-subtle">
              {it.task !== "none" && (
                <span aria-hidden className={`mt-0.5 text-meta ${it.task === "done" ? "text-success" : "text-muted"}`}>
                  {it.task === "done" ? "☑" : "☐"}
                </span>
              )}
              {it.task === "none" && !b.ordered && <span aria-hidden className="mt-0.5 text-muted">·</span>}
              <span className="min-w-0"><InlineSpan nodes={it.children} /></span>
            </li>
          ))}
        </ul>
      );
    case "quote":
      return (
        <blockquote className="border-l-2 border-accent-dim pl-3 text-ui text-muted">
          {b.children.map((line, i) => <p key={i}><InlineSpan nodes={line} /></p>)}
        </blockquote>
      );
    case "table":
      return (
        <table className="w-fit border-collapse text-meta">
          <thead>
            <tr>
              {b.header.map((h, i) => (
                <th key={i} className="border border-border bg-elevated px-2 py-1 text-left font-semibold text-ink-100"><InlineSpan nodes={h} /></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {b.rows.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => <td key={j} className="border border-border px-2 py-1 text-subtle"><InlineSpan nodes={c} /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      );
    case "hr":
      return <hr className="border-border" />;
  }
}

/** Render a markdown body. An empty body is the honest signal the doctrine says
 *  it is — the CALLER renders its "no take yet" state; this returns null. */
export function Gfm({ md }: { md: string }): ReactNode {
  const blocks = parseGfm(md);
  if (!blocks.length) return null;
  return <div className="flex min-w-0 flex-col gap-2">{blocks.map((b, i) => <BlockEl key={i} b={b} />)}</div>;
}
