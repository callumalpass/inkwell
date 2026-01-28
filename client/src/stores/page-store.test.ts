import { usePageStore } from "./page-store";
import type { Stroke } from "../api/strokes";

vi.mock("../api/strokes", () => ({
  getStrokes: vi.fn(),
}));

const makeStroke = (id: string): Stroke => ({
  id,
  points: [{ x: 0, y: 0, pressure: 0.5 }],
  color: "#000000",
  width: 3,
  createdAt: new Date().toISOString(),
});

beforeEach(() => {
  usePageStore.setState({
    strokesByPage: {},
    loadingPages: new Set(),
  });
});

describe("addSavedStrokes", () => {
  it("appends strokes to a page", () => {
    const s1 = makeStroke("s1");
    const s2 = makeStroke("s2");

    usePageStore.getState().addSavedStrokes("page1", [s1]);
    usePageStore.getState().addSavedStrokes("page1", [s2]);

    expect(usePageStore.getState().strokesByPage["page1"]).toEqual([s1, s2]);
  });

  it("creates entry for new page", () => {
    const s = makeStroke("s1");
    usePageStore.getState().addSavedStrokes("newPage", [s]);
    expect(usePageStore.getState().strokesByPage["newPage"]).toHaveLength(1);
  });

  it("deduplicates strokes by id (WebSocket echo)", () => {
    const s1 = makeStroke("s1");
    const s2 = makeStroke("s2");

    // First add (optimistic from batch save)
    usePageStore.getState().addSavedStrokes("page1", [s1, s2]);
    // Second add (WebSocket echo of the same strokes)
    usePageStore.getState().addSavedStrokes("page1", [s1, s2]);

    const strokes = usePageStore.getState().strokesByPage["page1"];
    expect(strokes).toHaveLength(2);
    expect(strokes.map((s) => s.id)).toEqual(["s1", "s2"]);
  });

  it("adds novel strokes while skipping duplicates", () => {
    const s1 = makeStroke("s1");
    const s2 = makeStroke("s2");
    const s3 = makeStroke("s3");

    usePageStore.getState().addSavedStrokes("page1", [s1, s2]);
    // s2 is duplicate, s3 is new
    usePageStore.getState().addSavedStrokes("page1", [s2, s3]);

    const strokes = usePageStore.getState().strokesByPage["page1"];
    expect(strokes).toHaveLength(3);
    expect(strokes.map((s) => s.id)).toEqual(["s1", "s2", "s3"]);
  });

  it("returns unchanged state when all strokes are duplicates", () => {
    const s1 = makeStroke("s1");
    usePageStore.getState().addSavedStrokes("page1", [s1]);

    const stateBefore = usePageStore.getState();
    usePageStore.getState().addSavedStrokes("page1", [s1]);
    const stateAfter = usePageStore.getState();

    // State reference should be unchanged (optimization: no unnecessary re-render)
    expect(stateAfter).toBe(stateBefore);
  });
});

describe("removeSavedStroke", () => {
  it("removes a specific stroke by id", () => {
    const s1 = makeStroke("s1");
    const s2 = makeStroke("s2");
    usePageStore.getState().addSavedStrokes("page1", [s1, s2]);

    usePageStore.getState().removeSavedStroke("page1", "s1");

    const strokes = usePageStore.getState().strokesByPage["page1"];
    expect(strokes).toHaveLength(1);
    expect(strokes[0].id).toBe("s2");
  });

  it("does nothing if stroke id not found", () => {
    const s1 = makeStroke("s1");
    usePageStore.getState().addSavedStrokes("page1", [s1]);
    usePageStore.getState().removeSavedStroke("page1", "missing");
    expect(usePageStore.getState().strokesByPage["page1"]).toHaveLength(1);
  });
});

describe("clearSavedStrokes", () => {
  it("empties strokes for a page", () => {
    usePageStore.getState().addSavedStrokes("page1", [makeStroke("s1"), makeStroke("s2")]);
    usePageStore.getState().clearSavedStrokes("page1");
    expect(usePageStore.getState().strokesByPage["page1"]).toEqual([]);
  });
});

describe("unloadPageStrokes", () => {
  it("removes page entry entirely", () => {
    usePageStore.getState().addSavedStrokes("page1", [makeStroke("s1")]);
    usePageStore.getState().unloadPageStrokes("page1");
    expect(usePageStore.getState().strokesByPage["page1"]).toBeUndefined();
  });

  it("preserves other pages", () => {
    usePageStore.getState().addSavedStrokes("page1", [makeStroke("s1")]);
    usePageStore.getState().addSavedStrokes("page2", [makeStroke("s2")]);
    usePageStore.getState().unloadPageStrokes("page1");
    expect(usePageStore.getState().strokesByPage["page1"]).toBeUndefined();
    expect(usePageStore.getState().strokesByPage["page2"]).toHaveLength(1);
  });
});

describe("loadPageStrokes", () => {
  it("skips if page is already loaded", async () => {
    const { getStrokes } = await import("../api/strokes");

    usePageStore.setState({
      strokesByPage: { page1: [makeStroke("s1")] },
    });

    await usePageStore.getState().loadPageStrokes("page1");
    expect(getStrokes).not.toHaveBeenCalled();
  });

  it("skips if page is currently loading", async () => {
    const { getStrokes } = await import("../api/strokes");

    usePageStore.setState({
      loadingPages: new Set(["page1"]),
    });

    await usePageStore.getState().loadPageStrokes("page1");
    expect(getStrokes).not.toHaveBeenCalled();
  });

  it("fetches strokes from API when not loaded", async () => {
    const { getStrokes } = await import("../api/strokes");
    const strokes = [makeStroke("s1")];
    vi.mocked(getStrokes).mockResolvedValue(strokes);

    await usePageStore.getState().loadPageStrokes("page1");

    expect(getStrokes).toHaveBeenCalledWith("page1");
    expect(usePageStore.getState().strokesByPage["page1"]).toEqual(strokes);
    expect(usePageStore.getState().loadingPages.has("page1")).toBe(false);
  });
});
