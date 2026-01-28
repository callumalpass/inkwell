import { useStrokeCapture } from "../../hooks/useStrokeCapture";
import { useDrawingStore } from "../../stores/drawing-store";
import { usePageStore } from "../../stores/page-store";
import { useUndoRedoStore } from "../../stores/undo-redo-store";
import { useViewStore } from "../../stores/view-store";
import * as strokesApi from "../../api/strokes";
import type { Stroke } from "../../api/strokes";
import { PAGE_WIDTH, PAGE_HEIGHT } from "../../lib/constants";
import { StrokeSpatialIndex } from "../../lib/spatial-index";
import { useCallback, useEffect, useRef, useMemo } from "react";

const EMPTY: Stroke[] = [];
const ERASE_THRESHOLD = 20;

interface DrawingLayerProps {
  pageId: string;
}

export function DrawingLayer({ pageId }: DrawingLayerProps) {
  const { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, captureRef } = useStrokeCapture(pageId);
  const tool = useDrawingStore((s) => s.tool);
  const viewMode = useViewStore((s) => s.viewMode);
  const savedStrokes = usePageStore((s) => s.strokesByPage[pageId] ?? EMPTY);
  const removeSavedStroke = usePageStore((s) => s.removeSavedStroke);
  const lastEraseRef = useRef<string | null>(null);
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const prevOverflowRef = useRef<string | null>(null);
  const prevOverflowYRef = useRef<string | null>(null);

  // Build spatial index for fast eraser hit-testing (rebuilt when strokes change)
  const spatialIndex = useMemo(
    () => StrokeSpatialIndex.fromStrokes(savedStrokes),
    [savedStrokes],
  );

  const isPenOrMouse = (e: React.PointerEvent) =>
    e.pointerType === "pen" || e.pointerType === "mouse";

  const lockScroll = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (viewMode !== "scroll") return;
      if (!isPenOrMouse(e)) return;
      if (!scrollContainerRef.current) {
        scrollContainerRef.current = e.currentTarget.closest(
          "[data-scroll-container]",
        ) as HTMLElement | null;
      }
      const container = scrollContainerRef.current;
      if (!container) return;
      if (prevOverflowRef.current === null) {
        prevOverflowRef.current = container.style.overflow;
        prevOverflowYRef.current = container.style.overflowY;
      }
      container.style.overflow = "hidden";
      container.style.overflowY = "hidden";
    },
    [viewMode],
  );

  const unlockScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    if (prevOverflowRef.current !== null) {
      container.style.overflow = prevOverflowRef.current;
      prevOverflowRef.current = null;
    } else {
      container.style.overflow = "";
    }
    if (prevOverflowYRef.current !== null) {
      container.style.overflowY = prevOverflowYRef.current;
      prevOverflowYRef.current = null;
    } else {
      container.style.overflowY = "auto";
    }
  }, []);

  useEffect(() => {
    return () => {
      unlockScroll();
    };
  }, [unlockScroll]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isPenOrMouse(e)) return;
      e.preventDefault();
      lockScroll(e);
      if (tool === "eraser") {
        eraseAt(e);
      } else {
        onPointerDown(e);
      }
    },
    [tool, onPointerDown, lockScroll],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isPenOrMouse(e)) return;
      if (tool === "eraser") {
        if (e.buttons > 0) eraseAt(e);
      } else {
        onPointerMove(e);
      }
    },
    [tool, onPointerMove],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isPenOrMouse(e)) return;
      unlockScroll();
      if (tool === "eraser") {
        lastEraseRef.current = null;
      } else {
        onPointerUp(e);
      }
    },
    [tool, onPointerUp, unlockScroll],
  );

  const handlePointerCancel = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isPenOrMouse(e)) return;
      unlockScroll();
      if (tool === "eraser") {
        lastEraseRef.current = null;
      } else {
        onPointerCancel(e);
      }
    },
    [tool, onPointerCancel, unlockScroll],
  );

  function eraseAt(e: React.PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * PAGE_WIDTH;
    const y = ((e.clientY - rect.top) / rect.height) * PAGE_HEIGHT;

    const hit = spatialIndex.queryPoint(x, y, ERASE_THRESHOLD);
    if (!hit || hit.id === lastEraseRef.current) return;

    lastEraseRef.current = hit.id;
    spatialIndex.removeStroke(hit.id);

    // Record undo command before removing (captures full stroke data)
    useUndoRedoStore.getState().record({
      type: "remove-stroke",
      pageId,
      stroke: hit,
    });
    removeSavedStroke(pageId, hit.id);
    strokesApi.deleteStroke(pageId, hit.id).catch(console.error);
  }

  return (
    <div
      ref={captureRef}
      className={`absolute inset-0 ${viewMode === "scroll" ? "touch-pan-y" : "touch-none"}`}
      style={{ cursor: tool === "eraser" ? "crosshair" : "default" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    />
  );
}
