import { render, screen, fireEvent } from "@testing-library/react";
import { CanvasView } from "./CanvasView";
import { useNotebookPagesStore } from "../../stores/notebook-pages-store";
import { useViewStore } from "../../stores/view-store";
import { useDrawingStore } from "../../stores/drawing-store";
import { usePageStore } from "../../stores/page-store";
import type { PageMeta } from "../../api/pages";

vi.mock("../../hooks/useMultiPageWebSocket", () => ({
  useMultiPageWebSocket: vi.fn(),
}));

vi.mock("../../hooks/usePinchZoom", () => ({
  usePinchZoom: vi.fn(),
}));

vi.mock("./PageSurface", () => ({
  PageSurface: ({ pageId }: { pageId: string }) => (
    <div data-testid={`page-surface-${pageId}`}>PageSurface {pageId}</div>
  ),
}));

vi.mock("../../api/pages", () => ({
  listPages: vi.fn(),
  createPage: vi.fn(),
  updatePage: vi.fn(),
}));

vi.mock("../../api/notebooks", () => ({
  getNotebook: vi.fn().mockResolvedValue({
    id: "nb_test",
    title: "Test",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }),
  updateNotebook: vi.fn().mockResolvedValue({}),
}));

vi.mock("../../api/strokes", () => ({
  getStrokes: vi.fn().mockResolvedValue([]),
  appendStrokes: vi.fn().mockResolvedValue({}),
  deleteStroke: vi.fn().mockResolvedValue({}),
  clearStrokes: vi.fn().mockResolvedValue({}),
}));

const makePage = (
  id: string,
  pageNumber: number,
  canvasX = 0,
  canvasY = 0,
): PageMeta => ({
  id,
  notebookId: "nb_test",
  pageNumber,
  canvasX,
  canvasY,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

beforeEach(() => {
  useNotebookPagesStore.setState({
    notebookId: "nb_test",
    pages: [makePage("pg_1", 1, 0, 0), makePage("pg_2", 2, 500, 0)],
    currentPageIndex: 0,
    loading: false,
    error: null,
    settings: {},
  });
  useViewStore.setState({
    viewMode: "canvas",
    canvasTransform: { x: 0, y: 0, scale: 1 },
    singlePageTransform: { x: 0, y: 0, scale: 1 },
    scrollViewTransform: { x: 0, y: 0, scale: 1 },
  });
  useDrawingStore.setState({
    tool: "pen",
    color: "#000000",
    width: 3,
    penStyle: "pressure",
    activeStroke: null,
    pendingStrokesByPage: {},
  });
  usePageStore.setState({
    strokesByPage: {},
    loadingPages: new Set<string>(),
  });
  // Mock getBoundingClientRect for viewport visibility check
  Element.prototype.getBoundingClientRect = vi.fn(() => ({
    x: 0,
    y: 0,
    width: 1024,
    height: 768,
    top: 0,
    right: 1024,
    bottom: 768,
    left: 0,
    toJSON: () => {},
  }));
  // Stub setPointerCapture / releasePointerCapture
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

describe("CanvasView - Drag Handle", () => {
  it("renders a drag handle for each page", () => {
    render(<CanvasView />);
    expect(screen.getByTestId("drag-handle-pg_1")).toBeInTheDocument();
    expect(screen.getByTestId("drag-handle-pg_2")).toBeInTheDocument();
  });

  it("drag handle has grab cursor", () => {
    render(<CanvasView />);
    const handle = screen.getByTestId("drag-handle-pg_1");
    expect(handle.style.cursor).toBe("grab");
  });

  it("drag handle contains a grip icon SVG", () => {
    render(<CanvasView />);
    const handle = screen.getByTestId("drag-handle-pg_1");
    const svg = handle.querySelector("svg");
    expect(svg).not.toBeNull();
    // The grip icon has 6 dots (circles)
    const circles = svg!.querySelectorAll("circle");
    expect(circles.length).toBe(6);
  });

  it("drag handle starts drag on left-click even with pen tool active", () => {
    // Pen tool is active by default (set in beforeEach)
    render(<CanvasView />);
    const handle = screen.getByTestId("drag-handle-pg_1");

    // Left-click (button=0) on drag handle should start drag
    fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 100,
      clientY: 100,
      pointerId: 1,
    });

    // The handle's stopPropagation prevents drawing layer from getting the event
    // and the drag starts — we can verify by checking the handle's parent got
    // setPointerCapture called
    expect(Element.prototype.setPointerCapture).toHaveBeenCalled();
  });

  it("drag handle starts drag on left-click with eraser tool active", () => {
    useDrawingStore.setState({ tool: "eraser" });
    render(<CanvasView />);
    const handle = screen.getByTestId("drag-handle-pg_1");

    fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 100,
      clientY: 100,
      pointerId: 1,
    });

    expect(Element.prototype.setPointerCapture).toHaveBeenCalled();
  });

  it("drag handle ignores non-left button clicks", () => {
    render(<CanvasView />);
    const handle = screen.getByTestId("drag-handle-pg_1");

    // Right-click (button=2) should not start drag
    fireEvent.pointerDown(handle, {
      button: 2,
      clientX: 100,
      clientY: 100,
      pointerId: 1,
    });

    expect(Element.prototype.setPointerCapture).not.toHaveBeenCalled();
  });

  it("drag handle is positioned in the top-left of the page", () => {
    render(<CanvasView />);
    const handle = screen.getByTestId("drag-handle-pg_1");
    expect(handle.style.position).toBe("absolute");
    expect(handle.style.top).toBe("4px");
    expect(handle.style.left).toBe("4px");
  });

  it("drag handle has touch-action none to prevent browser gestures", () => {
    render(<CanvasView />);
    const handle = screen.getByTestId("drag-handle-pg_1");
    expect(handle.style.touchAction).toBe("none");
  });
});

describe("CanvasView - Page rendering", () => {
  it("renders page surfaces for visible pages", () => {
    render(<CanvasView />);
    // Both pages at x=0 and x=500 are within the mocked 1024-wide viewport
    expect(screen.getByTestId("page-surface-pg_1")).toBeInTheDocument();
    expect(screen.getByTestId("page-surface-pg_2")).toBeInTheDocument();
  });

  it("renders placeholder for pages outside viewport", () => {
    // Place pg_2 far offscreen
    useNotebookPagesStore.setState({
      pages: [makePage("pg_1", 1, 0, 0), makePage("pg_2", 2, 5000, 5000)],
    });
    render(<CanvasView />);
    expect(screen.getByTestId("page-surface-pg_1")).toBeInTheDocument();
    expect(
      screen.queryByTestId("page-surface-pg_2"),
    ).not.toBeInTheDocument();
  });
});
