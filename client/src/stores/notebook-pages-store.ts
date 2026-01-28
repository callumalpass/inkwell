import { create } from "zustand";
import * as pagesApi from "../api/pages";
import * as notebooksApi from "../api/notebooks";
import type { NotebookSettings } from "../api/notebooks";
import { useSettingsStore } from "./settings-store";
import { useDrawingStore } from "./drawing-store";
import { useViewStore } from "./view-store";
import { DEFAULT_STROKE_COLOR, DEFAULT_STROKE_WIDTH } from "../lib/constants";

interface NotebookPagesStore {
  notebookId: string | null;
  pages: pagesApi.PageMeta[];
  currentPageIndex: number;
  loading: boolean;
  error: string | null;
  settings: NotebookSettings;

  loadNotebookPages: (notebookId: string) => Promise<void>;
  setCurrentPageIndex: (index: number) => void;
  goToNextPage: () => void;
  goToPrevPage: () => void;
  addNewPage: () => Promise<pagesApi.PageMeta>;
  updatePagePosition: (pageId: string, canvasX: number, canvasY: number) => Promise<void>;
  updateSettings: (settings: NotebookSettings) => Promise<void>;
}

export const useNotebookPagesStore = create<NotebookPagesStore>((set, get) => ({
  notebookId: null,
  pages: [],
  currentPageIndex: 0,
  loading: false,
  error: null,
  settings: {},

  loadNotebookPages: async (notebookId: string) => {
    set({ loading: true, error: null, notebookId });
    try {
      const [pages, notebook] = await Promise.all([
        pagesApi.listPages(notebookId),
        notebooksApi.getNotebook(notebookId),
      ]);
      const notebookSettings = notebook.settings ?? {};
      set({
        pages,
        loading: false,
        currentPageIndex: 0,
        settings: notebookSettings,
      });

      // Merge: per-notebook > global app settings > hardcoded defaults
      const global = useSettingsStore.getState().settings;

      const effectiveColor =
        notebookSettings.defaultColor ?? global.defaultColor ?? DEFAULT_STROKE_COLOR;
      const effectiveWidth =
        notebookSettings.defaultStrokeWidth ?? global.defaultStrokeWidth ?? DEFAULT_STROKE_WIDTH;
      const effectivePenStyle = global.defaultPenStyle ?? "pressure";
      const effectiveViewMode = global.defaultViewMode ?? "single";
      const effectiveGridType = notebookSettings.gridType ?? global.defaultGridType;

      const drawing = useDrawingStore.getState();
      drawing.setColor(effectiveColor);
      drawing.setWidth(effectiveWidth);
      drawing.setPenStyle(effectivePenStyle);
      drawing.setTool("pen");

      useViewStore.getState().setViewMode(effectiveViewMode);

      // Apply effective grid type back into notebook-level settings display
      if (effectiveGridType && !notebookSettings.gridType) {
        set((s) => ({
          settings: { ...s.settings, gridType: effectiveGridType },
        }));
      }
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  setCurrentPageIndex: (index) => {
    const { pages } = get();
    if (index >= 0 && index < pages.length) {
      set({ currentPageIndex: index });
    }
  },

  goToNextPage: () => {
    const { currentPageIndex, pages } = get();
    if (currentPageIndex < pages.length - 1) {
      set({ currentPageIndex: currentPageIndex + 1 });
    }
  },

  goToPrevPage: () => {
    const { currentPageIndex } = get();
    if (currentPageIndex > 0) {
      set({ currentPageIndex: currentPageIndex - 1 });
    }
  },

  addNewPage: async () => {
    const { notebookId, pages } = get();
    if (!notebookId) throw new Error("No notebook loaded");
    const page = await pagesApi.createPage(notebookId);
    set({ pages: [...pages, page] });
    return page;
  },

  updatePagePosition: async (pageId, canvasX, canvasY) => {
    const updated = await pagesApi.updatePage(pageId, { canvasX, canvasY });
    const { pages } = get();
    set({
      pages: pages.map((p) => (p.id === pageId ? updated : p)),
    });
  },

  updateSettings: async (newSettings) => {
    const { notebookId, settings } = get();
    if (!notebookId) throw new Error("No notebook loaded");
    const merged = { ...settings, ...newSettings };
    await notebooksApi.updateNotebook(notebookId, { settings: merged });
    set({ settings: merged });
  },
}));
