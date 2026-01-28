import { create } from "zustand";
import * as notebooksApi from "../api/notebooks";

interface NotebookStore {
  notebooks: notebooksApi.NotebookMeta[];
  loading: boolean;
  error: string | null;
  fetchNotebooks: () => Promise<void>;
  createNotebook: (title: string) => Promise<notebooksApi.NotebookMeta>;
  duplicateNotebook: (id: string) => Promise<notebooksApi.NotebookMeta>;
  deleteNotebook: (id: string) => Promise<void>;
}

export const useNotebookStore = create<NotebookStore>((set, get) => ({
  notebooks: [],
  loading: false,
  error: null,

  fetchNotebooks: async () => {
    set({ loading: true, error: null });
    try {
      const notebooks = await notebooksApi.listNotebooks();
      set({ notebooks, loading: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch notebooks";
      set({ error: message, loading: false });
    }
  },

  createNotebook: async (title: string) => {
    const notebook = await notebooksApi.createNotebook(title);
    set({ notebooks: [notebook, ...get().notebooks] });
    return notebook;
  },

  duplicateNotebook: async (id: string) => {
    const notebook = await notebooksApi.duplicateNotebook(id);
    set({ notebooks: [notebook, ...get().notebooks] });
    return notebook;
  },

  deleteNotebook: async (id: string) => {
    await notebooksApi.deleteNotebook(id);
    set({ notebooks: get().notebooks.filter((n) => n.id !== id) });
  },
}));
