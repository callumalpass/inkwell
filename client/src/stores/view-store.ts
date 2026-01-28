import { create } from "zustand";

export type ViewMode = "single" | "scroll" | "canvas";

interface CanvasTransform {
  x: number;
  y: number;
  scale: number;
}

interface ViewStore {
  viewMode: ViewMode;
  canvasTransform: CanvasTransform;

  setViewMode: (mode: ViewMode) => void;
  setCanvasTransform: (transform: CanvasTransform) => void;
}

export const useViewStore = create<ViewStore>((set) => ({
  viewMode: "single",
  canvasTransform: { x: 0, y: 0, scale: 1 },

  setViewMode: (mode) => set({ viewMode: mode }),
  setCanvasTransform: (transform) => set({ canvasTransform: transform }),
}));
