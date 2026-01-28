import { useEffect, useMemo, useRef, useCallback } from "react";
import { useNotebookPagesStore } from "../../stores/notebook-pages-store";
import { usePageStore, trackSave } from "../../stores/page-store";
import { useDrawingStore } from "../../stores/drawing-store";
import { useUndoRedoStore } from "../../stores/undo-redo-store";
import { useMultiPageWebSocket } from "../../hooks/useMultiPageWebSocket";
import { postStrokes } from "../../api/strokes";
import { enqueueStrokes } from "../../lib/offline-queue";
import { useVisiblePages } from "../../hooks/useVisiblePages";
import { usePinchZoom } from "../../hooks/usePinchZoom";
import { useViewStore } from "../../stores/view-store";
import { PageSurface } from "./PageSurface";
import type { GridType } from "./PageBackground";
import { VIEW_MIN_ZOOM, VIEW_MAX_ZOOM } from "../../lib/constants";

export function ScrollPageListView() {
  const pages = useNotebookPagesStore((s) => s.pages);
  const gridType = useNotebookPagesStore((s) => (s.settings.gridType ?? "none") as GridType);
  const loadPageStrokes = usePageStore((s) => s.loadPageStrokes);
  const unloadPageStrokes = usePageStore((s) => s.unloadPageStrokes);
  const pageIds = useMemo(() => pages.map((p) => p.id), [pages]);
  const { visiblePageIds, observeRef } = useVisiblePages(pageIds);
  const prevVisibleRef = useRef<Set<string>>(new Set());

  const visibleArray = useMemo(
    () => Array.from(visiblePageIds),
    [visiblePageIds],
  );

  useMultiPageWebSocket(visibleArray);

  useEffect(() => {
    // Load strokes for newly visible pages
    for (const pid of visiblePageIds) {
      loadPageStrokes(pid);
    }
    // Unload strokes and associated state for pages that left the viewport
    for (const pid of prevVisibleRef.current) {
      if (!visiblePageIds.has(pid)) {
        // Flush pending strokes and save to server before unloading.
        // This ensures strokes aren't lost if the page scrolls out mid-draw.
        const flushed = useDrawingStore.getState().flushPendingForPage(pid);
        if (flushed.length > 0) {
          // Optimistically add to saved state so they aren't absent during the
          // network call (addSavedStrokes deduplicates by ID).
          usePageStore.getState().addSavedStrokes(pid, flushed);
          const savePromise = postStrokes(pid, flushed).catch(() => {
            enqueueStrokes(pid, flushed).catch(console.error);
          });
          trackSave(pid, savePromise);
        }
        unloadPageStrokes(pid);
        useUndoRedoStore.getState().clearPage(pid);
      }
    }
    prevVisibleRef.current = new Set(visiblePageIds);
  }, [visiblePageIds, loadPageStrokes, unloadPageStrokes]);

  // Pinch-to-zoom
  const containerRef = useRef<HTMLDivElement>(null);
  const transform = useViewStore((s) => s.scrollViewTransform);
  const setTransform = useViewStore((s) => s.setScrollViewTransform);

  const getTransform = useCallback(
    () => useViewStore.getState().scrollViewTransform,
    [],
  );
  const resetZoom = useCallback(() => setTransform({ x: 0, y: 0, scale: 1 }), [setTransform]);
  const pinchZoomOptions = useMemo(
    () => ({ minScale: VIEW_MIN_ZOOM, maxScale: VIEW_MAX_ZOOM, onDoubleTap: resetZoom }),
    [resetZoom],
  );
  usePinchZoom(containerRef, getTransform, setTransform, pinchZoomOptions);

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto bg-gray-100">
      <div
        className="mx-auto flex max-w-3xl flex-col items-center gap-6 p-6"
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: "0 0",
        }}
      >
        {pages.map((page) => (
          <div key={page.id} ref={observeRef(page.id)} className="w-full">
            {visiblePageIds.has(page.id) ? (
              <PageSurface pageId={page.id} gridType={gridType} />
            ) : (
              <div
                className="w-full bg-gray-50"
                style={{ aspectRatio: "1404 / 1872" }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
