import { useStrokeCapture } from "../../hooks/useStrokeCapture";
import { useDrawingStore } from "../../stores/drawing-store";
import { usePageStore } from "../../stores/page-store";
import * as strokesApi from "../../api/strokes";
import { PAGE_WIDTH, PAGE_HEIGHT } from "../../lib/constants";
import { useCallback, useRef } from "react";

export function DrawingLayer() {
  const { onPointerDown, onPointerMove, onPointerUp } = useStrokeCapture();
  const tool = useDrawingStore((s) => s.tool);
  const savedStrokes = usePageStore((s) => s.savedStrokes);
  const removeSavedStroke = usePageStore((s) => s.removeSavedStroke);
  const page = usePageStore((s) => s.page);
  const lastEraseRef = useRef<string | null>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
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
          removeSavedStroke(stroke.id);
          if (page) {
            strokesApi.deleteStroke(page.id, stroke.id).catch(console.error);
          }
          return;
        }
      }
    }
  }

  return (
    <div
      className="absolute inset-0 touch-none"
      style={{ cursor: tool === "eraser" ? "crosshair" : "default" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    />
  );
}
