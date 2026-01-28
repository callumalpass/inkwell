import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchView } from "./SearchView";
import { useSearchStore } from "../../stores/search-store";
import * as searchApi from "../../api/search";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("../../api/search", () => ({
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
    notebookName: "Work Notes",
    excerpt: "...meeting about project launch...",
    modified: "2025-01-28T10:00:00Z",
    thumbnailUrl: "/api/pages/pg_1/thumbnail",
    matchType: "transcription",
  },
  {
    pageId: "pg_2",
    notebookId: "nb_2",
    notebookName: "Personal",
    excerpt: "...project timeline review...",
    modified: "2025-01-27T09:00:00Z",
    thumbnailUrl: "/api/pages/pg_2/thumbnail",
    matchType: "transcription",
  },
];

describe("SearchView", () => {
  it("does not render when closed", () => {
    render(<SearchView open={false} onClose={() => {}} />);
    expect(screen.queryByTestId("search-dialog")).not.toBeInTheDocument();
  });

  it("renders when open", () => {
    render(<SearchView open={true} onClose={() => {}} />);
    expect(screen.getByTestId("search-dialog")).toBeInTheDocument();
    expect(screen.getByTestId("search-input")).toBeInTheDocument();
  });

  it("shows initial hint when no search has been done", () => {
    render(<SearchView open={true} onClose={() => {}} />);
    expect(screen.getByTestId("search-hint")).toBeInTheDocument();
  });

  it("shows search results", () => {
    useSearchStore.setState({
      query: "project",
      results: MOCK_RESULTS,
      total: 2,
      searched: true,
      loading: false,
    });

    render(<SearchView open={true} onClose={() => {}} />);

    expect(screen.getByTestId("search-count")).toHaveTextContent("2 results");
    const resultCards = screen.getAllByTestId("search-result");
    expect(resultCards).toHaveLength(2);
  });

  it("shows singular 'result' for single result", () => {
    useSearchStore.setState({
      query: "unique",
      results: [MOCK_RESULTS[0]],
      total: 1,
      searched: true,
      loading: false,
    });

    render(<SearchView open={true} onClose={() => {}} />);
    expect(screen.getByTestId("search-count")).toHaveTextContent("1 result");
  });

  it("shows empty state when no results found", () => {
    useSearchStore.setState({
      query: "nonexistent",
      results: [],
      total: 0,
      searched: true,
      loading: false,
    });

    render(<SearchView open={true} onClose={() => {}} />);
    expect(screen.getByTestId("search-empty")).toBeInTheDocument();
    expect(screen.getByTestId("search-empty")).toHaveTextContent(
      /No results found/,
    );
  });

  it("shows loading state", () => {
    useSearchStore.setState({ loading: true, query: "test" });

    render(<SearchView open={true} onClose={() => {}} />);
    expect(screen.getByTestId("search-loading")).toHaveTextContent(
      "Searching...",
    );
  });

  it("shows error state", () => {
    useSearchStore.setState({
      error: "Network error",
      searched: true,
      loading: false,
    });

    render(<SearchView open={true} onClose={() => {}} />);
    expect(screen.getByTestId("search-error")).toHaveTextContent(
      "Network error",
    );
  });

  it("navigates to page on result click", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    useSearchStore.setState({
      query: "project",
      results: MOCK_RESULTS,
      total: 2,
      searched: true,
      loading: false,
    });

    render(<SearchView open={true} onClose={onClose} />);

    const results = screen.getAllByTestId("search-result");
    await user.click(results[0]);

    expect(mockNavigate).toHaveBeenCalledWith("/notebook/nb_1/page/pg_1");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes on Escape key", async () => {
    const onClose = vi.fn();
    render(<SearchView open={true} onClose={onClose} />);

    // Dispatch a real keyboard event on the document
    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes when clicking overlay background", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<SearchView open={true} onClose={onClose} />);

    // Click the overlay itself (not a child)
    const overlay = screen.getByTestId("search-overlay");
    await user.click(overlay);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not close when clicking inside dialog", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<SearchView open={true} onClose={onClose} />);

    // Click the dialog element
    await user.click(screen.getByTestId("search-dialog"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows clear button when query has text", () => {
    useSearchStore.setState({ query: "test" });

    render(<SearchView open={true} onClose={() => {}} />);
    expect(screen.getByTestId("search-clear")).toBeInTheDocument();
  });

  it("hides clear button when query is empty", () => {
    useSearchStore.setState({ query: "" });

    render(<SearchView open={true} onClose={() => {}} />);
    expect(screen.queryByTestId("search-clear")).not.toBeInTheDocument();
  });

  it("clears input when clear button is clicked", async () => {
    const user = userEvent.setup();

    vi.mocked(searchApi.searchTranscriptions).mockResolvedValue({
      results: [],
      total: 0,
    });

    useSearchStore.setState({
      query: "test",
      results: MOCK_RESULTS,
      total: 2,
      searched: true,
    });

    render(<SearchView open={true} onClose={() => {}} />);

    await user.click(screen.getByTestId("search-clear"));

    expect(screen.getByTestId("search-input")).toHaveValue("");
  });

  it("debounces search on typing", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    vi.mocked(searchApi.searchTranscriptions).mockResolvedValue({
      results: [],
      total: 0,
    });

    render(<SearchView open={true} onClose={() => {}} />);
    const input = screen.getByTestId("search-input");

    // Type a character
    await user.type(input, "h");

    // Should not have been called yet
    expect(searchApi.searchTranscriptions).not.toHaveBeenCalled();

    // Advance timers to trigger debounce
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(searchApi.searchTranscriptions).toHaveBeenCalledTimes(1);
    });

    vi.useRealTimers();
  });
});
