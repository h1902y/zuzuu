// state/root-mode.ts — §G.3: is this Project root-mode (modules at the repo root,
// no `.zuzuu/` prefix)? A thin react-query wrapper over the SAME project-state
// fetch Settings already uses (queryKey-deduped, so this never adds a network
// round-trip beyond the one the shell already makes). `undefined` while loading —
// callers should hold the plain-file caption rather than guess.
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.js";

export function useRootMode(): boolean | undefined {
  const q = useQuery({ queryKey: ["zuzuu", "project-state"], queryFn: api.zuzuu.projectState });
  return q.data?.rootMode;
}
