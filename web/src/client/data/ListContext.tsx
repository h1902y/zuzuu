// data/ListContext.tsx — the thin React provider over list-state (pure logic) + the
// DataProvider. One <NotesListProvider module> owns the list; grid/chips/record-panel
// consume via useList() — no prop-drilling. (The pull-model; logic lives in list-state.)
import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ModuleItem, StagedSummary } from "#shared/index.js";
import { dataProvider } from "./provider.js";
import { listReducer, initialListState, filterOf, project, type ListState, type ListAction } from "./list-state.js";

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
    queryKey: ["zuzuu", "list", module, state.text, state.kind],
    queryFn: () => dataProvider.getList(module, filterOf(state)),
  });
  const view = project(q.data?.items ?? [], state);
  const value: ListContextValue = {
    module, state, dispatch,
    rows: view.rows, total: view.total, pages: view.pages,
    staged: q.data?.staged ?? [], loading: q.isLoading,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useList(): ListContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useList must be used inside <NotesListProvider>");
  return v;
}
