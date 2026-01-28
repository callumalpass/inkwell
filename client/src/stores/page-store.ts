import { create } from "zustand";
import type { Stroke } from "../api/strokes";
import * as strokesApi from "../api/strokes";

// ── In-flight save tracking ─────────────────────────────────────────────────
// Ensures loadPageStrokes waits for pending POSTs so the server fetch
// never returns stale data that's missing recently-saved strokes.
const inflightSaves = new Map<string, Promise<void>>();

export function trackSave(pageId: string, promise: Promise<unknown>) {
  const wrapped = promise.then(() => {});
  const existing = inflightSaves.get(pageId);
  const chained = existing ? existing.then(() => wrapped) : wrapped;
  inflightSaves.set(pageId, chained);
  chained.finally(() => {
    if (inflightSaves.get(pageId) === chained) {
      inflightSaves.delete(pageId);
    }
  });
}

function waitForSave(pageId: string): Promise<void> {
  return inflightSaves.get(pageId) ?? Promise.resolve();
}

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

    // Wait for any in-flight saves so the server has the latest data.
    await waitForSave(pageId);

    // Re-check after awaiting — another caller may have loaded the page.
    const current = get();
    if (current.loadingPages.has(pageId) || current.strokesByPage[pageId]) return;

    set({ loadingPages: new Set([...current.loadingPages, pageId]) });
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
    set((state) => {
      const existing = state.strokesByPage[pageId];
      // If the page has been unloaded (undefined), skip — a late WebSocket
      // echo should not create a partial entry that would prevent a full
      // server fetch when the page becomes visible again.
      if (!existing) return state;
      // Deduplicate: skip strokes whose IDs already exist in saved state.
      // This prevents the WebSocket echo (server broadcasts strokes:added
      // back to the client that just posted them) from doubling strokes.
      const existingIds = new Set(existing.map((s) => s.id));
      const novel = strokes.filter((s) => !existingIds.has(s.id));
      if (novel.length === 0) return state;
      return {
        strokesByPage: {
          ...state.strokesByPage,
          [pageId]: [...existing, ...novel],
        },
      };
    }),

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
