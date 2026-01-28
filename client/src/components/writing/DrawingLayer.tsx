import { useStrokeCapture } from "../../hooks/useStrokeCapture";
import { useDrawingStore } from "../../stores/drawing-store";
import { usePageStore } from "../../stores/page-store";
import * as strokesApi from "../../api/strokes";
import type { Stroke } from "../../api/strokes";
import { PAGE_WIDTH, PAGE_HEIGHT } from "../../lib/constants";
import { useCallback, useRef } from "react";

const EMPTY: Stroke[] = [];

interface DrawingLayerProps {
  pageId: string;
}

export function DrawingLayer({ pageId }: DrawingLayerProps) {
  const { onPointerDown, onPointerMove, onPointerUp, captureRef } = useStrokeCapture(pageId);
  const tool = useDrawingStore((s) => s.tool);
  const savedStrokes = usePageStore((s) => s.strokesByPage[pageId] ?? EMPTY);
  const removeSavedStroke = usePageStore((s) => s.removeSavedStroke);
  const lastEraseRef = useRef<string | null>(null);

  const isPenOrMouse = (e: React.PointerEvent) =>
    e.pointerType === "pen" || e.pointerType === "mouse";

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isPenOrMouse(e)) return;
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

  function eraseAt(e: React.PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * PAGE_WIDTH;
    const y = ((e.clientY - rect.top) / rect.height) * PAGE_HEIGHT;
    const threshold = 20;

    for (const stroke of savedStrokes) {
      if (stroke.id === lastEraseRef.current) continue;
      for (const pt of stroke.points) {
        const dx = pt.x - x;
        const dy = pt.y - y;
        if (dx * dx + dy * dy < threshold * threshold) {
          lastEraseRef.current = stroke.id;
          removeSavedStroke(pageId, stroke.id);
          strokesApi.deleteStroke(pageId, stroke.id).catch(console.error);
          return;
        }
      }
    }
  }

  return (
    <div
      ref={captureRef}
      className="absolute inset-0 touch-none"
      style={{ cursor: tool === "eraser" ? "crosshair" : "default" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    />
  );
}
