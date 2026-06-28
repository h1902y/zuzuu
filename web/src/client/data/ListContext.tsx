// data/ListContext.tsx — the thin React provider over list-state (pure logic) + the
// DataProvider. One <NotesListProvider module> owns the list; grid/chips/record-panel
// consume via useList() — no prop-drilling. (The pull-model; logic lives in list-state.)
import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ModuleItem, StagedSummary } from "#shared/index.js";
import { dataProvider } from "./provider.js";
import { listReducer, initialListState, queryOf, type ListState, type ListAction } from "./list-state.js";

interface ListContextValue {
  module: string;
  state: ListState;
  dispatch: Dispatch<ListAction>;
  rows: ModuleItem[];
  total: number;
  pages: number;
  staged: StagedSummary[];
  loading: boolean;
}

const Ctx = createContext<ListContextValue | null>(null);

export function NotesListProvider({ module, children }: { module: string; children: ReactNode }) {
  const [state, dispatch] = useReducer(listReducer, initialListState);
  const q = useQuery({
    // the full query (filter·sort·page) keys the cache — any change refetches the page.
    queryKey: ["zuzuu", "list", module, state.text, state.kind, state.sort?.key, state.sort?.dir, state.page, state.pageSize],
    queryFn: () => dataProvider.getList(module, queryOf(state)),
  });
  // the server already filtered·sorted·sliced; rows ARE the page, total is pre-paginate.
  const total = q.data?.total ?? 0;
  const value: ListContextValue = {
    module, state, dispatch,
    rows: q.data?.items ?? [], total, pages: Math.max(1, Math.ceil(total / state.pageSize)),
    staged: q.data?.staged ?? [], loading: q.isLoading,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useList(): ListContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useList must be used inside <NotesListProvider>");
  return v;
}
