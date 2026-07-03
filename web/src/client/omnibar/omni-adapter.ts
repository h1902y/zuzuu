// src/client/omnibar/omni-adapter.ts — the ADAPTER (§E.3): intent routing over the
// CLOSED registry. One resolver sits on top of the commands: plain-language input
// in, the RIGHT registry invocation out — rendered as a TOP suggestion row that
// Enter confirms. The adapter has NO authority of its own: it emits a canned
// invocation and the target's own lane applies (instant operator verbs vs
// agent-lane proposals — the row carries the target's badge).
//
// Three tiers, cheapest first (§E.3):
//   a. exact grammar — the existing prefix/substring paths, untouched (the adapter
//      only ADDS a row; it never intercepts).
//   b. deterministic fuzz — THIS file: a synonym table per verb + schema-aware
//      slot filling ("add a lead acme to crm" → the crm draft form pre-filled),
//      pure and offline, no model.
//   c. LLM resolve — when (b) can't score, ONE row offers "Ask the agent to do
//      this →", routing the raw input to the / chat surface with a preamble that
//      asks the agent to act via its SANCTIONED channels. Deliberately no bespoke
//      function-calling plumbing: the ACP lane + the review gate IS the tier-3
//      resolver — anything the agent does lands as proposals the human decides.

import type { PaletteAction, PaletteCommand, PaletteGroup } from "../palette/palette-commands.js";
import type { Lane } from "./omni-shell.js";

export interface AdapterCtx {
  modules: { id: string; title: string }[];
}

export interface AdapterResolution {
  /** 0..1 — how much of the input the rule consumed (the confidence). */
  score: number;
  label: string;
  meta?: string;
  lane: Lane;
  action: PaletteAction;
}

/** Fire the resolver only above this consumed-tokens confidence. */
export const ADAPTER_THRESHOLD = 0.5;

const VERBS_CREATE = new Set(["add", "create", "new", "make", "capture", "write", "record", "jot"]);
const VERBS_SHOW = new Set(["show", "open", "view", "see", "display"]);
const VERBS_REVIEW = new Set(["review", "approve", "gate", "pending", "proposals", "proposal"]);
const VERBS_SESSION = new Set(["start", "launch", "session", "terminal", "shell"]);
const PROJ_MAP = new Set(["map", "island", "graph", "world", "constellation"]);
const PROJ_TABLE = new Set(["table", "rows", "grid", "list"]);
const NOTE_WORDS = new Set(["note", "notes", "row", "entry", "item", "lead", "idea", "thought"]);
// glue words never carry slot meaning — dropped before title slot-filling
const STOP = new Set(["a", "an", "the", "to", "in", "into", "on", "of", "about", "for", "as", "called", "named", "with", "my", "me", "please", "and"]);

const tokenize = (q: string): string[] => q.toLowerCase().match(/[a-z0-9][a-z0-9._-]*/g) ?? [];

/** The module a query names (id or title word match), if any. */
function findModule(tokens: string[], ctx: AdapterCtx): { id: string; title: string } | null {
  for (const m of ctx.modules) {
    const names = new Set([m.id.toLowerCase(), ...m.title.toLowerCase().split(/\s+/)]);
    if (tokens.some((t) => names.has(t))) return m;
  }
  return null;
}

/**
 * Tier b: deterministically resolve a plain-language intent to ONE registry
 * invocation. Pure; null when nothing scores. Never executes — the caller
 * renders the resolution as a row and Enter confirms.
 */
export function resolveIntent(query: string, ctx: AdapterCtx): AdapterResolution | null {
  const tokens = tokenize(query);
  if (tokens.length < 2) return null; // one word is the exact-grammar tier's job

  const module = findModule(tokens, ctx);
  const used = new Set<string>();
  const consume = (t: string) => used.add(t);
  const score = () => used.size / tokens.length;

  // ── create a row: verb + (module) + slot-filled title ──
  const createVerb = tokens.find((t) => VERBS_CREATE.has(t));
  const noteWord = tokens.find((t) => NOTE_WORDS.has(t));
  if (createVerb && (module || noteWord)) {
    consume(createVerb);
    if (noteWord) consume(noteWord);
    for (const t of tokens) if (STOP.has(t)) consume(t);
    const moduleNames = module ? new Set([module.id.toLowerCase(), ...module.title.toLowerCase().split(/\s+/)]) : new Set<string>();
    if (module) for (const t of tokens) if (moduleNames.has(t)) consume(t);
    const title = tokens.filter((t) => !used.has(t)).join(" ");
    const target = module?.id ?? "knowledge";
    return {
      score: Math.max(score(), title ? 0.55 : 0.5),
      label: `→ new note${title ? ` “${title}”` : ""} in ${target}`,
      meta: "opens the draft form, pre-filled",
      // the draft STAGES on save — the agent-lane gate decides (the inversion holds)
      lane: "proposal",
      action: { kind: "draft-note", module: target, title },
    };
  }

  // ── show a module as a projection: "show knowledge as a map" ──
  if (module) {
    const asMap = tokens.find((t) => PROJ_MAP.has(t));
    const asTable = tokens.find((t) => PROJ_TABLE.has(t));
    const showVerb = tokens.find((t) => VERBS_SHOW.has(t));
    if (asMap || asTable) {
      if (showVerb) consume(showVerb);
      consume((asMap ?? asTable)!);
      for (const t of tokens) if (STOP.has(t)) consume(t);
      const names = new Set([module.id.toLowerCase(), ...module.title.toLowerCase().split(/\s+/)]);
      for (const t of tokens) if (names.has(t)) consume(t);
      return asMap
        ? { score: score(), label: `→ ${module.id} as the island`, meta: "focus the map", lane: "nav", action: { kind: "world-module", id: module.id } }
        : { score: score(), label: `→ ${module.id} as a table`, meta: "open the rows", lane: "nav", action: { kind: "open-module", id: module.id } };
    }
    if (showVerb) {
      consume(showVerb);
      for (const t of tokens) if (STOP.has(t)) consume(t);
      const names = new Set([module.id.toLowerCase(), ...module.title.toLowerCase().split(/\s+/)]);
      for (const t of tokens) if (names.has(t)) consume(t);
      return { score: score(), label: `→ open ${module.id}`, meta: "the module's table", lane: "nav", action: { kind: "open-module", id: module.id } };
    }
  }

  // ── the gate: "review the pending proposals" ──
  const reviewVerb = tokens.find((t) => VERBS_REVIEW.has(t));
  if (reviewVerb) {
    for (const t of tokens) if (VERBS_REVIEW.has(t) || STOP.has(t)) consume(t);
    return { score: score(), label: "→ review — open the gate", lane: "nav", action: { kind: "review" } };
  }

  // ── everything / fit ──
  if (tokens.includes("everything") || (tokens.includes("all") && tokens.some((t) => NOTE_WORDS.has(t)))) {
    for (const t of tokens) if (t === "everything" || t === "all" || NOTE_WORDS.has(t) || STOP.has(t) || VERBS_SHOW.has(t)) consume(t);
    return { score: score(), label: "→ everything — one table over every module", lane: "nav", action: { kind: "open-everything" } };
  }
  if ((tokens.includes("zoom") && tokens.includes("out")) || (tokens.includes("fit") && tokens.some((t) => PROJ_MAP.has(t)))) {
    return { score: 0.8, label: "→ fit — frame the whole map", lane: "nav", action: { kind: "world-fit" } };
  }

  // ── a session: "start a terminal session" ──
  const sessionish = tokens.filter((t) => VERBS_SESSION.has(t));
  if (sessionish.length >= 2 || (sessionish.length === 1 && (tokens.includes("session") || tokens.includes("terminal") || tokens.includes("shell")))) {
    for (const t of tokens) if (VERBS_SESSION.has(t) || STOP.has(t)) consume(t);
    return { score: score(), label: "→ new shell session", lane: "instant", action: { kind: "new-shell" } };
  }

  return null;
}

/** Tier c: the one agent-fallback row. The preamble points the agent at its
 *  SANCTIONED channels — whatever it does lands as proposals through the gate. */
export function agentFallback(query: string): PaletteCommand {
  return {
    value: "omni-adapter-agent",
    label: "Ask the agent to do this →",
    meta: `“${query.trim()}”`,
    lane: "proposal",
    action: {
      kind: "converse",
      prompt: `Do this in the project (use your sanctioned zuzuu channels — stage proposals for any brain change; the review gate decides): ${query.trim()}`,
    },
  };
}

/** The adapter's group for the root list: the tier-b resolution (top row, when it
 *  scores) + the tier-c agent offer (when the input reads like an intent the
 *  deterministic tiers can't place). null = the adapter stays silent. */
export function adapterGroup(query: string, ctx: AdapterCtx): PaletteGroup | null {
  const q = query.trim();
  if (!q || q.startsWith(">") || q.startsWith("/")) return null;
  const tokens = tokenize(q);
  const resolved = resolveIntent(q, ctx);
  const commands: PaletteCommand[] = [];
  if (resolved && resolved.score >= ADAPTER_THRESHOLD) {
    commands.push({
      value: "omni-adapter-do",
      label: resolved.label,
      ...(resolved.meta ? { meta: resolved.meta } : {}),
      lane: resolved.lane,
      action: resolved.action,
      hint: "↵ confirm",
    });
  }
  // ≥3 words with no (or weak) deterministic resolution reads like an intent —
  // offer the agent, never guess-execute.
  if (tokens.length >= 3 && (!resolved || resolved.score < ADAPTER_THRESHOLD)) {
    commands.push(agentFallback(q));
  }
  return commands.length ? { heading: "Do", commands } : null;
}
