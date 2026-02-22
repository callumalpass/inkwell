import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PageBookmarksPanel } from "./PageBookmarksPanel";
import { useBookmarkPanelStore } from "../../stores/bookmark-panel-store";
import { useNotebookPagesStore } from "../../stores/notebook-pages-store";
import type { PageMeta } from "../../api/pages";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ notebookId: "nb_test" }),
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

beforeEach(() => {
  useBookmarkPanelStore.setState({ panelOpen: true, panelPageId: "p1" });
  useNotebookPagesStore.setState({
    notebookId: "nb_test",
    pages: [makePage("p1", 1), makePage("p2", 2)],
    currentPageIndex: 0,
    settings: {},
  });
  mockNavigate.mockReset();
});

describe("PageBookmarksPanel", () => {
  it("renders nested bookmarks", () => {
    useNotebookPagesStore.setState({
      settings: {
        bookmarks: [
          {
            id: "bm_root",
            pageId: "p1",
            createdAt: new Date().toISOString(),
            order: 0,
          },
          {
            id: "bm_child",
            pageId: "p2",
            parentId: "bm_root",
            createdAt: new Date().toISOString(),
            order: 1,
          },
        ],
      },
    });

    render(<PageBookmarksPanel />);
    expect(screen.getByTestId("bookmarks-panel")).toBeInTheDocument();
    expect(screen.getByTestId("bookmark-item-bm_root")).toBeInTheDocument();
    expect(screen.getByTestId("bookmark-item-bm_child")).toBeInTheDocument();
  });

  it("adds current page as bookmark", async () => {
    const user = userEvent.setup();
    const addBookmark = vi.fn().mockResolvedValue({
      id: "bm_new",
      pageId: "p1",
      createdAt: new Date().toISOString(),
      order: 0,
      parentId: null,
    });
    useNotebookPagesStore.setState({ addBookmark });

    render(<PageBookmarksPanel />);
    await user.click(screen.getByTestId("bookmark-toggle-current"));

    expect(addBookmark).toHaveBeenCalledWith("p1", {
      label: "",
      parentId: null,
    });
  });

  it("uses active page index even when panel page id is stale", async () => {
    const user = userEvent.setup();
    const addBookmark = vi.fn().mockResolvedValue({
      id: "bm_new",
      pageId: "p2",
      createdAt: new Date().toISOString(),
      order: 0,
      parentId: null,
    });
    useNotebookPagesStore.setState({
      currentPageIndex: 1,
      addBookmark,
    });
    // Keep panelPageId stale on p1 to simulate the reported bug.
    useBookmarkPanelStore.setState({ panelOpen: true, panelPageId: "p1" });

    render(<PageBookmarksPanel />);
    await user.click(screen.getByTestId("bookmark-toggle-current"));

    expect(addBookmark).toHaveBeenCalledWith("p2", {
      label: "",
      parentId: null,
    });
  });
});
