// shell/stage/ActorGlyph.tsx — the actor glyph (§G.1/§H.7): who did it, at a
// glance. One lucide glyph per bucket the substrate names (human · agent ·
// migration · ingestion); anything else (e.g. `init`'s seed writes) gets a
// neutral fallback glyph — the raw actor string still rides the tooltip, never
// silently relabeled. Mirrors TypeGlyph's shape.
import { User, Bot, GitBranch, Inbox, CircleHelp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { actorBucket, type ActorBucket } from "../../note/note-history-model.js";
import { Icon, Text } from "../../ds/index.js";

const GLYPHS: Record<ActorBucket, LucideIcon> = {
  human: User,
  agent: Bot,
  migration: GitBranch,
  ingestion: Inbox,
  other: CircleHelp,
};

export function ActorGlyph({ actor }: { actor?: string }) {
  const bucket = actorBucket(actor);
  return (
    <Text tone="muted" title={actor ?? "unknown actor"}>
      <Icon icon={GLYPHS[bucket]} size={12} />
    </Text>
  );
}
