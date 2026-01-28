import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNotebookPagesStore } from "../../stores/notebook-pages-store";
import { usePageStore } from "../../stores/page-store";
import { useMultiPageWebSocket } from "../../hooks/useMultiPageWebSocket";
import { useViewStore } from "../../stores/view-store";
import { PageSurface } from "./PageSurface";
import {
  PAGE_WIDTH,
  PAGE_HEIGHT,
  CANVAS_MIN_ZOOM,
  CANVAS_MAX_ZOOM,
} from "../../lib/constants";

const PAGE_RENDER_WIDTH = 400;
const PAGE_RENDER_HEIGHT = PAGE_RENDER_WIDTH * (PAGE_HEIGHT / PAGE_WIDTH);

export function CanvasView() {
  const pages = useNotebookPagesStore((s) => s.pages);
  const updatePagePosition = useNotebookPagesStore((s) => s.updatePagePosition);
  const canvasTransform = useViewStore((s) => s.canvasTransform);
  const setCanvasTransform = useViewStore((s) => s.setCanvasTransform);
  const loadPageStrokes = usePageStore((s) => s.loadPageStrokes);
  const containerRef = useRef<HTMLDivElement>(null);
  const [visiblePageIds, setVisiblePageIds] = useState<Set<string>>(new Set());

  // Panning state
  const isPanning = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });

  // Dragging state
  const dragState = useRef<{
    pageId: string;
    startX: number;
    startY: number;
    origCanvasX: number;
    origCanvasY: number;
  } | null>(null);
  const [dragPageId, setDragPageId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ dx: 0, dy: 0 });

  // Use stored canvas positions from page metadata
  const pagePositions = useMemo(() => {
    return pages.map((page) => ({
      id: page.id,
      x: page.canvasX ?? 0,
      y: page.canvasY ?? 0,
    }));
  }, [pages]);

  // Determine which pages are visible in the viewport
  useEffect(() => {
    const container = containerRef.current;
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

  // Panning: middle-click or left-click on empty canvas background
  const handleBackgroundPointerDown = useCallback(
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

  // Page dragging: left-click on a page
  const handlePagePointerDown = useCallback(
    (e: React.PointerEvent, pageId: string, canvasX: number, canvasY: number) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      dragState.current = {
        pageId,
        startX: e.clientX,
        startY: e.clientY,
        origCanvasX: canvasX,
        origCanvasY: canvasY,
      };
      setDragPageId(pageId);
      setDragOffset({ dx: 0, dy: 0 });
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (isPanning.current) {
        const dx = e.clientX - lastPointer.current.x;
        const dy = e.clientY - lastPointer.current.y;
        lastPointer.current = { x: e.clientX, y: e.clientY };
        setCanvasTransform({
          ...canvasTransform,
          x: canvasTransform.x + dx,
          y: canvasTransform.y + dy,
        });
        return;
      }

      if (dragState.current) {
        const dx = (e.clientX - dragState.current.startX) / canvasTransform.scale;
        const dy = (e.clientY - dragState.current.startY) / canvasTransform.scale;
        setDragOffset({ dx, dy });
      }
    },
    [canvasTransform, setCanvasTransform],
  );

  const handlePointerUp = useCallback(() => {
    if (dragState.current) {
      const { pageId, origCanvasX, origCanvasY } = dragState.current;
      const newX = origCanvasX + dragOffset.dx;
      const newY = origCanvasY + dragOffset.dy;

      // Only persist if the page actually moved
      if (Math.abs(dragOffset.dx) > 2 || Math.abs(dragOffset.dy) > 2) {
        updatePagePosition(pageId, Math.round(newX), Math.round(newY));
      }

      dragState.current = null;
      setDragPageId(null);
      setDragOffset({ dx: 0, dy: 0 });
    }
    isPanning.current = false;
  }, [dragOffset, updatePagePosition]);

  return (
    <div
      ref={containerRef}
      className="relative flex-1 overflow-hidden bg-gray-200"
      onWheel={handleWheel}
      onPointerDown={handleBackgroundPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div
        style={{
          transform: `translate(${canvasTransform.x}px, ${canvasTransform.y}px) scale(${canvasTransform.scale})`,
          transformOrigin: "0 0",
        }}
      >
        {pagePositions.map((pos) => {
          const isDragging = dragPageId === pos.id;
          const displayX = isDragging ? pos.x + dragOffset.dx : pos.x;
          const displayY = isDragging ? pos.y + dragOffset.dy : pos.y;

          return (
            <div
              key={pos.id}
              style={{
                position: "absolute",
                left: displayX,
                top: displayY,
                width: PAGE_RENDER_WIDTH,
                height: PAGE_RENDER_HEIGHT,
                cursor: isDragging ? "grabbing" : "grab",
                zIndex: isDragging ? 10 : 0,
                boxShadow: isDragging ? "0 4px 16px rgba(0,0,0,0.2)" : undefined,
              }}
              onPointerDown={(e) =>
                handlePagePointerDown(e, pos.id, pos.x, pos.y)
              }
            >
              {visiblePageIds.has(pos.id) ? (
                <PageSurface pageId={pos.id} />
              ) : (
                <div className="h-full w-full bg-gray-50" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
