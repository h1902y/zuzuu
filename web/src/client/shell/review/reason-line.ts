// shell/review/reason-line.ts — the one-line WHY a proposal exists (KTD2).
//
// A PURE template over the proposal's ROUTE kind + its corroborating evidence:
//   "Because you {did X} in {N} sessions, I want to {action}."
// Never a misleading sentence — an unknown kind falls back to a neutral statement of
// fact ("Recurring signal across N sessions"). Logic lives here (tested); the .tsx
// only renders the string.
import type { StagedEvidence } from "#shared/index.js";

/** ROUTE kind → the (did, action) clause pair. Mirrors observe.mjs ROUTE:
 *  command→action, entity/fact→knowledge, guardrail→ask-rule, correction→instruction,
 *  workflow→action. Keyed on the candidate kind, not the module. */
const CLAUSES: Record<string, { did: string; action: string }> = {
  command: { did: "ran this command", action: "save it as a reusable action" },
  workflow: { did: "ran this sequence", action: "save it as a reusable action" },
  entity: { did: "touched this file", action: "remember it as project knowledge" },
  fact: { did: "hit this", action: "remember it as project knowledge" },
  guardrail: { did: "ran a destructive command", action: "add an ask-before gate" },
  correction: { did: "made this correction", action: "make it standing guidance" },
};

const sessions = (evidence?: StagedEvidence[]): number => {
  const first = evidence?.[0];
  const n = typeof first?.sessions === "number" ? first.sessions : 0;
  return n > 0 ? n : 1; // a staged proposal corroborated across ≥1 session by construction
};

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;

/** Build the reason line for a proposal. `kind` is the ROUTE kind (from
 *  `evidence[0].kind`); `evidence` carries the corroboration count. */
export function reasonLine(kind: string | undefined, evidence?: StagedEvidence[]): string {
  const n = sessions(evidence);
  const clause = kind ? CLAUSES[kind] : undefined;
  if (!clause) return `Recurring signal across ${plural(n, "session")}`;
  return `Because you ${clause.did} in ${plural(n, "session")}, I want to ${clause.action}.`;
}
