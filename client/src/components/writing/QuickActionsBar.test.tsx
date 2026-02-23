import { render, screen, fireEvent } from "@testing-library/react";
import { QuickActionsBar } from "./QuickActionsBar";
import { useNotebookPagesStore } from "../../stores/notebook-pages-store";
import { useViewStore } from "../../stores/view-store";
import { useDrawingStore } from "../../stores/drawing-store";
import { useLinksPanelStore } from "../../stores/links-panel-store";
import { useTagsPanelStore } from "../../stores/tags-panel-store";
import { useBookmarkPanelStore } from "../../stores/bookmark-panel-store";
import type { PageMeta } from "../../api/pages";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ notebookId: "nb_test" }),
}));

function makePage(id: string, pageNumber: number, canvasX: number, canvasY: number): PageMeta {
  const now = new Date().toISOString();
  return {
    id,
    notebookId: "nb_test",
    pageNumber,
    canvasX,
    canvasY,
    createdAt: now,
    updatedAt: now,
  };
}

beforeEach(() => {
  mockNavigate.mockReset();
  useViewStore.setState({
    viewMode: "single",
    canvasTransform: { x: 0, y: 0, scale: 1 },
    canvasContainerSize: { width: 1000, height: 800 },
  });
  useNotebookPagesStore.setState({
    notebookId: "nb_test",
    pages: [
      makePage("pg_1", 1, 0, 0),
      makePage("pg_2", 2, 140, 10),
      makePage("pg_3", 3, 0, 300),
    ],
    currentPageIndex: 0,
    loading: false,
    error: null,
    settings: {},
  });
  useLinksPanelStore.setState({ panelOpen: false, panelPageId: null });
  useTagsPanelStore.setState({ panelOpen: false, panelPageId: null });
  useBookmarkPanelStore.setState({ panelOpen: false, panelPageId: null });
  useDrawingStore.setState({
    tool: "pen",
    color: "#000000",
    width: 3,
    penStyle: "pressure",
    activeStroke: null,
    pendingStrokesByPage: {},
    debugLastPointCount: 0,
  });
});

describe("QuickActionsBar", () => {
  it("does not render in overview mode", () => {
    useViewStore.setState({ viewMode: "overview" });
    const { container } = render(<QuickActionsBar />);
    expect(container.firstChild).toBeNull();
  });

  it("can be collapsed and expanded", () => {
    render(<QuickActionsBar />);
    expect(screen.getByTestId("quick-actions-panel")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("quick-actions-toggle"));
    expect(screen.queryByTestId("quick-actions-panel")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("quick-actions-toggle"));
    expect(screen.getByTestId("quick-actions-panel")).toBeInTheDocument();
  });

  it("navigates to nearest page in selected direction", () => {
    render(<QuickActionsBar />);
    fireEvent.click(screen.getByLabelText("Navigate to nearest page right"));

    expect(useNotebookPagesStore.getState().currentPageIndex).toBe(1);
    expect(mockNavigate).toHaveBeenCalledWith("/notebook/nb_test/page/pg_2", {
      replace: true,
    });
  });

  it("re-centers canvas viewport when navigating in canvas mode", () => {
    useViewStore.setState({
      viewMode: "canvas",
      canvasTransform: { x: 0, y: 0, scale: 1 },
      canvasContainerSize: { width: 1000, height: 800 },
    });

    render(<QuickActionsBar />);
    fireEvent.click(screen.getByLabelText("Navigate to nearest page right"));

    const nextTransform = useViewStore.getState().canvasTransform;
    expect(nextTransform.x).toBeCloseTo(160, 4);
    expect(nextTransform.y).toBeCloseTo(123.3333, 4);
  });

  it("toggles inline link tool and keeps tag/bookmark shortcuts working", () => {
    render(<QuickActionsBar />);

    fireEvent.click(screen.getByLabelText("Toggle inline link tool"));
    expect(useDrawingStore.getState().tool).toBe("link");

    fireEvent.click(screen.getByLabelText("Toggle tags panel"));
    expect(useDrawingStore.getState().tool).toBe("link");
    expect(useTagsPanelStore.getState().panelOpen).toBe(true);
    expect(useTagsPanelStore.getState().panelPageId).toBe("pg_1");

    fireEvent.click(screen.getByLabelText("Toggle bookmarks panel"));
    expect(useTagsPanelStore.getState().panelOpen).toBe(false);
    expect(useBookmarkPanelStore.getState().panelOpen).toBe(true);
    expect(useBookmarkPanelStore.getState().panelPageId).toBe("pg_1");

    fireEvent.click(screen.getByLabelText("Toggle inline link tool"));
    expect(useDrawingStore.getState().tool).toBe("pen");
  });

  it("navigates through last active page history", () => {
    render(<QuickActionsBar />);

    const backBtn = screen.getByLabelText("Navigate to previous active page");
    const forwardBtn = screen.getByLabelText("Navigate to next active page");
    expect(backBtn).toBeDisabled();
    expect(forwardBtn).toBeDisabled();

    fireEvent.click(screen.getByLabelText("Navigate to nearest page right"));
    expect(useNotebookPagesStore.getState().currentPageIndex).toBe(1);
    expect(backBtn).toBeEnabled();
    expect(forwardBtn).toBeDisabled();

    fireEvent.click(backBtn);
    expect(useNotebookPagesStore.getState().currentPageIndex).toBe(0);
    expect(forwardBtn).toBeEnabled();

    fireEvent.click(forwardBtn);
    expect(useNotebookPagesStore.getState().currentPageIndex).toBe(1);

    expect(mockNavigate).toHaveBeenNthCalledWith(1, "/notebook/nb_test/page/pg_2", {
      replace: true,
    });
    expect(mockNavigate).toHaveBeenNthCalledWith(2, "/notebook/nb_test/page/pg_1", {
      replace: true,
    });
    expect(mockNavigate).toHaveBeenNthCalledWith(3, "/notebook/nb_test/page/pg_2", {
      replace: true,
    });
  });
});
