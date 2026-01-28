import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Minimap } from "./Minimap";
import { useViewStore } from "../../stores/view-store";

// Mock the view store
vi.mock("../../stores/view-store", () => ({
  useViewStore: vi.fn(),
}));

describe("Minimap", () => {
  const mockSetCanvasTransform = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useViewStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector) => {
      const state = {
        canvasTransform: { x: 0, y: 0, scale: 1 },
        setCanvasTransform: mockSetCanvasTransform,
      };
      return selector(state);
    });
  });

  it("renders nothing when pagePositions is empty", () => {
    const { container } = render(
      <Minimap
        pagePositions={[]}
        containerWidth={800}
        containerHeight={600}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders minimap when pages exist", () => {
    render(
      <Minimap
        pagePositions={[{ id: "pg_1", x: 0, y: 0 }]}
        containerWidth={800}
        containerHeight={600}
      />
    );

    expect(screen.getByTestId("canvas-minimap")).toBeInTheDocument();
  });

  it("displays page count", () => {
    render(
      <Minimap
        pagePositions={[
          { id: "pg_1", x: 0, y: 0 },
          { id: "pg_2", x: 500, y: 0 },
          { id: "pg_3", x: 0, y: 600 },
        ]}
        containerWidth={800}
        containerHeight={600}
      />
    );

    expect(screen.getByText("3 pages")).toBeInTheDocument();
  });

  it("displays singular 'page' for single page", () => {
    render(
      <Minimap
        pagePositions={[{ id: "pg_1", x: 0, y: 0 }]}
        containerWidth={800}
        containerHeight={600}
      />
    );

    expect(screen.getByText("1 page")).toBeInTheDocument();
  });

  it("renders viewport indicator", () => {
    render(
      <Minimap
        pagePositions={[{ id: "pg_1", x: 0, y: 0 }]}
        containerWidth={800}
        containerHeight={600}
      />
    );

    expect(screen.getByTestId("minimap-viewport")).toBeInTheDocument();
  });

  it("calls setCanvasTransform on click", () => {
    render(
      <Minimap
        pagePositions={[{ id: "pg_1", x: 0, y: 0 }]}
        containerWidth={800}
        containerHeight={600}
      />
    );

    const minimap = screen.getByTestId("canvas-minimap");

    // Mock the bounding rect for the minimap
    vi.spyOn(minimap, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      right: 160,
      bottom: 120,
      width: 160,
      height: 120,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    // Simulate a click in the minimap
    fireEvent.pointerDown(minimap, {
      clientX: 80,
      clientY: 60,
      pointerId: 1,
    });

    expect(mockSetCanvasTransform).toHaveBeenCalled();
  });

  it("renders page rectangles for each page", () => {
    render(
      <Minimap
        pagePositions={[
          { id: "pg_1", x: 0, y: 0 },
          { id: "pg_2", x: 500, y: 0 },
        ]}
        containerWidth={800}
        containerHeight={600}
      />
    );

    const minimap = screen.getByTestId("canvas-minimap");
    // Page rectangles are rendered as SVG rect elements
    const rects = minimap.querySelectorAll("rect");
    // Should have 2 page rects + 1 viewport rect + 1 background pattern rect
    expect(rects.length).toBeGreaterThanOrEqual(3);
  });

  it("updates transform during drag", () => {
    render(
      <Minimap
        pagePositions={[{ id: "pg_1", x: 0, y: 0 }]}
        containerWidth={800}
        containerHeight={600}
      />
    );

    const minimap = screen.getByTestId("canvas-minimap");

    // Start drag
    fireEvent.pointerDown(minimap, {
      clientX: 80,
      clientY: 60,
      pointerId: 1,
    });

    mockSetCanvasTransform.mockClear();

    // Move during drag
    fireEvent.pointerMove(minimap, {
      clientX: 100,
      clientY: 80,
      pointerId: 1,
    });

    expect(mockSetCanvasTransform).toHaveBeenCalled();
  });
});
