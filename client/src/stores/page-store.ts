import { create } from "zustand";
import type { Stroke } from "../api/strokes";
import * as strokesApi from "../api/strokes";

interface PageStore {
  strokesByPage: Record<string, Stroke[]>;
  loadingPages: Set<string>;

  loadPageStrokes: (pageId: string) => Promise<void>;
  addSavedStrokes: (pageId: string, strokes: Stroke[]) => void;
  removeSavedStroke: (pageId: string, strokeId: string) => void;
  clearSavedStrokes: (pageId: string) => void;
  unloadPageStrokes: (pageId: string) => void;
}

export const usePageStore = create<PageStore>((set, get) => ({
  strokesByPage: {},
  loadingPages: new Set(),

  loadPageStrokes: async (pageId: string) => {
    const { loadingPages, strokesByPage } = get();
    if (loadingPages.has(pageId) || strokesByPage[pageId]) return;

    set({ loadingPages: new Set([...loadingPages, pageId]) });
    try {
      const strokes = await strokesApi.getStrokes(pageId);
      const updated = new Set(get().loadingPages);
      updated.delete(pageId);
      set({
        strokesByPage: { ...get().strokesByPage, [pageId]: strokes },
        loadingPages: updated,
      });
    } catch (err) {
      console.error(`Failed to load strokes for page ${pageId}:`, err);
      const updated = new Set(get().loadingPages);
      updated.delete(pageId);
      set({ loadingPages: updated });
    }
  },

  addSavedStrokes: (pageId, strokes) =>
    set((state) => ({
      strokesByPage: {
        ...state.strokesByPage,
        [pageId]: [...(state.strokesByPage[pageId] ?? []), ...strokes],
      },
    })),

  removeSavedStroke: (pageId, strokeId) =>
    set((state) => ({
      strokesByPage: {
        ...state.strokesByPage,
        [pageId]: (state.strokesByPage[pageId] ?? []).filter(
          (s) => s.id !== strokeId,
        ),
      },
    })),

  clearSavedStrokes: (pageId) =>
    set((state) => ({
      strokesByPage: {
        ...state.strokesByPage,
        [pageId]: [],
      },
    })),

  unloadPageStrokes: (pageId) =>
    set((state) => {
      const { [pageId]: _, ...rest } = state.strokesByPage;
      return { strokesByPage: rest };
    }),
}));
