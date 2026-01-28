import { useNotebookPagesStore } from "./notebook-pages-store";
import type { PageMeta } from "../api/pages";

vi.mock("../api/pages", () => ({
  listPages: vi.fn(),
  createPage: vi.fn(),
  updatePage: vi.fn(),
}));

vi.mock("../api/notebooks", () => ({
  getNotebook: vi.fn().mockResolvedValue({
    id: "nb_test",
    title: "Test Notebook",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }),
  updateNotebook: vi.fn().mockResolvedValue({}),
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
    settings: {},
  });
  vi.clearAllMocks();
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
  it("loads pages and notebook settings from API", async () => {
    const { listPages } = await import("../api/pages");
    const { getNotebook } = await import("../api/notebooks");
    vi.mocked(listPages).mockResolvedValue(threePages);
    vi.mocked(getNotebook).mockResolvedValue({
      id: "nb_test",
      title: "Test Notebook",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      settings: { gridType: "lined", defaultColor: "#1e40af" },
    });

    useNotebookPagesStore.setState({ currentPageIndex: 2 });
    await useNotebookPagesStore.getState().loadNotebookPages("nb_test");

    const state = useNotebookPagesStore.getState();
    expect(state.pages).toEqual(threePages);
    expect(state.notebookId).toBe("nb_test");
    expect(state.currentPageIndex).toBe(0);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.settings).toEqual({ gridType: "lined", defaultColor: "#1e40af" });
  });

  it("defaults settings to empty object when notebook has none", async () => {
    const { listPages } = await import("../api/pages");
    const { getNotebook } = await import("../api/notebooks");
    vi.mocked(listPages).mockResolvedValue(threePages);
    vi.mocked(getNotebook).mockResolvedValue({
      id: "nb_test",
      title: "Test Notebook",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await useNotebookPagesStore.getState().loadNotebookPages("nb_test");
    expect(useNotebookPagesStore.getState().settings).toEqual({});
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

describe("updateSettings", () => {
  it("merges new settings and persists via API", async () => {
    const { updateNotebook } = await import("../api/notebooks");
    vi.mocked(updateNotebook).mockResolvedValue({} as any);

    useNotebookPagesStore.setState({
      notebookId: "nb_test",
      settings: { gridType: "none" },
    });

    await useNotebookPagesStore.getState().updateSettings({ gridType: "grid" });

    expect(useNotebookPagesStore.getState().settings).toEqual({ gridType: "grid" });
    expect(updateNotebook).toHaveBeenCalledWith("nb_test", {
      settings: { gridType: "grid" },
    });
  });

  it("merges with existing settings without overwriting other fields", async () => {
    const { updateNotebook } = await import("../api/notebooks");
    vi.mocked(updateNotebook).mockResolvedValue({} as any);

    useNotebookPagesStore.setState({
      notebookId: "nb_test",
      settings: { gridType: "lined", defaultColor: "#000000" },
    });

    await useNotebookPagesStore.getState().updateSettings({ defaultColor: "#1e40af" });

    expect(useNotebookPagesStore.getState().settings).toEqual({
      gridType: "lined",
      defaultColor: "#1e40af",
    });
  });

  it("throws when no notebook loaded", async () => {
    await expect(
      useNotebookPagesStore.getState().updateSettings({ gridType: "grid" }),
    ).rejects.toThrow("No notebook loaded");
  });
});

describe("updatePageLinks", () => {
  it("updates links on a page via API and refreshes store", async () => {
    const { updatePage } = await import("../api/pages");
    const updatedPage = { ...threePages[0], links: ["p2", "p3"] };
    vi.mocked(updatePage).mockResolvedValue(updatedPage);

    useNotebookPagesStore.setState({ pages: [...threePages] });
    await useNotebookPagesStore.getState().updatePageLinks("p1", ["p2", "p3"]);

    expect(updatePage).toHaveBeenCalledWith("p1", { links: ["p2", "p3"] });
    const page = useNotebookPagesStore.getState().pages.find((p) => p.id === "p1");
    expect(page?.links).toEqual(["p2", "p3"]);
  });

  it("replaces existing links completely", async () => {
    const { updatePage } = await import("../api/pages");
    const pageWithLinks = { ...threePages[0], links: ["p2"] };
    const updatedPage = { ...threePages[0], links: ["p3"] };
    vi.mocked(updatePage).mockResolvedValue(updatedPage);

    useNotebookPagesStore.setState({
      pages: [pageWithLinks, threePages[1], threePages[2]],
    });
    await useNotebookPagesStore.getState().updatePageLinks("p1", ["p3"]);

    expect(updatePage).toHaveBeenCalledWith("p1", { links: ["p3"] });
    const page = useNotebookPagesStore.getState().pages.find((p) => p.id === "p1");
    expect(page?.links).toEqual(["p3"]);
  });

  it("clears links with empty array", async () => {
    const { updatePage } = await import("../api/pages");
    const updatedPage = { ...threePages[0], links: [] };
    vi.mocked(updatePage).mockResolvedValue(updatedPage);

    useNotebookPagesStore.setState({ pages: [...threePages] });
    await useNotebookPagesStore.getState().updatePageLinks("p1", []);

    expect(updatePage).toHaveBeenCalledWith("p1", { links: [] });
    const page = useNotebookPagesStore.getState().pages.find((p) => p.id === "p1");
    expect(page?.links).toEqual([]);
  });

  it("does not modify other pages in the store", async () => {
    const { updatePage } = await import("../api/pages");
    const updatedPage = { ...threePages[0], links: ["p2"] };
    vi.mocked(updatePage).mockResolvedValue(updatedPage);

    useNotebookPagesStore.setState({ pages: [...threePages] });
    await useNotebookPagesStore.getState().updatePageLinks("p1", ["p2"]);

    const pages = useNotebookPagesStore.getState().pages;
    expect(pages[1]).toEqual(threePages[1]);
    expect(pages[2]).toEqual(threePages[2]);
  });
});

describe("updatePageTags", () => {
  it("updates tags on a page via API and refreshes store", async () => {
    const { updatePage } = await import("../api/pages");
    const updatedPage = { ...threePages[0], tags: ["meeting", "project-x"] };
    vi.mocked(updatePage).mockResolvedValue(updatedPage);

    useNotebookPagesStore.setState({ pages: [...threePages] });
    await useNotebookPagesStore.getState().updatePageTags("p1", ["meeting", "project-x"]);

    expect(updatePage).toHaveBeenCalledWith("p1", { tags: ["meeting", "project-x"] });
    const page = useNotebookPagesStore.getState().pages.find((p) => p.id === "p1");
    expect(page?.tags).toEqual(["meeting", "project-x"]);
  });

  it("clears tags with empty array", async () => {
    const { updatePage } = await import("../api/pages");
    const updatedPage = { ...threePages[0], tags: [] };
    vi.mocked(updatePage).mockResolvedValue(updatedPage);

    useNotebookPagesStore.setState({ pages: [...threePages] });
    await useNotebookPagesStore.getState().updatePageTags("p1", []);

    expect(updatePage).toHaveBeenCalledWith("p1", { tags: [] });
    const page = useNotebookPagesStore.getState().pages.find((p) => p.id === "p1");
    expect(page?.tags).toEqual([]);
  });

  it("does not modify other pages in the store", async () => {
    const { updatePage } = await import("../api/pages");
    const updatedPage = { ...threePages[0], tags: ["important"] };
    vi.mocked(updatePage).mockResolvedValue(updatedPage);

    useNotebookPagesStore.setState({ pages: [...threePages] });
    await useNotebookPagesStore.getState().updatePageTags("p1", ["important"]);

    const pages = useNotebookPagesStore.getState().pages;
    expect(pages[1]).toEqual(threePages[1]);
    expect(pages[2]).toEqual(threePages[2]);
  });
});
