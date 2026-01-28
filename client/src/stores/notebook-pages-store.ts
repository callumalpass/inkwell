import { create } from "zustand";
import * as pagesApi from "../api/pages";

interface NotebookPagesStore {
  notebookId: string | null;
  pages: pagesApi.PageMeta[];
  currentPageIndex: number;
  loading: boolean;
  error: string | null;

  loadNotebookPages: (notebookId: string) => Promise<void>;
  setCurrentPageIndex: (index: number) => void;
  goToNextPage: () => void;
  goToPrevPage: () => void;
  addNewPage: () => Promise<pagesApi.PageMeta>;
  updatePagePosition: (pageId: string, canvasX: number, canvasY: number) => Promise<void>;
}

export const useNotebookPagesStore = create<NotebookPagesStore>((set, get) => ({
  notebookId: null,
  pages: [],
  currentPageIndex: 0,
  loading: false,
  error: null,

  loadNotebookPages: async (notebookId: string) => {
    set({ loading: true, error: null, notebookId });
    try {
      const pages = await pagesApi.listPages(notebookId);
      set({ pages, loading: false, currentPageIndex: 0 });
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
}));
