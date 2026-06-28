// shell/review/proposal-chip.ts — map a staged proposal to its type chip. Keyed on the
// NOTE TYPE first (so a `type: rule` note reads as a Guardrail even when it lives in the
// `instructions` module — the rename moved mined rules there), falling back to the
// module, then a neutral default. Pure → tested.
import type { ChipTone } from "../../ds/index.js";

export interface ChipSpec { label: string; tone: ChipTone }

const BY_TYPE: Record<string, ChipSpec> = {
  knowledge: { label: "Knowledge", tone: "knowledge" },
  episode: { label: "Memory", tone: "memory" },
  action: { label: "Action", tone: "actions" },
  instruction: { label: "Instruction", tone: "instructions" },
  rule: { label: "Guardrail", tone: "guardrails" },
};

const BY_MODULE: Record<string, ChipSpec> = {
  knowledge: { label: "Knowledge", tone: "knowledge" },
  memory: { label: "Memory", tone: "memory" },
  actions: { label: "Action", tone: "actions" },
  instructions: { label: "Instruction", tone: "instructions" },
  guardrails: { label: "Guardrail", tone: "guardrails" },
};

/** The chip for a proposal — note type wins (rule → Guardrail regardless of module),
 *  else the module, else a neutral pill carrying the module name. */
export function proposalChip(noteType: unknown, module: string): ChipSpec {
  if (typeof noteType === "string" && BY_TYPE[noteType]) return BY_TYPE[noteType];
  if (BY_MODULE[module]) return BY_MODULE[module];
  return { label: module || "Note", tone: "neutral" };
}
