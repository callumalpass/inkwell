import { useViewStore } from "./view-store";

beforeEach(() => {
  useViewStore.setState({
    viewMode: "single",
    canvasTransform: { x: 0, y: 0, scale: 1 },
    singlePageTransform: { x: 0, y: 0, scale: 1 },
    isZoomLocked: false,
  });
});

describe("view mode", () => {
  it("defaults to single", () => {
    expect(useViewStore.getState().viewMode).toBe("single");
  });

  it("switches to canvas", () => {
    useViewStore.getState().setViewMode("canvas");
    expect(useViewStore.getState().viewMode).toBe("canvas");
  });

  it("switches to overview", () => {
    useViewStore.getState().setViewMode("overview");
    expect(useViewStore.getState().viewMode).toBe("overview");
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

describe("single page transform", () => {
  it("defaults to origin with scale 1", () => {
    expect(useViewStore.getState().singlePageTransform).toEqual({ x: 0, y: 0, scale: 1 });
  });

  it("updates transform values", () => {
    useViewStore.getState().setSinglePageTransform({ x: 50, y: -30, scale: 2 });
    expect(useViewStore.getState().singlePageTransform).toEqual({
      x: 50,
      y: -30,
      scale: 2,
    });
  });

  it("does not affect canvas transform", () => {
    useViewStore.getState().setSinglePageTransform({ x: 99, y: 99, scale: 3 });
    expect(useViewStore.getState().canvasTransform).toEqual({ x: 0, y: 0, scale: 1 });
  });
});

describe("zoom lock", () => {
  it("defaults to false", () => {
    expect(useViewStore.getState().isZoomLocked).toBe(false);
  });

  it("can be set to true", () => {
    useViewStore.getState().setZoomLocked(true);
    expect(useViewStore.getState().isZoomLocked).toBe(true);
  });

  it("can be set to false", () => {
    useViewStore.getState().setZoomLocked(true);
    useViewStore.getState().setZoomLocked(false);
    expect(useViewStore.getState().isZoomLocked).toBe(false);
  });

  it("toggles from false to true", () => {
    expect(useViewStore.getState().isZoomLocked).toBe(false);
    useViewStore.getState().toggleZoomLocked();
    expect(useViewStore.getState().isZoomLocked).toBe(true);
  });

  it("toggles from true to false", () => {
    useViewStore.getState().setZoomLocked(true);
    useViewStore.getState().toggleZoomLocked();
    expect(useViewStore.getState().isZoomLocked).toBe(false);
  });

  it("does not affect transforms", () => {
    useViewStore.getState().setCanvasTransform({ x: 10, y: 20, scale: 2 });
    useViewStore.getState().toggleZoomLocked();
    expect(useViewStore.getState().canvasTransform).toEqual({ x: 10, y: 20, scale: 2 });
  });
});
