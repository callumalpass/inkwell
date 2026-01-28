import { create } from "zustand";
import * as searchApi from "../api/search";

interface SearchStore {
  query: string;
  results: searchApi.SearchResult[];
  total: number;
  loading: boolean;
  error: string | null;
  searched: boolean;

  setQuery: (query: string) => void;
  search: (query: string, options?: { notebook?: string }) => Promise<void>;
  clear: () => void;
}

export const useSearchStore = create<SearchStore>((set) => ({
  query: "",
  results: [],
  total: 0,
  loading: false,
  error: null,
  searched: false,

  setQuery: (query: string) => set({ query }),

  search: async (query: string, options?: { notebook?: string }) => {
    if (!query.trim()) {
      set({ results: [], total: 0, searched: false, error: null });
      return;
    }

    set({ loading: true, error: null, query });
    try {
      const response = await searchApi.searchTranscriptions(query, options);
      set({
        results: response.results,
        total: response.total,
        loading: false,
        searched: true,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Search failed";
      set({ error: message, loading: false, searched: true });
    }
  },

  clear: () =>
    set({
      query: "",
      results: [],
      total: 0,
      loading: false,
      error: null,
      searched: false,
    }),
}));
