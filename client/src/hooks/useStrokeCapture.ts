import { useCallback, useRef } from "react";
import { useDrawingStore } from "../stores/drawing-store";
import { PAGE_WIDTH, PAGE_HEIGHT } from "../lib/constants";

export function useStrokeCapture() {
  const { startStroke, addPoint, endStroke } = useDrawingStore();
  const isDrawing = useRef(false);

  const getPoint = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const scaleX = PAGE_WIDTH / rect.width;
      const scaleY = PAGE_HEIGHT / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
        pressure: e.pressure || 0.5,
      };
    },
    [],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      isDrawing.current = true;
      startStroke(getPoint(e));
    },
    [startStroke, getPoint],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (!isDrawing.current) return;
      addPoint(getPoint(e));
    },
    [addPoint, getPoint],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (!isDrawing.current) return;
      isDrawing.current = false;
      endStroke();
    },
    [endStroke],
  );

  return { onPointerDown, onPointerMove, onPointerUp };
}
