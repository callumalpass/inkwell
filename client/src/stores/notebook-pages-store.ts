import { create } from "zustand";
import * as pagesApi from "../api/pages";
import * as notebooksApi from "../api/notebooks";
import type { NotebookBookmark, NotebookSettings } from "../api/notebooks";
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
  notebookTitle: string | null;
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
  addPageToRight: () => Promise<pagesApi.PageMeta>;
  duplicatePage: (pageId: string) => Promise<pagesApi.PageMeta>;
  updatePagePosition: (pageId: string, canvasX: number, canvasY: number) => Promise<void>;
  updatePageLinks: (pageId: string, links: string[]) => Promise<void>;
  updatePageInlineLinks: (pageId: string, inlineLinks: pagesApi.InlineLink[]) => Promise<void>;
  updatePageTags: (pageId: string, tags: string[]) => Promise<void>;
  addBookmark: (
    pageId: string,
    options?: { label?: string; parentId?: string | null },
  ) => Promise<NotebookBookmark>;
  removeBookmark: (bookmarkId: string) => Promise<void>;
  updateBookmark: (
    bookmarkId: string,
    updates: { label?: string; parentId?: string | null; order?: number },
  ) => Promise<void>;
  toggleBookmark: (pageId: string) => Promise<void>;
  reorderPages: (orderedIds: string[]) => Promise<void>;
  removePages: (pageIds: string[]) => Promise<void>;
  movePages: (pageIds: string[], targetNotebookId: string) => Promise<void>;
  updateSettings: (settings: NotebookSettings) => Promise<void>;
}

export const useNotebookPagesStore = create<NotebookPagesStore>((set, get) => ({
  notebookId: null,
  notebookTitle: null,
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
        notebookTitle: notebook.title,
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

  addPageToRight: async () => {
    const { notebookId, pages, currentPageIndex } = get();
    if (!notebookId) throw new Error("No notebook loaded");

    const currentPage = pages[currentPageIndex];
    if (!currentPage) {
      const page = await pagesApi.createPage(notebookId);
      set({ pages: [...pages, page] });
      return page;
    }

    // Keep in sync with server-side auto-position dimensions.
    const PAGE_RENDER_WIDTH = 400;
    const CANVAS_GAP = 60;
    const rowPages = pages.filter((page) => page.canvasY === currentPage.canvasY);
    const rightMostX = rowPages.length
      ? Math.max(...rowPages.map((page) => page.canvasX))
      : currentPage.canvasX;

    const createdPage = await pagesApi.createPage(notebookId);
    const positionedPage = await pagesApi.updatePage(createdPage.id, {
      canvasX: rightMostX + PAGE_RENDER_WIDTH + CANVAS_GAP,
      canvasY: currentPage.canvasY,
    });

    const currentLinks = currentPage.links ?? [];
    const updatedCurrentPage = await pagesApi.updatePage(currentPage.id, {
      links: [...currentLinks, positionedPage.id],
    });

    set((state) => ({
      pages: [...state.pages, positionedPage].map((page) => {
        if (page.id === positionedPage.id) return positionedPage;
        if (page.id === updatedCurrentPage.id) return updatedCurrentPage;
        return page;
      }),
    }));

    return positionedPage;
  },

  duplicatePage: async (pageId: string) => {
    const { pages } = get();
    const page = await pagesApi.duplicatePage(pageId);
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

  updatePageInlineLinks: async (pageId, inlineLinks) => {
    const updated = await pagesApi.updatePage(pageId, { inlineLinks });
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

  addBookmark: async (pageId, options) => {
    const { notebookId, settings } = get();
    if (!notebookId) throw new Error("No notebook loaded");

    const current = settings.bookmarks ?? [];
    const existing = current.find((b) => b.pageId === pageId);
    if (existing) return existing;

    const parentId = normalizeParentId(current, options?.parentId ?? null);
    const maxOrder = current.length > 0 ? Math.max(...current.map((b) => b.order)) : -1;
    const bookmark: NotebookBookmark = {
      id: createBookmarkId(),
      pageId,
      label: normalizeBookmarkLabel(options?.label),
      parentId,
      createdAt: new Date().toISOString(),
      order: maxOrder + 1,
    };
    const nextBookmarks = [...current, bookmark];
    const mergedSettings = { ...settings, bookmarks: nextBookmarks };

    await notebooksApi.updateNotebook(notebookId, { settings: mergedSettings });
    set({ settings: mergedSettings });
    return bookmark;
  },

  removeBookmark: async (bookmarkId) => {
    const { notebookId, settings } = get();
    if (!notebookId) throw new Error("No notebook loaded");

    const current = settings.bookmarks ?? [];
    const removed = current.find((b) => b.id === bookmarkId);
    if (!removed) return;

    const nextBookmarks = current
      .filter((b) => b.id !== bookmarkId)
      .map((b) =>
        b.parentId === bookmarkId
          ? { ...b, parentId: null }
          : b,
      );
    const mergedSettings = { ...settings, bookmarks: nextBookmarks };

    await notebooksApi.updateNotebook(notebookId, { settings: mergedSettings });
    set({ settings: mergedSettings });
  },

  updateBookmark: async (bookmarkId, updates) => {
    const { notebookId, settings } = get();
    if (!notebookId) throw new Error("No notebook loaded");

    const current = settings.bookmarks ?? [];
    const idx = current.findIndex((b) => b.id === bookmarkId);
    if (idx < 0) return;

    const existing = current[idx];
    const parentId =
      updates.parentId !== undefined
        ? normalizeParentId(current, updates.parentId, bookmarkId)
        : existing.parentId ?? null;

    const order =
      typeof updates.order === "number" && Number.isFinite(updates.order)
        ? updates.order
        : existing.order;

    const updatedBookmark: NotebookBookmark = {
      ...existing,
      label:
        updates.label !== undefined
          ? normalizeBookmarkLabel(updates.label)
          : existing.label,
      parentId,
      order,
    };

    const nextBookmarks = current.map((b) =>
      b.id === bookmarkId ? updatedBookmark : b,
    );
    const mergedSettings = { ...settings, bookmarks: nextBookmarks };

    await notebooksApi.updateNotebook(notebookId, { settings: mergedSettings });
    set({ settings: mergedSettings });
  },

  toggleBookmark: async (pageId) => {
    const { notebookId, settings } = get();
    if (!notebookId) throw new Error("No notebook loaded");

    const current = settings.bookmarks ?? [];
    const existing = current.find((b) => b.pageId === pageId);
    const nextBookmarks = existing
      ? current
          .filter((b) => b.id !== existing.id)
          .map((b) => (b.parentId === existing.id ? { ...b, parentId: null } : b))
      : [
          ...current,
          {
            id: createBookmarkId(),
            pageId,
            label: undefined,
            parentId: null,
            createdAt: new Date().toISOString(),
            order: current.length > 0 ? Math.max(...current.map((b) => b.order)) + 1 : 0,
          },
        ];

    const mergedSettings = { ...settings, bookmarks: nextBookmarks };
    await notebooksApi.updateNotebook(notebookId, { settings: mergedSettings });
    set({ settings: mergedSettings });
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

function createBookmarkId(): string {
  return `bm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeBookmarkLabel(label: string | undefined): string | undefined {
  const trimmed = (label ?? "").trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeParentId(
  bookmarks: NotebookBookmark[],
  parentId: string | null | undefined,
  targetId?: string,
): string | null {
  if (!parentId) return null;
  const exists = bookmarks.some((b) => b.id === parentId);
  if (!exists) return null;
  if (!targetId) return parentId;
  if (targetId === parentId) return null;
  if (createsBookmarkCycle(bookmarks, targetId, parentId)) return null;
  return parentId;
}

function createsBookmarkCycle(
  bookmarks: NotebookBookmark[],
  targetId: string,
  parentId: string,
): boolean {
  let cursor: string | null = parentId;
  const byId = new Map(bookmarks.map((b) => [b.id, b] as const));
  while (cursor) {
    if (cursor === targetId) return true;
    cursor = byId.get(cursor)?.parentId ?? null;
  }
  return false;
}
