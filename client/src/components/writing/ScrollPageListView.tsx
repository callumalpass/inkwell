import { useEffect, useMemo, useRef, useCallback } from "react";
import { useNotebookPagesStore } from "../../stores/notebook-pages-store";
import { usePageStore } from "../../stores/page-store";
import { useMultiPageWebSocket } from "../../hooks/useMultiPageWebSocket";
import { useVisiblePages } from "../../hooks/useVisiblePages";
import { usePinchZoom } from "../../hooks/usePinchZoom";
import { useViewStore } from "../../stores/view-store";
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
  const loadPageStrokes = usePageStore((s) => s.loadPageStrokes);
  const pageIds = useMemo(() => pages.map((p) => p.id), [pages]);
  const { visiblePageIds, observeRef } = useVisiblePages(pageIds);

  const visibleArray = useMemo(
    () => Array.from(visiblePageIds),
    [visiblePageIds],
  );

  useMultiPageWebSocket(visibleArray);

  // Load strokes for ALL pages and keep them in memory.  Unlike canvas view
  // (where pages rarely leave the viewport), scroll view constantly cycles
  // pages in and out of visibility.  Unloading and reloading stroke data on
  // every scroll created race conditions between in-flight POSTs and server
  // fetches that caused strokes to drop.  Keeping the data resident
  // eliminates those races — the memory cost is negligible.
  useEffect(() => {
    for (const pid of pageIds) {
      loadPageStrokes(pid);
    }
  }, [pageIds, loadPageStrokes]);

  // Pinch-to-zoom
  const containerRef = useRef<HTMLDivElement>(null);
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
