import { renderHook } from "@testing-library/react";
import { useBatchSave } from "./useBatchSave";
import { useDrawingStore } from "../stores/drawing-store";
import { usePageStore } from "../stores/page-store";
import { useUndoRedoStore } from "../stores/undo-redo-store";
import type { Stroke } from "../api/strokes";

const mockPostStrokes = vi.fn();
const mockEnqueueStrokes = vi.fn();

vi.mock("../api/strokes", () => ({
  postStrokes: (...args: unknown[]) => mockPostStrokes(...args),
}));

vi.mock("../lib/offline-queue", () => ({
  enqueueStrokes: (...args: unknown[]) => mockEnqueueStrokes(...args),
}));

vi.mock("../lib/constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/constants")>();
  return { ...actual, BATCH_SAVE_INTERVAL_MS: 50 };
});

const makeStroke = (id: string, pageId?: string): Stroke => ({
  id,
  points: [
    { x: 0, y: 0, pressure: 0.5 },
    { x: 10, y: 10, pressure: 0.5 },
  ],
  color: "#000000",
  width: 3,
  penStyle: "pressure",
  createdAt: new Date().toISOString(),
});

function seedPending(pageId: string, strokes: Stroke[]) {
  useDrawingStore.setState({
    pendingStrokesByPage: {
      ...useDrawingStore.getState().pendingStrokesByPage,
      [pageId]: strokes,
    },
  });
}

/** Wait for at least one batch interval to fire. */
function waitForBatch(): Promise<void> {
  return new Promise((r) => setTimeout(r, 80));
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  useDrawingStore.setState({ pendingStrokesByPage: {} });
  usePageStore.setState({ strokesByPage: {}, loadingPages: new Set() });
  useUndoRedoStore.setState({ historyByPage: {} });
  mockPostStrokes.mockReset().mockResolvedValue({ count: 1 });
  mockEnqueueStrokes.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useBatchSave", () => {
  describe("single-page mode (pageId provided)", () => {
    it("saves pending strokes for the specified page on interval tick", async () => {
      const stroke = makeStroke("s1");
      seedPending("page1", [stroke]);

      renderHook(() => useBatchSave("page1"));

      await vi.advanceTimersByTimeAsync(50);

      expect(mockPostStrokes).toHaveBeenCalledWith("page1", [stroke]);
    });

    it("adds strokes to the page store optimistically before network call resolves", async () => {
      const stroke = makeStroke("s1");
      seedPending("page1", [stroke]);

      // Make the network call hang
      mockPostStrokes.mockReturnValue(new Promise(() => {}));

      renderHook(() => useBatchSave("page1"));

      await vi.advanceTimersByTimeAsync(50);

      // Stroke should already be in the page store even though the POST hasn't resolved
      expect(usePageStore.getState().strokesByPage["page1"]).toEqual([stroke]);
    });

    it("records each stroke in the undo history", async () => {
      const s1 = makeStroke("s1");
      const s2 = makeStroke("s2");
      seedPending("page1", [s1, s2]);

      renderHook(() => useBatchSave("page1"));

      await vi.advanceTimersByTimeAsync(50);

      const history = useUndoRedoStore.getState().historyByPage["page1"];
      expect(history.undoStack).toHaveLength(2);
      expect(history.undoStack[0]).toEqual({
        type: "add-stroke",
        pageId: "page1",
        stroke: s1,
      });
      expect(history.undoStack[1]).toEqual({
        type: "add-stroke",
        pageId: "page1",
        stroke: s2,
      });
    });

    it("does not call postStrokes when there are no pending strokes", async () => {
      renderHook(() => useBatchSave("page1"));

      await vi.advanceTimersByTimeAsync(50);

      expect(mockPostStrokes).not.toHaveBeenCalled();
    });

    it("ignores pending strokes for other pages", async () => {
      seedPending("page2", [makeStroke("s1")]);

      renderHook(() => useBatchSave("page1"));

      await vi.advanceTimersByTimeAsync(50);

      // page2's strokes should not be flushed when watching page1
      expect(mockPostStrokes).not.toHaveBeenCalled();
      // page2's pending strokes should still be there
      expect(
        useDrawingStore.getState().pendingStrokesByPage["page2"],
      ).toHaveLength(1);
    });

    it("flushes pending strokes from the drawing store after saving", async () => {
      seedPending("page1", [makeStroke("s1")]);

      renderHook(() => useBatchSave("page1"));

      await vi.advanceTimersByTimeAsync(50);

      expect(
        useDrawingStore.getState().pendingStrokesByPage["page1"],
      ).toBeUndefined();
    });
  });

  describe("multi-page mode (no pageId)", () => {
    it("saves pending strokes for all pages", async () => {
      const s1 = makeStroke("s1");
      const s2 = makeStroke("s2");
      seedPending("pageA", [s1]);
      seedPending("pageB", [s2]);

      renderHook(() => useBatchSave());

      await vi.advanceTimersByTimeAsync(50);

      expect(mockPostStrokes).toHaveBeenCalledWith("pageA", [s1]);
      expect(mockPostStrokes).toHaveBeenCalledWith("pageB", [s2]);
    });

    it("adds strokes to the correct page store entries", async () => {
      const s1 = makeStroke("s1");
      const s2 = makeStroke("s2");
      seedPending("pageA", [s1]);
      seedPending("pageB", [s2]);

      renderHook(() => useBatchSave());

      await vi.advanceTimersByTimeAsync(50);

      expect(usePageStore.getState().strokesByPage["pageA"]).toEqual([s1]);
      expect(usePageStore.getState().strokesByPage["pageB"]).toEqual([s2]);
    });

    it("does nothing when no pages have pending strokes", async () => {
      renderHook(() => useBatchSave());

      await vi.advanceTimersByTimeAsync(50);

      expect(mockPostStrokes).not.toHaveBeenCalled();
    });

    it("skips pages whose pending array is empty", async () => {
      // Seed one page with strokes and another with an empty array
      seedPending("pageA", [makeStroke("s1")]);
      useDrawingStore.setState({
        pendingStrokesByPage: {
          ...useDrawingStore.getState().pendingStrokesByPage,
          pageB: [],
        },
      });

      renderHook(() => useBatchSave());

      await vi.advanceTimersByTimeAsync(50);

      expect(mockPostStrokes).toHaveBeenCalledTimes(1);
      expect(mockPostStrokes).toHaveBeenCalledWith("pageA", expect.any(Array));
    });
  });

  describe("offline fallback", () => {
    it("enqueues strokes to IndexedDB when postStrokes fails", async () => {
      const stroke = makeStroke("s1");
      seedPending("page1", [stroke]);
      mockPostStrokes.mockRejectedValue(new Error("Network error"));

      renderHook(() => useBatchSave("page1"));

      await vi.advanceTimersByTimeAsync(50);

      expect(mockEnqueueStrokes).toHaveBeenCalledWith("page1", [stroke]);
    });

    it("still adds strokes to page store even when network fails", async () => {
      const stroke = makeStroke("s1");
      seedPending("page1", [stroke]);
      mockPostStrokes.mockRejectedValue(new Error("Network error"));

      renderHook(() => useBatchSave("page1"));

      await vi.advanceTimersByTimeAsync(50);

      // Optimistic update happens before the network call
      expect(usePageStore.getState().strokesByPage["page1"]).toEqual([stroke]);
    });

    it("still records undo history when network fails", async () => {
      const stroke = makeStroke("s1");
      seedPending("page1", [stroke]);
      mockPostStrokes.mockRejectedValue(new Error("Network error"));

      renderHook(() => useBatchSave("page1"));

      await vi.advanceTimersByTimeAsync(50);

      const history = useUndoRedoStore.getState().historyByPage["page1"];
      expect(history.undoStack).toHaveLength(1);
    });

    it("does not crash when enqueueStrokes also fails", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      seedPending("page1", [makeStroke("s1")]);
      mockPostStrokes.mockRejectedValue(new Error("Network error"));
      mockEnqueueStrokes.mockRejectedValue(new Error("IndexedDB error"));

      renderHook(() => useBatchSave("page1"));

      // Should not throw
      await vi.advanceTimersByTimeAsync(50);

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe("interval lifecycle", () => {
    it("saves on multiple interval ticks", async () => {
      renderHook(() => useBatchSave("page1"));

      // First tick — seed and fire
      seedPending("page1", [makeStroke("s1")]);
      await vi.advanceTimersByTimeAsync(50);
      expect(mockPostStrokes).toHaveBeenCalledTimes(1);

      // Second tick — new strokes
      seedPending("page1", [makeStroke("s2")]);
      await vi.advanceTimersByTimeAsync(50);
      expect(mockPostStrokes).toHaveBeenCalledTimes(2);
    });

    it("clears the interval on unmount", async () => {
      const { unmount } = renderHook(() => useBatchSave("page1"));

      unmount();

      // Seed after unmount — should never fire
      seedPending("page1", [makeStroke("s1")]);
      await vi.advanceTimersByTimeAsync(200);

      expect(mockPostStrokes).not.toHaveBeenCalled();
    });

    it("restarts the interval when pageId changes", async () => {
      const { rerender } = renderHook(
        ({ pageId }: { pageId?: string }) => useBatchSave(pageId),
        { initialProps: { pageId: "page1" } },
      );

      seedPending("page1", [makeStroke("s1")]);
      await vi.advanceTimersByTimeAsync(50);
      expect(mockPostStrokes).toHaveBeenCalledWith("page1", expect.any(Array));

      // Change to page2
      rerender({ pageId: "page2" });
      seedPending("page2", [makeStroke("s2")]);
      await vi.advanceTimersByTimeAsync(50);
      expect(mockPostStrokes).toHaveBeenCalledWith("page2", expect.any(Array));
    });

    it("switches from single-page to multi-page mode on pageId change", async () => {
      const { rerender } = renderHook(
        ({ pageId }: { pageId?: string }) => useBatchSave(pageId),
        { initialProps: { pageId: "page1" as string | undefined } },
      );

      // Switch to multi-page mode
      rerender({ pageId: undefined });

      seedPending("pageA", [makeStroke("s1")]);
      seedPending("pageB", [makeStroke("s2")]);
      await vi.advanceTimersByTimeAsync(50);

      expect(mockPostStrokes).toHaveBeenCalledWith("pageA", expect.any(Array));
      expect(mockPostStrokes).toHaveBeenCalledWith("pageB", expect.any(Array));
    });
  });

  describe("batch semantics", () => {
    it("sends all pending strokes for a page in one batch", async () => {
      const s1 = makeStroke("s1");
      const s2 = makeStroke("s2");
      const s3 = makeStroke("s3");
      seedPending("page1", [s1, s2, s3]);

      renderHook(() => useBatchSave("page1"));

      await vi.advanceTimersByTimeAsync(50);

      // All three strokes should be sent in a single call
      expect(mockPostStrokes).toHaveBeenCalledTimes(1);
      expect(mockPostStrokes).toHaveBeenCalledWith("page1", [s1, s2, s3]);
    });

    it("saves strokes added between interval ticks in the next batch", async () => {
      renderHook(() => useBatchSave("page1"));

      // Let the first tick fire with nothing
      await vi.advanceTimersByTimeAsync(50);
      expect(mockPostStrokes).not.toHaveBeenCalled();

      // Add strokes between ticks
      seedPending("page1", [makeStroke("s1"), makeStroke("s2")]);

      // Next tick should pick them up
      await vi.advanceTimersByTimeAsync(50);
      expect(mockPostStrokes).toHaveBeenCalledTimes(1);
      expect(mockPostStrokes.mock.calls[0][1]).toHaveLength(2);
    });
  });
});
