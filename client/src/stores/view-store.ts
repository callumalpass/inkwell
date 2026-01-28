import { create } from "zustand";

export type ViewMode = "single" | "canvas" | "overview";

export interface ViewTransform {
  x: number;
  y: number;
  scale: number;
}

const DEFAULT_TRANSFORM: ViewTransform = { x: 0, y: 0, scale: 1 };

interface ViewStore {
  viewMode: ViewMode;
  canvasTransform: ViewTransform;
  singlePageTransform: ViewTransform;
  isZoomLocked: boolean;

  setViewMode: (mode: ViewMode) => void;
  setCanvasTransform: (transform: ViewTransform) => void;
  setSinglePageTransform: (transform: ViewTransform) => void;
  setZoomLocked: (locked: boolean) => void;
  toggleZoomLocked: () => void;
}

export const useViewStore = create<ViewStore>((set) => ({
  viewMode: "single",
  canvasTransform: { ...DEFAULT_TRANSFORM },
  singlePageTransform: { ...DEFAULT_TRANSFORM },
  isZoomLocked: false,

  setViewMode: (mode) => set({ viewMode: mode }),
  setCanvasTransform: (transform) => set({ canvasTransform: transform }),
  setSinglePageTransform: (transform) => set({ singlePageTransform: transform }),
  setZoomLocked: (locked) => set({ isZoomLocked: locked }),
  toggleZoomLocked: () => set((state) => ({ isZoomLocked: !state.isZoomLocked })),
}));
