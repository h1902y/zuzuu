// ds/kit/markdown-impl.tsx — the actual markdown renderer (react-markdown + GFM).
// Loaded as its OWN chunk via the lazy boundary in Markdown.tsx, so react-markdown
// never touches the initial bundle (the library ratification: lean, lazy, MIT).
// Raw HTML is NOT enabled — react-markdown's safe default, so a note body can't inject
// markup. Element styling lives in the token-bound `.md-body` block in index.css
// (guard-safe — the renderer carries no inline classes).
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function MarkdownImpl({ children }: { children: string }) {
  return (
    <div className="md-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
