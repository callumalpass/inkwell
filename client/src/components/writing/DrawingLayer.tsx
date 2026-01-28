import { useStrokeCapture } from "../../hooks/useStrokeCapture";
import { useDrawingStore } from "../../stores/drawing-store";
import { usePageStore } from "../../stores/page-store";
import { useUndoRedoStore } from "../../stores/undo-redo-store";
import { showError } from "../../stores/toast-store";
import * as strokesApi from "../../api/strokes";
import type { Stroke } from "../../api/strokes";
import { PAGE_WIDTH, PAGE_HEIGHT } from "../../lib/constants";
import { StrokeSpatialIndex } from "../../lib/spatial-index";
import { useCallback, useRef, useMemo } from "react";

const EMPTY: Stroke[] = [];
const ERASE_THRESHOLD = 20;

interface DrawingLayerProps {
  pageId: string;
}

export function DrawingLayer({ pageId }: DrawingLayerProps) {
  const { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, captureRef } = useStrokeCapture(pageId);
  const tool = useDrawingStore((s) => s.tool);
  const savedStrokes = usePageStore((s) => s.strokesByPage[pageId] ?? EMPTY);
  const removeSavedStroke = usePageStore((s) => s.removeSavedStroke);
  const lastEraseRef = useRef<string | null>(null);
  // Build spatial index for fast eraser hit-testing (rebuilt when strokes change)
  const spatialIndex = useMemo(
    () => StrokeSpatialIndex.fromStrokes(savedStrokes),
    [savedStrokes],
  );

  const isPenOrMouse = (e: React.PointerEvent) =>
    e.pointerType === "pen" || e.pointerType === "mouse";

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isPenOrMouse(e)) return;
      e.preventDefault();
      if (tool === "eraser") {
        eraseAt(e);
      } else {
        onPointerDown(e);
      }
    },
    [tool, onPointerDown],
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
      if (tool === "eraser") {
        lastEraseRef.current = null;
      } else {
        onPointerUp(e);
      }
    },
    [tool, onPointerUp],
  );

  const handlePointerCancel = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isPenOrMouse(e)) return;
      if (tool === "eraser") {
        lastEraseRef.current = null;
      } else {
        onPointerCancel(e);
      }
    },
    [tool, onPointerCancel],
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
    strokesApi.deleteStroke(pageId, hit.id).catch((err) => {
      console.error("Failed to delete stroke:", err);
      showError("Failed to delete stroke from server");
    });
  }

  return (
    <div
      ref={captureRef}
      className="absolute inset-0 touch-none"
      style={{ cursor: tool === "eraser" ? "crosshair" : "default" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    />
  );
}
