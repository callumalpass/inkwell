import { create } from "zustand";

interface UIStore {
  pageJumpOpen: boolean;
  setPageJumpOpen: (open: boolean) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  pageJumpOpen: false,
  setPageJumpOpen: (open) => set({ pageJumpOpen: open }),
}));
