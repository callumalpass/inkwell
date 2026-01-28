import { useNotebookPagesStore } from "./notebook-pages-store";
import type { PageMeta } from "../api/pages";

vi.mock("../api/pages", () => ({
  listPages: vi.fn(),
  createPage: vi.fn(),
  updatePage: vi.fn(),
}));

const makePage = (id: string, pageNumber: number): PageMeta => ({
  id,
  notebookId: "nb_test",
  pageNumber,
  canvasX: 0,
  canvasY: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const threePages = [makePage("p1", 1), makePage("p2", 2), makePage("p3", 3)];

beforeEach(() => {
  useNotebookPagesStore.setState({
    notebookId: null,
    pages: [],
    currentPageIndex: 0,
    loading: false,
    error: null,
  });
});

describe("defaults", () => {
  it("starts with empty pages and loading false", () => {
    const state = useNotebookPagesStore.getState();
    expect(state.pages).toEqual([]);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.notebookId).toBeNull();
    expect(state.currentPageIndex).toBe(0);
  });
});

describe("setCurrentPageIndex", () => {
  it("sets index within valid range", () => {
    useNotebookPagesStore.setState({ pages: threePages });
    useNotebookPagesStore.getState().setCurrentPageIndex(2);
    expect(useNotebookPagesStore.getState().currentPageIndex).toBe(2);
  });

  it("clamps to valid range - ignores negative index", () => {
    useNotebookPagesStore.setState({ pages: threePages });
    useNotebookPagesStore.getState().setCurrentPageIndex(-1);
    expect(useNotebookPagesStore.getState().currentPageIndex).toBe(0);
  });

  it("clamps to valid range - ignores index beyond pages length", () => {
    useNotebookPagesStore.setState({ pages: threePages });
    useNotebookPagesStore.getState().setCurrentPageIndex(5);
    expect(useNotebookPagesStore.getState().currentPageIndex).toBe(0);
  });
});

describe("goToNextPage / goToPrevPage", () => {
  beforeEach(() => {
    useNotebookPagesStore.setState({ pages: threePages, currentPageIndex: 1 });
  });

  it("goToNextPage advances by one", () => {
    useNotebookPagesStore.getState().goToNextPage();
    expect(useNotebookPagesStore.getState().currentPageIndex).toBe(2);
  });

  it("goToNextPage stops at last page", () => {
    useNotebookPagesStore.setState({ currentPageIndex: 2 });
    useNotebookPagesStore.getState().goToNextPage();
    expect(useNotebookPagesStore.getState().currentPageIndex).toBe(2);
  });

  it("goToPrevPage goes back by one", () => {
    useNotebookPagesStore.getState().goToPrevPage();
    expect(useNotebookPagesStore.getState().currentPageIndex).toBe(0);
  });

  it("goToPrevPage stops at first page", () => {
    useNotebookPagesStore.setState({ currentPageIndex: 0 });
    useNotebookPagesStore.getState().goToPrevPage();
    expect(useNotebookPagesStore.getState().currentPageIndex).toBe(0);
  });
});

describe("loadNotebookPages", () => {
  it("loads pages from API and resets currentPageIndex", async () => {
    const { listPages } = await import("../api/pages");
    vi.mocked(listPages).mockResolvedValue(threePages);

    useNotebookPagesStore.setState({ currentPageIndex: 2 });
    await useNotebookPagesStore.getState().loadNotebookPages("nb_test");

    const state = useNotebookPagesStore.getState();
    expect(state.pages).toEqual(threePages);
    expect(state.notebookId).toBe("nb_test");
    expect(state.currentPageIndex).toBe(0);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it("sets error on API failure", async () => {
    const { listPages } = await import("../api/pages");
    vi.mocked(listPages).mockRejectedValue(new Error("Network error"));

    await useNotebookPagesStore.getState().loadNotebookPages("nb_fail");

    const state = useNotebookPagesStore.getState();
    expect(state.error).toBe("Network error");
    expect(state.loading).toBe(false);
  });
});

describe("addNewPage", () => {
  it("appends a new page to the list", async () => {
    const { createPage } = await import("../api/pages");
    const newPage = makePage("p4", 4);
    vi.mocked(createPage).mockResolvedValue(newPage);

    useNotebookPagesStore.setState({ notebookId: "nb_test", pages: threePages });
    const result = await useNotebookPagesStore.getState().addNewPage();

    expect(result).toEqual(newPage);
    expect(useNotebookPagesStore.getState().pages).toHaveLength(4);
  });

  it("throws when no notebook loaded", async () => {
    await expect(useNotebookPagesStore.getState().addNewPage()).rejects.toThrow(
      "No notebook loaded",
    );
  });
});
