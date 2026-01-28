import { useEffect, useMemo, useRef, useCallback, useState } from "react";
import { useNotebookPagesStore } from "../../stores/notebook-pages-store";
import { usePageStore, trackSave } from "../../stores/page-store";
import { useDrawingStore } from "../../stores/drawing-store";
import { useUndoRedoStore } from "../../stores/undo-redo-store";
import { useMultiPageWebSocket } from "../../hooks/useMultiPageWebSocket";
import { useVisiblePages } from "../../hooks/useVisiblePages";
import { usePinchZoom } from "../../hooks/usePinchZoom";
import { useViewStore } from "../../stores/view-store";
import { postStrokes } from "../../api/strokes";
import { enqueueStrokes } from "../../lib/offline-queue";
import { PageSurface } from "./PageSurface";
import type { GridType } from "./PageBackground";
import {
  VIEW_MIN_ZOOM,
  VIEW_MAX_ZOOM,
  DEFAULT_LINE_SPACING,
} from "../../lib/constants";

export function ScrollPageListView() {
  const pages = useNotebookPagesStore((s) => s.pages);
  const gridType = useNotebookPagesStore((s) => (s.settings.gridType ?? "none") as GridType);
  const lineSpacing = useNotebookPagesStore(
    (s) => s.settings.backgroundLineSpacing ?? DEFAULT_LINE_SPACING,
  );
  const activeStrokePageId = useDrawingStore((s) => s.activeStroke?.pageId ?? null);
  const loadPageStrokes = usePageStore((s) => s.loadPageStrokes);
  const pageIds = useMemo(() => pages.map((p) => p.id), [pages]);
  const [scrollRoot, setScrollRoot] = useState<Element | null>(null);
  const { visiblePageIds, observeRef } = useVisiblePages(pageIds, scrollRoot);

  const renderedPageIds = useMemo(() => {
    if (!activeStrokePageId) return visiblePageIds;
    const next = new Set(visiblePageIds);
    next.add(activeStrokePageId);
    return next;
  }, [visiblePageIds, activeStrokePageId]);

  const renderedArray = useMemo(
    () => Array.from(renderedPageIds),
    [renderedPageIds],
  );

  useMultiPageWebSocket(renderedArray);

  const prevVisibleRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    for (const pid of renderedPageIds) {
      loadPageStrokes(pid);
    }

    const unload = usePageStore.getState().unloadPageStrokes;
    for (const pid of prevVisibleRef.current) {
      if (!renderedPageIds.has(pid) && pid !== activeStrokePageId) {
        const flushed = useDrawingStore.getState().flushPendingForPage(pid);
        if (flushed.length > 0) {
          usePageStore.getState().addSavedStrokes(pid, flushed);
          const savePromise = postStrokes(pid, flushed).catch(() => {
            enqueueStrokes(pid, flushed).catch(console.error);
          });
          trackSave(pid, savePromise);
        }
        unload(pid);
        useUndoRedoStore.getState().clearPage(pid);
      }
    }
    prevVisibleRef.current = new Set(renderedPageIds);
  }, [renderedPageIds, activeStrokePageId, loadPageStrokes]);

  // Pinch-to-zoom
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (containerRef.current) {
      setScrollRoot(containerRef.current);
    }
  }, []);
  const transform = useViewStore((s) => s.scrollViewTransform);
  const setTransform = useViewStore((s) => s.setScrollViewTransform);
  const isZoomLocked = useViewStore((s) => s.isZoomLocked);

  const getTransform = useCallback(
    () => useViewStore.getState().scrollViewTransform,
    [],
  );
  const resetZoom = useCallback(() => setTransform({ x: 0, y: 0, scale: 1 }), [setTransform]);
  const pinchZoomOptions = useMemo(
    () => ({
      minScale: VIEW_MIN_ZOOM,
      maxScale: VIEW_MAX_ZOOM,
      onDoubleTap: resetZoom,
      enabled: !isZoomLocked,
    }),
    [isZoomLocked, resetZoom],
  );
  usePinchZoom(containerRef, getTransform, setTransform, pinchZoomOptions);

  return (
    <div
      ref={containerRef}
      data-scroll-container
      className="flex-1 overflow-y-auto bg-gray-100"
    >
      <div
        className="mx-auto flex max-w-3xl flex-col items-center gap-6 p-6"
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: "0 0",
        }}
      >
        {pages.map((page) => (
          <div key={page.id} ref={observeRef(page.id)} className="w-full">
            {renderedPageIds.has(page.id) ? (
              <PageSurface
                pageId={page.id}
                gridType={gridType}
                lineSpacing={lineSpacing}
              />
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
