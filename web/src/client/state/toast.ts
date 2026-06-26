// state/toast.ts — the workbench's calm notification surface. Failures that were
// previously swallowed (switch, init/enable, session-create) push a brief,
// auto-dismissing toast instead of vanishing silently. Notion-calm: short, color
// only for errors. The queue logic is pure (tested); the store wraps it + auto-dismiss.
import { create } from "zustand";

export type ToastTone = "default" | "error";
export interface ToastItem { id: string; message: string; tone: ToastTone }

const MAX = 4;
const TTL_MS = 5000;

/** Append a toast, keeping at most `max` (newest win). Pure. */
export function appendCapped(list: ToastItem[], item: ToastItem, max = MAX): ToastItem[] {
  return [...list, item].slice(-max);
}
/** Drop a toast by id. Pure. */
export function removeById(list: ToastItem[], id: string): ToastItem[] {
  return list.filter((t) => t.id !== id);
}

let seq = 0;

interface ToastState {
  toasts: ToastItem[];
  push: (message: string, tone?: ToastTone) => void;
  dismiss: (id: string) => void;
}

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: (message, tone = "default") => {
    const id = `t${++seq}`;
    set((s) => ({ toasts: appendCapped(s.toasts, { id, message, tone }) }));
    setTimeout(() => set((s) => ({ toasts: removeById(s.toasts, id) })), TTL_MS);
  },
  dismiss: (id) => set((s) => ({ toasts: removeById(s.toasts, id) })),
}));

/** Push from non-React code (the zustand store's async catches). */
export const toast = (message: string, tone: ToastTone = "default"): void => useToasts.getState().push(message, tone);
