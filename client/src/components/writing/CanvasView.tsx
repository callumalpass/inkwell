import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNotebookPagesStore } from "../../stores/notebook-pages-store";
import { usePageStore, trackSave } from "../../stores/page-store";
import { useDrawingStore } from "../../stores/drawing-store";
import { useUndoRedoStore } from "../../stores/undo-redo-store";
import { useMultiPageWebSocket } from "../../hooks/useMultiPageWebSocket";
import { usePinchZoom } from "../../hooks/usePinchZoom";
import { useUndoRedoTouch } from "../../hooks/useUndoRedoTouch";
import { useViewStore } from "../../stores/view-store";
import { postStrokes } from "../../api/strokes";
import { enqueueStrokes } from "../../lib/offline-queue";
import { PageSurface } from "./PageSurface";
import { Minimap } from "./Minimap";
import type { GridType } from "./PageBackground";
import {
  PAGE_WIDTH,
  PAGE_HEIGHT,
  CANVAS_MIN_ZOOM,
  CANVAS_MAX_ZOOM,
  DEFAULT_LINE_SPACING,
} from "../../lib/constants";

const PAGE_RENDER_WIDTH = 400;
const PAGE_RENDER_HEIGHT = PAGE_RENDER_WIDTH * (PAGE_HEIGHT / PAGE_WIDTH);

export function CanvasView() {
  const pages = useNotebookPagesStore((s) => s.pages);
  const currentPageIndex = useNotebookPagesStore((s) => s.currentPageIndex);
  const setCurrentPageIndex = useNotebookPagesStore((s) => s.setCurrentPageIndex);
  const currentPageId = pages[currentPageIndex]?.id ?? "";
  const gridType = useNotebookPagesStore((s) => (s.settings.gridType ?? "none") as GridType);
  const lineSpacing = useNotebookPagesStore(
    (s) => s.settings.backgroundLineSpacing ?? DEFAULT_LINE_SPACING,
  );
  const updatePagePosition = useNotebookPagesStore((s) => s.updatePagePosition);
  const canvasTransform = useViewStore((s) => s.canvasTransform);
  const setCanvasTransform = useViewStore((s) => s.setCanvasTransform);
  const isZoomLocked = useViewStore((s) => s.isZoomLocked);
  const setCanvasContainerSize = useViewStore((s) => s.setCanvasContainerSize);
  const canvasContainerSize = useViewStore((s) => s.canvasContainerSize);
  const loadPageStrokes = usePageStore((s) => s.loadPageStrokes);
  const activeTool = useDrawingStore((s) => s.tool);
  const containerRef = useRef<HTMLDivElement>(null);
  const [visiblePageIds, setVisiblePageIds] = useState<Set<string>>(new Set());

  const getCanvasTransform = useCallback(
    () => useViewStore.getState().canvasTransform,
    [],
  );
  const resetCanvasZoom = useCallback(
    () => setCanvasTransform({ x: 0, y: 0, scale: 1 }),
    [setCanvasTransform],
  );
  const pinchZoomOptions = useMemo(
    () => ({
      minScale: CANVAS_MIN_ZOOM,
      maxScale: CANVAS_MAX_ZOOM,
      onDoubleTap: resetCanvasZoom,
      enabled: !isZoomLocked,
    }),
    [isZoomLocked, resetCanvasZoom],
  );
  usePinchZoom(containerRef, getCanvasTransform, setCanvasTransform, pinchZoomOptions);

  // Touch gestures for undo/redo (2-finger tap = undo, 3-finger tap = redo)
  // Works on the current page (tracked by notebook store)
  useUndoRedoTouch(containerRef, currentPageId);

  // Track container size for minimap and Fit All functionality
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver(([entry]) => {
      setCanvasContainerSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [setCanvasContainerSize]);

  // Panning state
  const isPanning = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });

  // Dragging state — offset stored in ref to avoid stale closures in pointerUp
  const dragState = useRef<{
    pageId: string;
    pointerId: number;
    startX: number;
    startY: number;
    origCanvasX: number;
    origCanvasY: number;
    dx: number;
    dy: number;
  } | null>(null);
  const [dragPageId, setDragPageId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ dx: 0, dy: 0 });

  // Touch tracking — single-finger touch drags pages / pans canvas,
  // second finger cancels drag so pinch-to-zoom can take over.
  const activeTouchIds = useRef<Set<number>>(new Set());
  const touchCaptureInfo = useRef<{ pointerId: number; element: HTMLElement } | null>(null);

  // Use stored canvas positions from page metadata
  const pagePositions = useMemo(() => {
    return pages.map((page) => ({
      id: page.id,
      x: page.canvasX ?? 0,
      y: page.canvasY ?? 0,
    }));
  }, [pages]);
  const pageIndexById = useMemo(
    () => new Map(pages.map((page, index) => [page.id, index] as const)),
    [pages],
  );

  const setActivePage = useCallback((pageId: string) => {
    const pageIndex = pageIndexById.get(pageId);
    if (pageIndex === undefined || pageIndex === currentPageIndex) return;
    setCurrentPageIndex(pageIndex);
  }, [pageIndexById, currentPageIndex, setCurrentPageIndex]);

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

  const prevCanvasVisibleRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    for (const pid of visiblePageIds) {
      loadPageStrokes(pid);
    }
    // Unload strokes and associated state for pages that left the canvas viewport
    const unload = usePageStore.getState().unloadPageStrokes;
    for (const pid of prevCanvasVisibleRef.current) {
      if (!visiblePageIds.has(pid)) {
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
    prevCanvasVisibleRef.current = new Set(visiblePageIds);
  }, [visiblePageIds, loadPageStrokes]);

  const cancelTouchDrag = useCallback(() => {
    dragState.current = null;
    setDragPageId(null);
    setDragOffset({ dx: 0, dy: 0 });
    isPanning.current = false;
    if (touchCaptureInfo.current) {
      const { pointerId, element } = touchCaptureInfo.current;
      try {
        element.releasePointerCapture(pointerId);
      } catch {
        // already released
      }
      touchCaptureInfo.current = null;
    }
  }, []);

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

  // Panning: middle-click, left-click on empty canvas background, or single-finger touch
  const handleBackgroundPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Touch: single-finger on background → pan; second finger → cancel for pinch-zoom
      if (e.pointerType === "touch") {
        activeTouchIds.current.add(e.pointerId);
        if (activeTouchIds.current.size > 1) {
          cancelTouchDrag();
          return;
        }
        if (e.currentTarget === e.target) {
          isPanning.current = true;
          lastPointer.current = { x: e.clientX, y: e.clientY };
          const el = e.currentTarget as HTMLElement;
          el.setPointerCapture(e.pointerId);
          touchCaptureInfo.current = { pointerId: e.pointerId, element: el };
          e.preventDefault();
        }
        return;
      }

      if (e.button === 1 || (e.button === 0 && e.currentTarget === e.target)) {
        isPanning.current = true;
        lastPointer.current = { x: e.clientX, y: e.clientY };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        e.preventDefault();
      }
    },
    [cancelTouchDrag],
  );

  // Page dragging: middle-click on a page when drawing tools are active,
  // left-click otherwise, or single-finger touch (any tool).
  // This lets pointer events reach DrawingLayer for pen/eraser.
  const handlePagePointerDown = useCallback(
    (e: React.PointerEvent, pageId: string, canvasX: number, canvasY: number) => {
      setActivePage(pageId);

      // Touch: single-finger on page → drag page; second finger → cancel for pinch-zoom
      if (e.pointerType === "touch") {
        activeTouchIds.current.add(e.pointerId);
        if (activeTouchIds.current.size > 1) {
          cancelTouchDrag();
          return;
        }
        e.stopPropagation();
        e.preventDefault();
        dragState.current = {
          pageId,
          pointerId: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          origCanvasX: canvasX,
          origCanvasY: canvasY,
          dx: 0,
          dy: 0,
        };
        setDragPageId(pageId);
        setDragOffset({ dx: 0, dy: 0 });
        const el = e.currentTarget as HTMLElement;
        el.setPointerCapture(e.pointerId);
        touchCaptureInfo.current = { pointerId: e.pointerId, element: el };
        return;
      }

      const tool = useDrawingStore.getState().tool;
      if (tool === "pen" || tool === "highlighter" || tool === "eraser" || tool === "link") {
        if (e.button !== 1) return; // let event reach DrawingLayer
      } else {
        if (e.button !== 0) return;
      }
      e.stopPropagation();
      e.preventDefault();
      dragState.current = {
        pageId,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        origCanvasX: canvasX,
        origCanvasY: canvasY,
        dx: 0,
        dy: 0,
      };
      setDragPageId(pageId);
      setDragOffset({ dx: 0, dy: 0 });
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [cancelTouchDrag, setActivePage],
  );

  // Drag handle: always starts a drag on left-click or single-finger touch, regardless of active tool.
  // This gives a mouse-friendly grip target that works even when pen/eraser is selected.
  const handleDragHandlePointerDown = useCallback(
    (e: React.PointerEvent, pageId: string, canvasX: number, canvasY: number) => {
      setActivePage(pageId);

      if (e.pointerType === "touch") {
        activeTouchIds.current.add(e.pointerId);
        if (activeTouchIds.current.size > 1) {
          cancelTouchDrag();
          return;
        }
      } else {
        if (e.button !== 0) return;
      }
      e.stopPropagation();
      e.preventDefault();
      dragState.current = {
        pageId,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        origCanvasX: canvasX,
        origCanvasY: canvasY,
        dx: 0,
        dy: 0,
      };
      setDragPageId(pageId);
      setDragOffset({ dx: 0, dy: 0 });
      // Capture on the page wrapper (parent), not the handle itself,
      // so pointerMove/pointerUp on the container still fire correctly.
      const pageWrapper = (e.currentTarget as HTMLElement).parentElement;
      if (pageWrapper) {
        pageWrapper.setPointerCapture(e.pointerId);
        if (e.pointerType === "touch") {
          touchCaptureInfo.current = { pointerId: e.pointerId, element: pageWrapper };
        }
      }
    },
    [cancelTouchDrag, setActivePage],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      // When multiple touch fingers are down, let pinch-zoom handle it
      if (e.pointerType === "touch" && activeTouchIds.current.size > 1) return;

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

      if (dragState.current && e.pointerId === dragState.current.pointerId) {
        const dx = (e.clientX - dragState.current.startX) / canvasTransform.scale;
        const dy = (e.clientY - dragState.current.startY) / canvasTransform.scale;
        dragState.current.dx = dx;
        dragState.current.dy = dy;
        setDragOffset({ dx, dy });
      }
    },
    [canvasTransform, setCanvasTransform],
  );

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === "touch") {
      activeTouchIds.current.delete(e.pointerId);
      if (touchCaptureInfo.current?.pointerId === e.pointerId) {
        touchCaptureInfo.current = null;
      }
    }

    if (dragState.current && e.pointerId === dragState.current.pointerId) {
      const { pageId, origCanvasX, origCanvasY, dx, dy } = dragState.current;
      const newX = origCanvasX + dx;
      const newY = origCanvasY + dy;

      // Only persist if the page actually moved
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        updatePagePosition(pageId, Math.round(newX), Math.round(newY));
      }

      dragState.current = null;
      setDragPageId(null);
      setDragOffset({ dx: 0, dy: 0 });
    }
    isPanning.current = false;
  }, [updatePagePosition]);

  const handlePointerCancel = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === "touch") {
      activeTouchIds.current.delete(e.pointerId);
    }
    cancelTouchDrag();
  }, [cancelTouchDrag]);

  return (
    <div
      ref={containerRef}
      className="relative flex-1 overflow-hidden bg-gray-200"
      style={{ touchAction: "none" }}
      onContextMenu={(e) => e.preventDefault()}
      onWheel={handleWheel}
      onPointerDown={handleBackgroundPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      data-testid="canvas-view"
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
                touchAction: "none",
                cursor: (activeTool === "pen" || activeTool === "highlighter" || activeTool === "eraser")
                  ? undefined
                  : isDragging ? "grabbing" : "grab",
                zIndex: isDragging ? 10 : 0,
                boxShadow: isDragging ? "0 4px 16px rgba(0,0,0,0.2)" : undefined,
              }}
              onPointerDownCapture={(e) =>
                handlePagePointerDown(e, pos.id, pos.x, pos.y)
              }
            >
              {visiblePageIds.has(pos.id) ? (
                <PageSurface
                  pageId={pos.id}
                  gridType={gridType}
                  lineSpacing={lineSpacing}
                />
              ) : (
                <div className="h-full w-full bg-gray-50" />
              )}
              {/* Drag handle — always allows left-click drag regardless of active tool */}
              <div
                data-testid={`drag-handle-${pos.id}`}
                onPointerDownCapture={(e) =>
                  handleDragHandlePointerDown(e, pos.id, pos.x, pos.y)
                }
                style={{
                  position: "absolute",
                  top: 4,
                  left: 4,
                  width: 24,
                  height: 24,
                  cursor: isDragging ? "grabbing" : "grab",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 4,
                  background: "rgba(255,255,255,0.85)",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
                  touchAction: "none",
                  zIndex: 5,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="4" cy="3" r="1.2" fill="#9ca3af" />
                  <circle cx="10" cy="3" r="1.2" fill="#9ca3af" />
                  <circle cx="4" cy="7" r="1.2" fill="#9ca3af" />
                  <circle cx="10" cy="7" r="1.2" fill="#9ca3af" />
                  <circle cx="4" cy="11" r="1.2" fill="#9ca3af" />
                  <circle cx="10" cy="11" r="1.2" fill="#9ca3af" />
                </svg>
              </div>
            </div>
          );
        })}
      </div>

      {/* Minimap for navigation */}
      <Minimap
        pagePositions={pagePositions}
        containerWidth={canvasContainerSize.width}
        containerHeight={canvasContainerSize.height}
      />
    </div>
  );
}
