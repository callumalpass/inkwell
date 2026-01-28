import { useEffect, type RefObject } from "react";

export interface Transform {
  x: number;
  y: number;
  scale: number;
}

interface PinchZoomOptions {
  minScale?: number;
  maxScale?: number;
  /** If provided, a two-finger double-tap calls this to reset the transform. */
  onDoubleTap?: () => void;
  /** When false, prevent browser pinch zoom but don't change the transform. */
  enabled?: boolean;
}

/** Maximum time (ms) between two taps to count as a double-tap. */
const DOUBLE_TAP_DELAY = 300;
/** Maximum distance (px) fingers may travel for a tap (vs. a drag). */
const TAP_MOVE_THRESHOLD = 15;

/**
 * Attaches native touch listeners to a container element to support
 * two-finger pinch-to-zoom. Single-finger touches are ignored so
 * normal scrolling and tapping remain unaffected.
 *
 * When `onDoubleTap` is provided, a two-finger double-tap (two quick
 * two-finger taps without significant movement) fires the callback,
 * which is typically used to reset zoom to 1:1.
 */
export function usePinchZoom(
  containerRef: RefObject<HTMLElement | null>,
  getTransform: () => Transform,
  setTransform: (t: Transform) => void,
  options?: PinchZoomOptions,
): void {
  const minScale = options?.minScale ?? 0.1;
  const maxScale = options?.maxScale ?? 5.0;
  const enabled = options?.enabled ?? true;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let initialDist = 0;
    let initialMidX = 0;
    let initialMidY = 0;
    let initialTransform: Transform = { x: 0, y: 0, scale: 1 };
    let active = false;

    // Double-tap detection state
    let lastTwoFingerTapTime = 0;
    let twoFingerMoved = false;

    function distance(a: Touch, b: Touch): number {
      const dx = a.clientX - b.clientX;
      const dy = a.clientY - b.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }

    function handleTouchStart(e: TouchEvent) {
      if (e.touches.length !== 2) return;
      if (!enabled) return;

      const [a, b] = [e.touches[0], e.touches[1]];
      initialDist = distance(a, b);
      initialMidX = (a.clientX + b.clientX) / 2;
      initialMidY = (a.clientY + b.clientY) / 2;
      initialTransform = getTransform();
      active = true;
      twoFingerMoved = false;
    }

    function handleTouchMove(e: TouchEvent) {
      if (e.touches.length !== 2) return;

      // Prevent browser zoom / scroll while pinching or when locked.
      e.preventDefault();

      if (!active || !enabled) return;

      const [a, b] = [e.touches[0], e.touches[1]];
      const newDist = distance(a, b);

      // Track whether fingers actually moved (for double-tap detection)
      if (Math.abs(newDist - initialDist) > TAP_MOVE_THRESHOLD) {
        twoFingerMoved = true;
      }
      const ratio = newDist / initialDist;

      const newScale = Math.min(
        maxScale,
        Math.max(minScale, initialTransform.scale * ratio),
      );
      const scaleChange = newScale / initialTransform.scale;

      // Get midpoint relative to the container
      const rect = el!.getBoundingClientRect();
      const midX = initialMidX - rect.left;
      const midY = initialMidY - rect.top;

      // Pan so that the pinch midpoint stays fixed
      const newX = midX - (midX - initialTransform.x) * scaleChange;
      const newY = midY - (midY - initialTransform.y) * scaleChange;

      setTransform({ x: newX, y: newY, scale: newScale });
    }

    function handleTouchEnd(e: TouchEvent) {
      if (e.touches.length < 2) {
        // Detect two-finger double-tap (quick tap without drag)
        if (active && enabled && !twoFingerMoved && options?.onDoubleTap) {
          const now = Date.now();
          if (now - lastTwoFingerTapTime < DOUBLE_TAP_DELAY) {
            options.onDoubleTap();
            lastTwoFingerTapTime = 0; // prevent triple-tap triggering again
          } else {
            lastTwoFingerTapTime = now;
          }
        }
        active = false;
      }
    }

    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
    };
    // Re-attach if the callbacks or bounds change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    containerRef,
    getTransform,
    setTransform,
    minScale,
    maxScale,
    enabled,
    options?.onDoubleTap,
  ]);
}
