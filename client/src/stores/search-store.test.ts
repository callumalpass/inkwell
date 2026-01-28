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
    loading: false,
    error: null,
    searched: false,
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
  },
  {
    pageId: "pg_2",
    notebookId: "nb_1",
    notebookName: "Notebook One",
    excerpt: "...another match...",
    modified: "2025-01-28T09:00:00Z",
    thumbnailUrl: "/api/pages/pg_2/thumbnail",
    matchType: "transcription",
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

      resolve({ results: [], total: 0 });
      await promise;
      expect(useSearchStore.getState().loading).toBe(false);
    });

    it("stores results on success", async () => {
      vi.mocked(searchApi.searchTranscriptions).mockResolvedValue({
        results: MOCK_RESULTS,
        total: 2,
      });

      await useSearchStore.getState().search("matching");

      const state = useSearchStore.getState();
      expect(state.results).toEqual(MOCK_RESULTS);
      expect(state.total).toBe(2);
      expect(state.searched).toBe(true);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it("passes notebook filter to API", async () => {
      vi.mocked(searchApi.searchTranscriptions).mockResolvedValue({
        results: [],
        total: 0,
      });

      await useSearchStore.getState().search("test", { notebook: "nb_1" });

      expect(searchApi.searchTranscriptions).toHaveBeenCalledWith("test", {
        notebook: "nb_1",
      });
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
      });
      await useSearchStore.getState().search("test");

      await useSearchStore.getState().search("   ");

      expect(useSearchStore.getState().results).toEqual([]);
      expect(useSearchStore.getState().searched).toBe(false);
    });
  });

  describe("clear", () => {
    it("resets all state to initial values", async () => {
      vi.mocked(searchApi.searchTranscriptions).mockResolvedValue({
        results: MOCK_RESULTS,
        total: 2,
      });
      await useSearchStore.getState().search("test");

      useSearchStore.getState().clear();

      const state = useSearchStore.getState();
      expect(state.query).toBe("");
      expect(state.results).toEqual([]);
      expect(state.total).toBe(0);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.searched).toBe(false);
    });
  });
});
