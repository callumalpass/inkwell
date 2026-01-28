import { create } from "zustand";
import * as pagesApi from "../api/pages";
import * as notebooksApi from "../api/notebooks";
import type { NotebookSettings } from "../api/notebooks";
import { useSettingsStore } from "./settings-store";
import { useDrawingStore } from "./drawing-store";
import { useViewStore, type ViewMode } from "./view-store";
import {
  DEFAULT_STROKE_COLOR,
  DEFAULT_STROKE_WIDTH,
  DEFAULT_LINE_SPACING,
} from "../lib/constants";

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
  updatePageLinks: (pageId: string, links: string[]) => Promise<void>;
  updatePageTags: (pageId: string, tags: string[]) => Promise<void>;
  reorderPages: (orderedIds: string[]) => Promise<void>;
  removePages: (pageIds: string[]) => Promise<void>;
  movePages: (pageIds: string[], targetNotebookId: string) => Promise<void>;
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
      const effectiveViewMode = normalizeViewMode(global.defaultViewMode);
      const effectiveGridType = notebookSettings.gridType ?? global.defaultGridType;
      const effectiveLineSpacing =
        notebookSettings.backgroundLineSpacing ??
        global.defaultBackgroundLineSpacing ??
        DEFAULT_LINE_SPACING;

      const drawing = useDrawingStore.getState();
      drawing.setColor(effectiveColor);
      drawing.setWidth(effectiveWidth);
      drawing.setPenStyle(effectivePenStyle);
      drawing.setTool("pen");

      useViewStore.getState().setViewMode(effectiveViewMode);

      // Apply effective background settings back into notebook-level settings display
      if (
        (effectiveGridType && !notebookSettings.gridType) ||
        (!notebookSettings.backgroundLineSpacing &&
          effectiveLineSpacing !== DEFAULT_LINE_SPACING)
      ) {
        set((s) => ({
          settings: {
            ...s.settings,
            ...(effectiveGridType && !notebookSettings.gridType
              ? { gridType: effectiveGridType }
              : {}),
            ...(!notebookSettings.backgroundLineSpacing &&
            effectiveLineSpacing !== DEFAULT_LINE_SPACING
              ? { backgroundLineSpacing: effectiveLineSpacing }
              : {}),
          },
        }));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load notebook";
      set({ error: message, loading: false });
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

  updatePageLinks: async (pageId, links) => {
    const updated = await pagesApi.updatePage(pageId, { links });
    const { pages } = get();
    set({
      pages: pages.map((p) => (p.id === pageId ? updated : p)),
    });
  },

  updatePageTags: async (pageId, tags) => {
    const updated = await pagesApi.updatePage(pageId, { tags });
    const { pages } = get();
    set({
      pages: pages.map((p) => (p.id === pageId ? updated : p)),
    });
  },

  reorderPages: async (orderedIds) => {
    const { pages, currentPageIndex } = get();
    if (orderedIds.length === 0) return;
    const pageMap = new Map(pages.map((p) => [p.id, p] as const));
    const orderedPages = orderedIds
      .map((id) => pageMap.get(id))
      .filter((p): p is pagesApi.PageMeta => !!p);
    const missing = pages.filter((p) => !orderedIds.includes(p.id));
    const nextPages = [...orderedPages, ...missing].map((p, idx) => ({
      ...p,
      pageNumber: idx + 1,
    }));

    const currentId = pages[currentPageIndex]?.id;
    const nextIndex = currentId
      ? nextPages.findIndex((p) => p.id === currentId)
      : 0;
    set({
      pages: nextPages,
      currentPageIndex: nextIndex >= 0 ? nextIndex : 0,
    });

    const updates = nextPages.filter((p) => p.pageNumber !== pageMap.get(p.id)?.pageNumber);
    if (updates.length === 0) return;
    await Promise.all(
      updates.map((p) => pagesApi.updatePage(p.id, { pageNumber: p.pageNumber })),
    );
  },

  removePages: async (pageIds) => {
    if (pageIds.length === 0) return;
    const { pages, currentPageIndex } = get();
    await Promise.all(pageIds.map((id) => pagesApi.deletePage(id)));
    const remaining = pages.filter((p) => !pageIds.includes(p.id));
    const currentId = pages[currentPageIndex]?.id;
    const nextIndex = currentId
      ? remaining.findIndex((p) => p.id === currentId)
      : 0;
    set({
      pages: remaining,
      currentPageIndex: nextIndex >= 0 ? nextIndex : 0,
    });
  },

  movePages: async (pageIds, targetNotebookId) => {
    if (pageIds.length === 0) return;
    await pagesApi.movePages(pageIds, targetNotebookId);
    const { pages, currentPageIndex } = get();
    const remaining = pages.filter((p) => !pageIds.includes(p.id));
    const currentId = pages[currentPageIndex]?.id;
    const nextIndex = currentId
      ? remaining.findIndex((p) => p.id === currentId)
      : 0;
    set({
      pages: remaining,
      currentPageIndex: nextIndex >= 0 ? nextIndex : 0,
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

function normalizeViewMode(mode?: string): ViewMode {
  if (mode === "canvas" || mode === "overview" || mode === "single") return mode;
  if (mode === "scroll") return "overview";
  return "single";
}
