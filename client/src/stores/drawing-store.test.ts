import { useDrawingStore } from "./drawing-store";

const point = (x: number, y: number) => ({ x, y, pressure: 0.5 });

beforeEach(() => {
  // Reset store to initial state between tests
  useDrawingStore.setState({
    tool: "pen",
    color: "#000000",
    width: 3,
    penStyle: "pressure",
    activeStroke: null,
    pendingStrokesByPage: {},
  });
});

describe("tool selection", () => {
  it("defaults to pen tool", () => {
    expect(useDrawingStore.getState().tool).toBe("pen");
  });

  it("switches to eraser", () => {
    useDrawingStore.getState().setTool("eraser");
    expect(useDrawingStore.getState().tool).toBe("eraser");
  });

  it("switches to highlighter", () => {
    useDrawingStore.getState().setTool("highlighter");
    expect(useDrawingStore.getState().tool).toBe("highlighter");
  });
});

describe("stroke lifecycle", () => {
  it("starts a stroke with one point", () => {
    useDrawingStore.getState().startStroke("page1", point(10, 20));
    const { activeStroke } = useDrawingStore.getState();
    expect(activeStroke).not.toBeNull();
    expect(activeStroke!.pageId).toBe("page1");
    expect(activeStroke!.points).toHaveLength(1);
  });

  it("adds points to active stroke", () => {
    const { startStroke, addPoint } = useDrawingStore.getState();
    startStroke("page1", point(0, 0));
    addPoint(point(10, 10));
    addPoint(point(20, 20));
    expect(useDrawingStore.getState().activeStroke!.points).toHaveLength(3);
  });

  it("adds multiple points at once", () => {
    const { startStroke, addPoints } = useDrawingStore.getState();
    startStroke("page1", point(0, 0));
    addPoints([point(1, 1), point(2, 2), point(3, 3)]);
    expect(useDrawingStore.getState().activeStroke!.points).toHaveLength(4);
  });

  it("does not add points when no active stroke", () => {
    useDrawingStore.getState().addPoint(point(5, 5));
    expect(useDrawingStore.getState().activeStroke).toBeNull();
  });

  it("ends stroke with >= 2 points and adds to pending", () => {
    const { startStroke, addPoint, endStroke } = useDrawingStore.getState();
    startStroke("page1", point(0, 0));
    addPoint(point(10, 10));
    endStroke();

    const state = useDrawingStore.getState();
    expect(state.activeStroke).toBeNull();
    expect(state.pendingStrokesByPage["page1"]).toHaveLength(1);
    expect(state.pendingStrokesByPage["page1"][0].points).toHaveLength(2);
  });

  it("discards stroke with fewer than 2 points", () => {
    const { startStroke, endStroke } = useDrawingStore.getState();
    startStroke("page1", point(0, 0));
    endStroke();

    const state = useDrawingStore.getState();
    expect(state.activeStroke).toBeNull();
    expect(state.pendingStrokesByPage["page1"]).toBeUndefined();
  });

  it("saves highlighter tool in stroke when drawing with highlighter", () => {
    useDrawingStore.getState().setTool("highlighter");
    const { startStroke, addPoint, endStroke } = useDrawingStore.getState();
    startStroke("page1", point(0, 0));
    addPoint(point(10, 10));
    endStroke();

    const state = useDrawingStore.getState();
    expect(state.pendingStrokesByPage["page1"][0].tool).toBe("highlighter");
  });

  it("does not save tool property for pen strokes", () => {
    useDrawingStore.getState().setTool("pen");
    const { startStroke, addPoint, endStroke } = useDrawingStore.getState();
    startStroke("page1", point(0, 0));
    addPoint(point(10, 10));
    endStroke();

    const state = useDrawingStore.getState();
    expect(state.pendingStrokesByPage["page1"][0].tool).toBeUndefined();
  });
});

describe("flush pending", () => {
  it("flushes pending strokes for a specific page", () => {
    const { startStroke, addPoint, endStroke, flushPendingForPage } =
      useDrawingStore.getState();

    startStroke("page1", point(0, 0));
    addPoint(point(1, 1));
    endStroke();

    const flushed = useDrawingStore.getState().flushPendingForPage("page1");
    expect(flushed).toHaveLength(1);
    expect(useDrawingStore.getState().pendingStrokesByPage["page1"]).toBeUndefined();
  });

  it("returns empty array when no pending strokes", () => {
    const flushed = useDrawingStore.getState().flushPendingForPage("page_empty");
    expect(flushed).toEqual([]);
  });

  it("flushes all pending strokes", () => {
    const store = useDrawingStore.getState();

    store.startStroke("page1", point(0, 0));
    store.addPoint(point(1, 1));
    store.endStroke();

    useDrawingStore.getState().startStroke("page2", point(0, 0));
    useDrawingStore.getState().addPoint(point(1, 1));
    useDrawingStore.getState().endStroke();

    const all = useDrawingStore.getState().flushAllPending();
    expect(Object.keys(all)).toHaveLength(2);
    expect(useDrawingStore.getState().pendingStrokesByPage).toEqual({});
  });
});
