// ds/kit/Markdown.tsx — the lazy boundary for rendered markdown (note bodies). The
// react-markdown bundle loads only when a body is actually shown; the fallback renders
// the raw text (the prior behaviour) so there's never a blank flash. Mirrors the
// palette's lazy pattern.
import { lazy, Suspense } from "react";

const MarkdownImpl = lazy(() => import("./markdown-impl.js"));

export function Markdown({ children }: { children: string }) {
  return (
    <Suspense fallback={<div className="md-body whitespace-pre-wrap">{children}</div>}>
      <MarkdownImpl>{children}</MarkdownImpl>
    </Suspense>
  );
}
