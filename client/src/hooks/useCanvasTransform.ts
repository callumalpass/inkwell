import { useCallback, useRef } from "react";
import { useViewStore } from "../stores/view-store";
import { CANVAS_MIN_ZOOM, CANVAS_MAX_ZOOM } from "../lib/constants";

export function useCanvasTransform() {
  const { canvasTransform, setCanvasTransform } = useViewStore();
  const isPanning = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();

      if (e.ctrlKey || e.metaKey) {
        // Zoom
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
        // Pan
        setCanvasTransform({
          ...canvasTransform,
          x: canvasTransform.x - e.deltaX,
          y: canvasTransform.y - e.deltaY,
        });
      }
    },
    [canvasTransform, setCanvasTransform],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Middle mouse button, or left click on canvas background
      if (e.button === 1 || (e.button === 0 && e.currentTarget === e.target)) {
        isPanning.current = true;
        lastPointer.current = { x: e.clientX, y: e.clientY };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        e.preventDefault();
      }
    },
    [],
  );

  const onPointerMove = useCallback(
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

  const onPointerUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  return { onWheel, onPointerDown, onPointerMove, onPointerUp };
}
