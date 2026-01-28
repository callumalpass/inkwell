import { renderHook, act } from "@testing-library/react";
import { useUndoRedo } from "./useUndoRedo";
import { useUndoRedoStore } from "../stores/undo-redo-store";
import { usePageStore } from "../stores/page-store";
import type { Stroke } from "../api/strokes";

vi.mock("../api/strokes", () => ({
  deleteStroke: vi.fn().mockResolvedValue({ count: 0 }),
  postStrokes: vi.fn().mockResolvedValue({ count: 1 }),
}));

const makeStroke = (id: string): Stroke => ({
  id,
  points: [
    { x: 0, y: 0, pressure: 0.5 },
    { x: 10, y: 10, pressure: 0.5 },
  ],
  color: "#000000",
  width: 3,
  createdAt: new Date().toISOString(),
});

beforeEach(() => {
  useUndoRedoStore.setState({ historyByPage: {} });
  usePageStore.setState({ strokesByPage: {}, loadingPages: new Set() });
  vi.clearAllMocks();
});

describe("useUndoRedo", () => {
  it("reports canUndo=false and canRedo=false initially", () => {
    const { result } = renderHook(() => useUndoRedo("page1"));
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  describe("undo add-stroke", () => {
    it("removes the stroke from the page store and calls deleteStroke API", async () => {
      const { deleteStroke } = await import("../api/strokes");
      const stroke = makeStroke("s1");

      // Set up: stroke is saved and recorded in undo history
      usePageStore.getState().addSavedStrokes("page1", [stroke]);
      useUndoRedoStore.getState().record({
        type: "add-stroke",
        pageId: "page1",
        stroke,
      });

      const { result } = renderHook(() => useUndoRedo("page1"));
      expect(result.current.canUndo).toBe(true);

      act(() => result.current.undo());

      // Stroke should be removed from page store
      expect(usePageStore.getState().strokesByPage["page1"]).toEqual([]);
      // API should be called
      expect(deleteStroke).toHaveBeenCalledWith("page1", "s1");
    });
  });

  describe("undo remove-stroke", () => {
    it("re-adds the stroke to the page store and calls postStrokes API", async () => {
      const { postStrokes } = await import("../api/strokes");
      const stroke = makeStroke("s1");

      // Set up: stroke was erased and recorded in undo history
      useUndoRedoStore.getState().record({
        type: "remove-stroke",
        pageId: "page1",
        stroke,
      });

      const { result } = renderHook(() => useUndoRedo("page1"));

      act(() => result.current.undo());

      // Stroke should be re-added
      expect(usePageStore.getState().strokesByPage["page1"]).toEqual([stroke]);
      // API should be called
      expect(postStrokes).toHaveBeenCalledWith("page1", [stroke]);
    });
  });

  describe("redo add-stroke", () => {
    it("re-adds the stroke after undo", async () => {
      const { postStrokes } = await import("../api/strokes");
      const stroke = makeStroke("s1");

      // Set up: stroke drawn, then undone
      usePageStore.getState().addSavedStrokes("page1", [stroke]);
      useUndoRedoStore.getState().record({
        type: "add-stroke",
        pageId: "page1",
        stroke,
      });

      const { result } = renderHook(() => useUndoRedo("page1"));

      act(() => result.current.undo());
      expect(usePageStore.getState().strokesByPage["page1"]).toEqual([]);

      act(() => result.current.redo());
      expect(usePageStore.getState().strokesByPage["page1"]).toEqual([stroke]);
      expect(postStrokes).toHaveBeenCalledWith("page1", [stroke]);
    });
  });

  describe("redo remove-stroke", () => {
    it("re-removes the stroke after undo", async () => {
      const { deleteStroke } = await import("../api/strokes");
      const stroke = makeStroke("s1");

      // Set up: stroke erased, then undone (re-added)
      useUndoRedoStore.getState().record({
        type: "remove-stroke",
        pageId: "page1",
        stroke,
      });

      const { result } = renderHook(() => useUndoRedo("page1"));

      // Undo the erase → re-adds stroke
      act(() => result.current.undo());
      expect(usePageStore.getState().strokesByPage["page1"]).toEqual([stroke]);

      // Redo the erase → removes stroke again
      act(() => result.current.redo());
      expect(usePageStore.getState().strokesByPage["page1"]).toEqual([]);
      expect(deleteStroke).toHaveBeenCalledWith("page1", stroke.id);
    });
  });

  describe("no-op when nothing to undo/redo", () => {
    it("undo does nothing when stack is empty", async () => {
      const { deleteStroke, postStrokes } = await import("../api/strokes");
      const { result } = renderHook(() => useUndoRedo("page1"));

      act(() => result.current.undo());

      expect(deleteStroke).not.toHaveBeenCalled();
      expect(postStrokes).not.toHaveBeenCalled();
    });

    it("redo does nothing when stack is empty", async () => {
      const { deleteStroke, postStrokes } = await import("../api/strokes");
      const { result } = renderHook(() => useUndoRedo("page1"));

      act(() => result.current.redo());

      expect(deleteStroke).not.toHaveBeenCalled();
      expect(postStrokes).not.toHaveBeenCalled();
    });
  });

  describe("multi-step undo/redo", () => {
    it("handles multiple undos and redos in sequence", async () => {
      const stroke1 = makeStroke("s1");
      const stroke2 = makeStroke("s2");

      // Draw two strokes
      usePageStore.getState().addSavedStrokes("page1", [stroke1, stroke2]);
      useUndoRedoStore.getState().record({
        type: "add-stroke",
        pageId: "page1",
        stroke: stroke1,
      });
      useUndoRedoStore.getState().record({
        type: "add-stroke",
        pageId: "page1",
        stroke: stroke2,
      });

      const { result } = renderHook(() => useUndoRedo("page1"));

      // Undo s2
      act(() => result.current.undo());
      expect(usePageStore.getState().strokesByPage["page1"]).toEqual([stroke1]);

      // Undo s1
      act(() => result.current.undo());
      expect(usePageStore.getState().strokesByPage["page1"]).toEqual([]);

      // Can't undo further
      expect(result.current.canUndo).toBe(false);

      // Redo s1
      act(() => result.current.redo());
      expect(usePageStore.getState().strokesByPage["page1"]).toEqual([stroke1]);

      // Redo s2
      act(() => result.current.redo());
      expect(usePageStore.getState().strokesByPage["page1"]).toEqual([
        stroke1,
        stroke2,
      ]);
    });
  });
});
