import { useSearchStore } from "./search-store";
import * as searchApi from "../api/search";

vi.mock("../api/search", () => ({
  searchTranscriptions: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  useSearchStore.setState({
    query: "",
    results: [],
    total: 0,
    hasMore: false,
    loading: false,
    loadingMore: false,
    error: null,
    searched: false,
    matchTypeFilter: [],
  });
});

const MOCK_RESULTS: searchApi.SearchResult[] = [
  {
    pageId: "pg_1",
    notebookId: "nb_1",
    notebookName: "Notebook One",
    excerpt: "...some matching text...",
    modified: "2025-01-28T10:00:00Z",
    thumbnailUrl: "/api/pages/pg_1/thumbnail",
    matchType: "transcription",
    score: 150,
  },
  {
    pageId: "pg_2",
    notebookId: "nb_1",
    notebookName: "Notebook One",
    excerpt: "...another match...",
    modified: "2025-01-28T09:00:00Z",
    thumbnailUrl: "/api/pages/pg_2/thumbnail",
    matchType: "transcription",
    score: 120,
  },
];

describe("search store", () => {
  describe("setQuery", () => {
    it("updates query string", () => {
      useSearchStore.getState().setQuery("hello");
      expect(useSearchStore.getState().query).toBe("hello");
    });
  });

  describe("search", () => {
    it("sets loading to true while searching", async () => {
      let resolve!: (value: searchApi.SearchResponse) => void;
      vi.mocked(searchApi.searchTranscriptions).mockReturnValue(
        new Promise((r) => {
          resolve = r;
        }),
      );

      const promise = useSearchStore.getState().search("test");
      expect(useSearchStore.getState().loading).toBe(true);
      expect(useSearchStore.getState().query).toBe("test");

      resolve({ results: [], total: 0, hasMore: false });
      await promise;
      expect(useSearchStore.getState().loading).toBe(false);
    });

    it("stores results on success", async () => {
      vi.mocked(searchApi.searchTranscriptions).mockResolvedValue({
        results: MOCK_RESULTS,
        total: 2,
        hasMore: false,
      });

      await useSearchStore.getState().search("matching");

      const state = useSearchStore.getState();
      expect(state.results).toEqual(MOCK_RESULTS);
      expect(state.total).toBe(2);
      expect(state.hasMore).toBe(false);
      expect(state.searched).toBe(true);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it("passes notebook filter to API", async () => {
      vi.mocked(searchApi.searchTranscriptions).mockResolvedValue({
        results: [],
        total: 0,
        hasMore: false,
      });

      await useSearchStore.getState().search("test", { notebook: "nb_1" });

      expect(searchApi.searchTranscriptions).toHaveBeenCalledWith("test", expect.objectContaining({
        notebook: "nb_1",
      }));
    });

    it("sets error on failure", async () => {
      vi.mocked(searchApi.searchTranscriptions).mockRejectedValue(
        new Error("Network error"),
      );

      await useSearchStore.getState().search("test");

      const state = useSearchStore.getState();
      expect(state.error).toBe("Network error");
      expect(state.loading).toBe(false);
      expect(state.searched).toBe(true);
    });

    it("clears results for empty query", async () => {
      // First do a successful search
      vi.mocked(searchApi.searchTranscriptions).mockResolvedValue({
        results: MOCK_RESULTS,
        total: 2,
        hasMore: false,
      });
      await useSearchStore.getState().search("test");
      expect(useSearchStore.getState().results).toHaveLength(2);

      // Now search with empty string
      await useSearchStore.getState().search("");

      const state = useSearchStore.getState();
      expect(state.results).toEqual([]);
      expect(state.total).toBe(0);
      expect(state.searched).toBe(false);
      expect(searchApi.searchTranscriptions).toHaveBeenCalledTimes(1); // Not called again
    });

    it("clears results for whitespace-only query", async () => {
      vi.mocked(searchApi.searchTranscriptions).mockResolvedValue({
        results: MOCK_RESULTS,
        total: 2,
        hasMore: false,
      });
      await useSearchStore.getState().search("test");

      await useSearchStore.getState().search("   ");

      expect(useSearchStore.getState().results).toEqual([]);
      expect(useSearchStore.getState().searched).toBe(false);
    });

    it("tracks hasMore for pagination", async () => {
      vi.mocked(searchApi.searchTranscriptions).mockResolvedValue({
        results: MOCK_RESULTS,
        total: 50,
        hasMore: true,
      });

      await useSearchStore.getState().search("test");

      expect(useSearchStore.getState().hasMore).toBe(true);
    });

    it("includes matchTypeFilter in search call", async () => {
      vi.mocked(searchApi.searchTranscriptions).mockResolvedValue({
        results: [],
        total: 0,
        hasMore: false,
      });

      useSearchStore.getState().setMatchTypeFilter(["transcription", "tag"]);
      await useSearchStore.getState().search("test");

      expect(searchApi.searchTranscriptions).toHaveBeenCalledWith("test", expect.objectContaining({
        matchType: ["transcription", "tag"],
      }));
    });
  });

  describe("loadMore", () => {
    it("appends results when loading more", async () => {
      vi.mocked(searchApi.searchTranscriptions)
        .mockResolvedValueOnce({
          results: [MOCK_RESULTS[0]],
          total: 2,
          hasMore: true,
        })
        .mockResolvedValueOnce({
          results: [MOCK_RESULTS[1]],
          total: 2,
          hasMore: false,
        });

      await useSearchStore.getState().search("test");
      expect(useSearchStore.getState().results).toHaveLength(1);

      await useSearchStore.getState().loadMore();
      expect(useSearchStore.getState().results).toHaveLength(2);
      expect(useSearchStore.getState().hasMore).toBe(false);
    });

    it("does not load if hasMore is false", async () => {
      vi.mocked(searchApi.searchTranscriptions).mockResolvedValue({
        results: MOCK_RESULTS,
        total: 2,
        hasMore: false,
      });

      await useSearchStore.getState().search("test");
      vi.clearAllMocks();

      await useSearchStore.getState().loadMore();
      expect(searchApi.searchTranscriptions).not.toHaveBeenCalled();
    });

    it("does not load if already loading more", async () => {
      let resolve!: (value: searchApi.SearchResponse) => void;
      vi.mocked(searchApi.searchTranscriptions)
        .mockResolvedValueOnce({
          results: [MOCK_RESULTS[0]],
          total: 2,
          hasMore: true,
        })
        .mockReturnValueOnce(
          new Promise((r) => {
            resolve = r;
          }),
        );

      await useSearchStore.getState().search("test");

      // Start loading more
      const promise = useSearchStore.getState().loadMore();
      expect(useSearchStore.getState().loadingMore).toBe(true);

      // Try to load more again - should be ignored
      await useSearchStore.getState().loadMore();
      expect(searchApi.searchTranscriptions).toHaveBeenCalledTimes(2); // Only 2, not 3

      resolve({ results: [MOCK_RESULTS[1]], total: 2, hasMore: false });
      await promise;
    });
  });

  describe("setMatchTypeFilter", () => {
    it("updates matchTypeFilter", () => {
      useSearchStore.getState().setMatchTypeFilter(["tag"]);
      expect(useSearchStore.getState().matchTypeFilter).toEqual(["tag"]);
    });

    it("re-runs search when filter changes (if already searched)", async () => {
      vi.mocked(searchApi.searchTranscriptions).mockResolvedValue({
        results: MOCK_RESULTS,
        total: 2,
        hasMore: false,
      });

      await useSearchStore.getState().search("test");
      vi.clearAllMocks();

      useSearchStore.getState().setMatchTypeFilter(["transcription"]);

      // Should have triggered a new search
      expect(searchApi.searchTranscriptions).toHaveBeenCalledWith("test", expect.objectContaining({
        matchType: ["transcription"],
      }));
    });
  });

  describe("clear", () => {
    it("resets all state to initial values except matchTypeFilter", async () => {
      vi.mocked(searchApi.searchTranscriptions).mockResolvedValue({
        results: MOCK_RESULTS,
        total: 2,
        hasMore: false,
      });
      await useSearchStore.getState().search("test");
      useSearchStore.getState().setMatchTypeFilter(["tag"]);

      useSearchStore.getState().clear();

      const state = useSearchStore.getState();
      expect(state.query).toBe("");
      expect(state.results).toEqual([]);
      expect(state.total).toBe(0);
      expect(state.hasMore).toBe(false);
      expect(state.loading).toBe(false);
      expect(state.loadingMore).toBe(false);
      expect(state.error).toBeNull();
      expect(state.searched).toBe(false);
      // matchTypeFilter should be preserved
      expect(state.matchTypeFilter).toEqual(["tag"]);
    });
  });
});
