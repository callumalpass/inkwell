import { useViewStore } from "./view-store";

beforeEach(() => {
  useViewStore.setState({
    viewMode: "single",
    canvasTransform: { x: 0, y: 0, scale: 1 },
  });
});

describe("view mode", () => {
  it("defaults to single", () => {
    expect(useViewStore.getState().viewMode).toBe("single");
  });

  it("switches to scroll", () => {
    useViewStore.getState().setViewMode("scroll");
    expect(useViewStore.getState().viewMode).toBe("scroll");
  });

  it("switches to canvas", () => {
    useViewStore.getState().setViewMode("canvas");
    expect(useViewStore.getState().viewMode).toBe("canvas");
  });
});

describe("canvas transform", () => {
  it("defaults to origin with scale 1", () => {
    const { canvasTransform } = useViewStore.getState();
    expect(canvasTransform).toEqual({ x: 0, y: 0, scale: 1 });
  });

  it("updates transform values", () => {
    useViewStore.getState().setCanvasTransform({ x: 100, y: -50, scale: 1.5 });
    expect(useViewStore.getState().canvasTransform).toEqual({
      x: 100,
      y: -50,
      scale: 1.5,
    });
  });

  it("replaces previous transform completely", () => {
    useViewStore.getState().setCanvasTransform({ x: 10, y: 20, scale: 2 });
    useViewStore.getState().setCanvasTransform({ x: 0, y: 0, scale: 0.5 });
    expect(useViewStore.getState().canvasTransform).toEqual({
      x: 0,
      y: 0,
      scale: 0.5,
    });
  });
});
