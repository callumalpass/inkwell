import { useEffect, useCallback, useMemo, useRef } from "react";
import { useNotebookPagesStore } from "../../stores/notebook-pages-store";
import { usePageStore } from "../../stores/page-store";
import { useViewStore } from "../../stores/view-store";
import { useWebSocket } from "../../hooks/useWebSocket";
import { usePinchZoom } from "../../hooks/usePinchZoom";
import { PageSurface } from "./PageSurface";
import type { GridType } from "./PageBackground";
import { VIEW_MIN_ZOOM, VIEW_MAX_ZOOM } from "../../lib/constants";

export function SinglePageView() {
  const pages = useNotebookPagesStore((s) => s.pages);
  const currentPageIndex = useNotebookPagesStore((s) => s.currentPageIndex);
  const gridType = useNotebookPagesStore((s) => (s.settings.gridType ?? "none") as GridType);
  const loadPageStrokes = usePageStore((s) => s.loadPageStrokes);
  const transform = useViewStore((s) => s.singlePageTransform);
  const setTransform = useViewStore((s) => s.setSinglePageTransform);

  const currentPage = pages[currentPageIndex];

  useEffect(() => {
    if (currentPage) loadPageStrokes(currentPage.id);
  }, [currentPage?.id, loadPageStrokes]);

  useWebSocket(currentPage?.id);

  // Pinch-to-zoom
  const containerRef = useRef<HTMLDivElement>(null);

  const getTransform = useCallback(
    () => useViewStore.getState().singlePageTransform,
    [],
  );
  const resetZoom = useCallback(() => setTransform({ x: 0, y: 0, scale: 1 }), [setTransform]);
  const pinchZoomOptions = useMemo(
    () => ({ minScale: VIEW_MIN_ZOOM, maxScale: VIEW_MAX_ZOOM, onDoubleTap: resetZoom }),
    [resetZoom],
  );
  usePinchZoom(containerRef, getTransform, setTransform, pinchZoomOptions);

  // Reset zoom when switching pages
  useEffect(() => {
    setTransform({ x: 0, y: 0, scale: 1 });
  }, [currentPageIndex, setTransform]);

  if (!currentPage) return null;

  return (
    <div
      ref={containerRef}
      className="flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-gray-100 p-4"
    >
      <div
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: "0 0",
          height: "100%",
        }}
      >
        <div className="h-full" style={{ aspectRatio: "1404 / 1872" }}>
          <PageSurface pageId={currentPage.id} gridType={gridType} />
        </div>
      </div>
    </div>
  );
}
