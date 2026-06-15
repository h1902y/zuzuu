// Pure logic for the ＋New module guided wizard (WS-D), React-free and
// unit-tested. The wizard maps plain-language GOALS → a capability bundle, then
// composes a declarative module's manifest deterministically (the Part I engine
// already understands these capabilities — ZERO bespoke code per module).

/** A plain-language goal → the capabilities it bundles. */
export interface Goal {
  id: string;
  label: string;
  blurb: string;
  capabilities: string[];
}

export const GOALS: Goal[] = [
  {
    id: "capture-recall",
    label: "Capture & recall",
    blurb: "Store items and find them again by field or by meaning.",
    capabilities: ["items.collection", "query.structured", "query.semantic"],
  },
  {
    id: "learn",
    label: "Learn from my sessions",
    blurb: "Mine your real sessions into proposals you review.",
    capabilities: ["mine"],
  },
  {
    id: "procedure",
    label: "Run a procedure",
    blurb: "Keep a runnable script the agent can execute on demand.",
    capabilities: ["exec.script"],
  },
];

/** capability name → a short human phrase ("It can: …"). */
export const CAPABILITY_PHRASES: Record<string, string> = {
  "items.collection": "store items",
  "query.structured": "find things by field",
  "query.semantic": "find things by meaning",
  mine: "learn from your sessions",
  "exec.script": "run a procedure",
};

/** De-duped union of the capabilities the selected goals bundle. Always
 *  includes `items.collection` so the module has an apply path (somewhere for
 *  items to live), even if no goal contributed it. */
export function capabilitiesFor(selectedGoalIds: string[]): string[] {
  const set = new Set<string>(["items.collection"]);
  for (const id of selectedGoalIds) {
    const goal = GOALS.find((g) => g.id === id);
    if (goal) for (const cap of goal.capabilities) set.add(cap);
  }
  return [...set];
}

/** Title → a safe module slug (lowercase, [a-z0-9_-], collapsed hyphens). */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

/** The plain-language draft preview the review step renders. */
export interface DraftSummary {
  title: string;
  id: string;
  /** human phrases for each capability — the "It can: …" bullets */
  can: string[];
  /** the kind of item this module stores (the "Stores: … items" line) */
  kind: string;
  capabilities: string[];
}

/** Compose the reviewable draft from the wizard choices. */
export function draftSummary({
  title,
  goals,
  kind,
}: {
  title: string;
  goals: string[];
  kind: string;
}): DraftSummary {
  const capabilities = capabilitiesFor(goals);
  return {
    title: title.trim() || "Untitled module",
    id: slugify(title),
    can: capabilities.map((c) => CAPABILITY_PHRASES[c] ?? c),
    kind: kind.trim() || "note",
    capabilities,
  };
}
