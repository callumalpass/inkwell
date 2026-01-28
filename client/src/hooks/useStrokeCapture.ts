import { useCallback, useEffect, useRef } from "react";
import { useDrawingStore } from "../stores/drawing-store";
import { PAGE_WIDTH, PAGE_HEIGHT } from "../lib/constants";
import type { StrokePoint } from "../lib/stroke-renderer";

function toPagePoint(
  rect: DOMRect,
  clientX: number,
  clientY: number,
  pressure: number,
): StrokePoint {
  return {
    x: ((clientX - rect.left) / rect.width) * PAGE_WIDTH,
    y: ((clientY - rect.top) / rect.height) * PAGE_HEIGHT,
    pressure: pressure || 0.5,
  };
}

export function useStrokeCapture(pageId: string) {
  const isDrawing = useRef(false);
  const cachedRect = useRef<DOMRect | null>(null);
  const pointBuffer = useRef<StrokePoint[]>([]);
  const rafId = useRef<number>(0);
  const elementRef = useRef<HTMLElement | null>(null);

  const flushBuffer = useCallback(() => {
    rafId.current = 0;
    const points = pointBuffer.current;
    if (points.length === 0) return;
    pointBuffer.current = [];
    useDrawingStore.getState().addPoints(points);
  }, []);

  const scheduleFlush = useCallback(() => {
    if (rafId.current === 0) {
      rafId.current = requestAnimationFrame(flushBuffer);
    }
  }, [flushBuffer]);

  // Native pointermove/pointerrawupdate handler for high-rate capture
  const handleRawUpdate = useCallback(
    (e: PointerEvent) => {
      if (!isDrawing.current || !cachedRect.current) return;
      const rect = cachedRect.current;

      const coalesced = e.getCoalescedEvents?.();
      if (coalesced && coalesced.length > 1) {
        for (const ce of coalesced) {
          pointBuffer.current.push(
            toPagePoint(rect, ce.clientX, ce.clientY, ce.pressure),
          );
        }
      } else {
        pointBuffer.current.push(
          toPagePoint(rect, e.clientX, e.clientY, e.pressure),
        );
      }
      scheduleFlush();
    },
    [scheduleFlush],
  );

  // Attach native pointerrawupdate listener (falls back to pointermove)
  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;

    const hasRawUpdate = "onpointerrawupdate" in el;
    const eventName = hasRawUpdate ? "pointerrawupdate" : "pointermove";
    el.addEventListener(eventName, handleRawUpdate as EventListener);

    return () => {
      el.removeEventListener(eventName, handleRawUpdate as EventListener);
    };
  }, [handleRawUpdate]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      isDrawing.current = true;
      cachedRect.current = e.currentTarget.getBoundingClientRect();
      elementRef.current = e.currentTarget;
      pointBuffer.current = [];
      useDrawingStore.getState().startStroke(
        pageId,
        toPagePoint(cachedRect.current, e.clientX, e.clientY, e.pressure),
      );
    },
    [pageId],
  );

  // onPointerMove is kept as a no-op — capture happens via native listener
  const onPointerMove = useCallback(
    (_e: React.PointerEvent<HTMLElement>) => {},
    [],
  );

  const onPointerUp = useCallback(
    (_e: React.PointerEvent<HTMLElement>) => {
      if (!isDrawing.current) return;
      isDrawing.current = false;
      cachedRect.current = null;
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
        rafId.current = 0;
      }
      const points = pointBuffer.current;
      pointBuffer.current = [];
      const store = useDrawingStore.getState();
      if (points.length > 0) {
        store.addPoints(points);
      }
      store.endStroke();
    },
    [],
  );

  // Ref callback to attach to the drawing element
  const captureRef = useCallback(
    (el: HTMLElement | null) => {
      elementRef.current = el;
    },
    [],
  );

  return { onPointerDown, onPointerMove, onPointerUp, captureRef };
}
