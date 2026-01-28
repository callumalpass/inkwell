import { create } from "zustand";
import * as searchApi from "../api/search";
import type { MatchType, SearchOptions } from "../api/search";

interface SearchStore {
  query: string;
  results: searchApi.SearchResult[];
  total: number;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  searched: boolean;
  matchTypeFilter: MatchType[];

  setQuery: (query: string) => void;
  setMatchTypeFilter: (filter: MatchType[]) => void;
  search: (query: string, options?: SearchOptions) => Promise<void>;
  loadMore: () => Promise<void>;
  clear: () => void;
}

const RESULTS_PER_PAGE = 20;

export const useSearchStore = create<SearchStore>((set, get) => ({
  query: "",
  results: [],
  total: 0,
  hasMore: false,
  loading: false,
  loadingMore: false,
  error: null,
  searched: false,
  matchTypeFilter: [],

  setQuery: (query: string) => set({ query }),

  setMatchTypeFilter: (filter: MatchType[]) => {
    set({ matchTypeFilter: filter });
    // Re-run search with new filter
    const { query, searched } = get();
    if (searched && query.trim()) {
      get().search(query);
    }
  },

  search: async (query: string, options?: SearchOptions) => {
    if (!query.trim()) {
      set({ results: [], total: 0, hasMore: false, searched: false, error: null });
      return;
    }

    const { matchTypeFilter } = get();
    set({ loading: true, error: null, query });
    try {
      const response = await searchApi.searchTranscriptions(query, {
        ...options,
        limit: RESULTS_PER_PAGE,
        offset: 0,
        matchType: matchTypeFilter.length > 0 ? matchTypeFilter : undefined,
      });
      set({
        results: response.results,
        total: response.total,
        hasMore: response.hasMore,
        loading: false,
        searched: true,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Search failed";
      set({ error: message, loading: false, searched: true });
    }
  },

  loadMore: async () => {
    const { query, results, hasMore, loadingMore, matchTypeFilter } = get();
    if (!hasMore || loadingMore || !query.trim()) return;

    set({ loadingMore: true });
    try {
      const response = await searchApi.searchTranscriptions(query, {
        limit: RESULTS_PER_PAGE,
        offset: results.length,
        matchType: matchTypeFilter.length > 0 ? matchTypeFilter : undefined,
      });
      set({
        results: [...results, ...response.results],
        hasMore: response.hasMore,
        loadingMore: false,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load more results";
      set({ error: message, loadingMore: false });
    }
  },

  clear: () =>
    set({
      query: "",
      results: [],
      total: 0,
      hasMore: false,
      loading: false,
      loadingMore: false,
      error: null,
      searched: false,
      // Keep matchTypeFilter - it's a user preference
    }),
}));
