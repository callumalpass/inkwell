import { useEffect, type RefObject } from "react";

interface TouchGestureCallbacks {
  /** Called when a two-finger tap is detected. */
  onTwoFingerTap?: () => void;
  /** Called when a three-finger tap is detected. */
  onThreeFingerTap?: () => void;
  /** When false, disables gesture detection. */
  enabled?: boolean;
}

/** Maximum time (ms) for fingers to be down to count as a tap (vs. a hold). */
const TAP_MAX_DURATION = 300;
/** Maximum distance (px) any finger may travel for it to count as a tap (vs. a drag). */
const TAP_MOVE_THRESHOLD = 20;

/**
 * Detects multi-finger tap gestures on a container element.
 *
 * - Two-finger tap: Triggers `onTwoFingerTap` (e.g., for undo)
 * - Three-finger tap: Triggers `onThreeFingerTap` (e.g., for redo)
 *
 * A tap is defined as:
 * - Touch down with N fingers
 * - All fingers lifted within TAP_MAX_DURATION
 * - No finger moved more than TAP_MOVE_THRESHOLD pixels
 *
 * This hook is designed to coexist with usePinchZoom - pinch gestures
 * involve significant finger movement and will not trigger tap callbacks.
 */
export function useTouchGestures(
  containerRef: RefObject<HTMLElement | null>,
  callbacks?: TouchGestureCallbacks,
): void {
  const enabled = callbacks?.enabled ?? true;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Track the initial touch positions and timing
    let touchStartTime = 0;
    let initialTouchCount = 0;
    let maxTouchCount = 0;
    let initialPositions: Map<number, { x: number; y: number }> = new Map();
    let hasMoved = false;

    function handleTouchStart(e: TouchEvent) {
      if (!enabled) return;

      const touchCount = e.touches.length;

      // If this is a new gesture (no existing touches), record start time
      if (initialTouchCount === 0) {
        touchStartTime = Date.now();
        initialPositions.clear();
        hasMoved = false;
      }

      // Record initial positions for all touches
      for (let i = 0; i < e.touches.length; i++) {
        const touch = e.touches[i];
        if (!initialPositions.has(touch.identifier)) {
          initialPositions.set(touch.identifier, {
            x: touch.clientX,
            y: touch.clientY,
          });
        }
      }

      initialTouchCount = touchCount;
      maxTouchCount = Math.max(maxTouchCount, touchCount);
    }

    function handleTouchMove(e: TouchEvent) {
      if (!enabled || hasMoved) return;

      // Check if any finger has moved beyond threshold
      for (let i = 0; i < e.touches.length; i++) {
        const touch = e.touches[i];
        const initial = initialPositions.get(touch.identifier);
        if (initial) {
          const dx = touch.clientX - initial.x;
          const dy = touch.clientY - initial.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance > TAP_MOVE_THRESHOLD) {
            hasMoved = true;
            return;
          }
        }
      }
    }

    function handleTouchEnd(e: TouchEvent) {
      if (!enabled) return;

      // Only process when all fingers are lifted
      if (e.touches.length > 0) {
        // Update touch count for remaining fingers
        initialTouchCount = e.touches.length;
        return;
      }

      // All fingers lifted - check if it was a valid tap
      const duration = Date.now() - touchStartTime;
      const wasQuickTap = duration <= TAP_MAX_DURATION;
      const didNotMove = !hasMoved;

      if (wasQuickTap && didNotMove) {
        // Determine which callback to fire based on max finger count
        if (maxTouchCount === 2 && callbacks?.onTwoFingerTap) {
          callbacks.onTwoFingerTap();
        } else if (maxTouchCount === 3 && callbacks?.onThreeFingerTap) {
          callbacks.onThreeFingerTap();
        }
      }

      // Reset state for next gesture
      initialTouchCount = 0;
      maxTouchCount = 0;
      initialPositions.clear();
      hasMoved = false;
    }

    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: true });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [
    containerRef,
    enabled,
    callbacks?.onTwoFingerTap,
    callbacks?.onThreeFingerTap,
  ]);
}
