import { create } from "zustand";
import type { Stroke } from "../api/strokes";
import * as strokesApi from "../api/strokes";
import * as pagesApi from "../api/pages";

interface PageStore {
  page: pagesApi.PageMeta | null;
  savedStrokes: Stroke[];
  loading: boolean;
  error: string | null;
  loadPage: (pageId: string) => Promise<void>;
  addSavedStrokes: (strokes: Stroke[]) => void;
  removeSavedStroke: (strokeId: string) => void;
  clearSavedStrokes: () => void;
  setSavedStrokes: (strokes: Stroke[]) => void;
}

export const usePageStore = create<PageStore>((set) => ({
  page: null,
  savedStrokes: [],
  loading: false,
  error: null,

  loadPage: async (pageId: string) => {
    set({ loading: true, error: null });
    try {
      const [page, strokes] = await Promise.all([
        pagesApi.getPage(pageId),
        strokesApi.getStrokes(pageId),
      ]);
      set({ page, savedStrokes: strokes, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  addSavedStrokes: (strokes) =>
    set((state) => ({ savedStrokes: [...state.savedStrokes, ...strokes] })),

  removeSavedStroke: (strokeId) =>
    set((state) => ({
      savedStrokes: state.savedStrokes.filter((s) => s.id !== strokeId),
    })),

  clearSavedStrokes: () => set({ savedStrokes: [] }),

  setSavedStrokes: (strokes) => set({ savedStrokes: strokes }),
}));
