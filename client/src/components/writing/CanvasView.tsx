import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNotebookPagesStore } from "../../stores/notebook-pages-store";
import { usePageStore } from "../../stores/page-store";
import { useMultiPageWebSocket } from "../../hooks/useMultiPageWebSocket";
import { useViewStore } from "../../stores/view-store";
import { useCanvasTransform } from "../../hooks/useCanvasTransform";
import { PageSurface } from "./PageSurface";
import {
  PAGE_WIDTH,
  PAGE_HEIGHT,
  CANVAS_GRID_COLS,
  CANVAS_PAGE_GAP,
  CANVAS_MIN_ZOOM,
  CANVAS_MAX_ZOOM,
} from "../../lib/constants";

const PAGE_RENDER_WIDTH = 400;
const PAGE_RENDER_HEIGHT = PAGE_RENDER_WIDTH * (PAGE_HEIGHT / PAGE_WIDTH);

export function CanvasView() {
  const pages = useNotebookPagesStore((s) => s.pages);
  const canvasTransform = useViewStore((s) => s.canvasTransform);
  const setCanvasTransform = useViewStore((s) => s.setCanvasTransform);
  const loadPageStrokes = usePageStore((s) => s.loadPageStrokes);
  const containerRef = useRef<HTMLDivElement>(null);
  const [visiblePageIds, setVisiblePageIds] = useState<Set<string>>(new Set());
  const isPanning = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });

  const pagePositions = useMemo(() => {
    return pages.map((page, i) => {
      const col = i % CANVAS_GRID_COLS;
      const row = Math.floor(i / CANVAS_GRID_COLS);
      return {
        id: page.id,
        x: col * (PAGE_RENDER_WIDTH + CANVAS_PAGE_GAP),
        y: row * (PAGE_RENDER_HEIGHT + CANVAS_PAGE_GAP),
      };
    });
  }, [pages]);

  // Determine which pages are visible in the viewport
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function updateVisibility() {
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const { x, y, scale } = canvasTransform;
      const visible = new Set<string>();

      for (const pos of pagePositions) {
        const left = pos.x * scale + x;
        const top = pos.y * scale + y;
        const right = left + PAGE_RENDER_WIDTH * scale;
        const bottom = top + PAGE_RENDER_HEIGHT * scale;

        if (right >= 0 && left <= rect.width && bottom >= 0 && top <= rect.height) {
          visible.add(pos.id);
        }
      }

      setVisiblePageIds(visible);
    }

    updateVisibility();
  }, [canvasTransform, pagePositions]);

  const visibleArray = useMemo(
    () => Array.from(visiblePageIds),
    [visiblePageIds],
  );

  useMultiPageWebSocket(visibleArray);

  useEffect(() => {
    for (const pid of visiblePageIds) {
      loadPageStrokes(pid);
    }
  }, [visiblePageIds, loadPageStrokes]);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();

      if (e.ctrlKey || e.metaKey) {
        const rect = e.currentTarget.getBoundingClientRect();
        const cursorX = e.clientX - rect.left;
        const cursorY = e.clientY - rect.top;

        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.min(
          CANVAS_MAX_ZOOM,
          Math.max(CANVAS_MIN_ZOOM, canvasTransform.scale * zoomFactor),
        );
        const scaleChange = newScale / canvasTransform.scale;

        setCanvasTransform({
          scale: newScale,
          x: cursorX - (cursorX - canvasTransform.x) * scaleChange,
          y: cursorY - (cursorY - canvasTransform.y) * scaleChange,
        });
      } else {
        setCanvasTransform({
          ...canvasTransform,
          x: canvasTransform.x - e.deltaX,
          y: canvasTransform.y - e.deltaY,
        });
      }
    },
    [canvasTransform, setCanvasTransform],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button === 1 || (e.button === 0 && e.currentTarget === e.target)) {
        isPanning.current = true;
        lastPointer.current = { x: e.clientX, y: e.clientY };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        e.preventDefault();
      }
    },
    [],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isPanning.current) return;
      const dx = e.clientX - lastPointer.current.x;
      const dy = e.clientY - lastPointer.current.y;
      lastPointer.current = { x: e.clientX, y: e.clientY };
      setCanvasTransform({
        ...canvasTransform,
        x: canvasTransform.x + dx,
        y: canvasTransform.y + dy,
      });
    },
    [canvasTransform, setCanvasTransform],
  );

  const handlePointerUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative flex-1 overflow-hidden bg-gray-200"
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div
        style={{
          transform: `translate(${canvasTransform.x}px, ${canvasTransform.y}px) scale(${canvasTransform.scale})`,
          transformOrigin: "0 0",
        }}
      >
        {pagePositions.map((pos) => (
          <div
            key={pos.id}
            style={{
              position: "absolute",
              left: pos.x,
              top: pos.y,
              width: PAGE_RENDER_WIDTH,
              height: PAGE_RENDER_HEIGHT,
            }}
          >
            {visiblePageIds.has(pos.id) ? (
              <PageSurface pageId={pos.id} />
            ) : (
              <div className="h-full w-full bg-gray-50" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
