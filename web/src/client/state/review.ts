// state/review.ts — whether the review overlay (the gate) is open. The gate lives
// OUTSIDE any selection: the ribbon's "press R to review" and the global R key both
// toggle it, independent of what's in the stage.
import { create } from "zustand";

interface ReviewState {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

export const useReview = create<ReviewState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open })),
}));
