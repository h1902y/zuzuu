// lib/PlainFilePath.tsx — §G.3's affordance: a quiet on-disk-path caption + a copy
// button. Never a file-opener (the browser can't reach the local filesystem) — this
// is the click that teaches "it's just a file," everywhere a note/module/schema
// card is shown. Reused by NoteDocument (a note's own file) and the module Schema
// wing (module.md, the table's contract).
import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Icon, Text } from "../ds/index.js";

export function PlainFilePath({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard?.writeText(path).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };

  return (
    <button
      type="button"
      onClick={copy}
      title="this is a plain file — copy its path and open it in any editor"
      className="inline-flex items-center gap-1.5 text-meta text-muted transition-colors hover:text-subtle"
    >
      <Text size="meta" mono tone="muted">{path}</Text>
      <Icon icon={copied ? Check : Copy} size={11} />
    </button>
  );
}
