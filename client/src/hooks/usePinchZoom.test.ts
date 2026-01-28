import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePinchZoom } from "./usePinchZoom";

function makeTouchEvent(
  type: string,
  touches: Array<{ clientX: number; clientY: number }>,
): TouchEvent {
  const touchList = touches.map(
    (t) =>
      ({
        clientX: t.clientX,
        clientY: t.clientY,
      }) as Touch,
  );
  const event = new Event(type, { bubbles: true }) as unknown as TouchEvent;
  Object.defineProperty(event, "touches", { value: touchList });
  // Attach preventDefault for touchmove assertions
  (event as { preventDefault: () => void }).preventDefault = vi.fn();
  return event;
}

function createContainer(): HTMLDivElement {
  const el = document.createElement("div");
  // Simulate a 400×600 container positioned at (50, 100)
  vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
    left: 50,
    top: 100,
    right: 450,
    bottom: 700,
    width: 400,
    height: 600,
    x: 50,
    y: 100,
    toJSON: () => ({}),
  });
  document.body.appendChild(el);
  return el;
}

describe("usePinchZoom", () => {
  let container: HTMLDivElement;
  let transform: { x: number; y: number; scale: number };
  let setTransform: (t: { x: number; y: number; scale: number }) => void;
  let setTransformSpy: ReturnType<typeof vi.fn<(t: { x: number; y: number; scale: number }) => void>>;
  let getTransform: () => { x: number; y: number; scale: number };
  let containerRef: { current: HTMLDivElement | null };

  beforeEach(() => {
    container = createContainer();
    transform = { x: 0, y: 0, scale: 1 };
    setTransformSpy = vi.fn<(t: { x: number; y: number; scale: number }) => void>((t) => {
      transform = t;
    });
    setTransform = setTransformSpy;
    getTransform = () => transform;
    containerRef = { current: container };
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  it("does nothing for single-finger touches", () => {
    renderHook(() => usePinchZoom(containerRef, getTransform, setTransform));

    act(() => {
      container.dispatchEvent(
        makeTouchEvent("touchstart", [{ clientX: 100, clientY: 200 }]),
      );
    });

    act(() => {
      container.dispatchEvent(
        makeTouchEvent("touchmove", [{ clientX: 110, clientY: 210 }]),
      );
    });

    expect(setTransformSpy).not.toHaveBeenCalled();
  });

  it("zooms in when fingers spread apart", () => {
    renderHook(() => usePinchZoom(containerRef, getTransform, setTransform));

    // Two fingers 100px apart
    act(() => {
      container.dispatchEvent(
        makeTouchEvent("touchstart", [
          { clientX: 200, clientY: 300 },
          { clientX: 300, clientY: 300 },
        ]),
      );
    });

    // Spread to 200px apart (2x zoom)
    act(() => {
      container.dispatchEvent(
        makeTouchEvent("touchmove", [
          { clientX: 150, clientY: 300 },
          { clientX: 350, clientY: 300 },
        ]),
      );
    });

    expect(setTransformSpy).toHaveBeenCalledTimes(1);
    const result = setTransformSpy.mock.calls[0][0];
    expect(result.scale).toBeCloseTo(2.0, 1);
  });

  it("zooms out when fingers pinch closer", () => {
    transform = { x: 0, y: 0, scale: 2 };
    renderHook(() => usePinchZoom(containerRef, getTransform, setTransform));

    // Two fingers 200px apart
    act(() => {
      container.dispatchEvent(
        makeTouchEvent("touchstart", [
          { clientX: 150, clientY: 300 },
          { clientX: 350, clientY: 300 },
        ]),
      );
    });

    // Pinch to 100px apart (0.5x ratio, scale goes from 2 to 1)
    act(() => {
      container.dispatchEvent(
        makeTouchEvent("touchmove", [
          { clientX: 200, clientY: 300 },
          { clientX: 300, clientY: 300 },
        ]),
      );
    });

    expect(setTransformSpy).toHaveBeenCalledTimes(1);
    const result = setTransformSpy.mock.calls[0][0];
    expect(result.scale).toBeCloseTo(1.0, 1);
  });

  it("clamps scale to minScale", () => {
    transform = { x: 0, y: 0, scale: 0.5 };
    renderHook(() =>
      usePinchZoom(containerRef, getTransform, setTransform, {
        minScale: 0.3,
      }),
    );

    // Start with fingers 200px apart
    act(() => {
      container.dispatchEvent(
        makeTouchEvent("touchstart", [
          { clientX: 150, clientY: 300 },
          { clientX: 350, clientY: 300 },
        ]),
      );
    });

    // Pinch to 20px apart (0.1x ratio -> scale would be 0.05, should clamp to 0.3)
    act(() => {
      container.dispatchEvent(
        makeTouchEvent("touchmove", [
          { clientX: 240, clientY: 300 },
          { clientX: 260, clientY: 300 },
        ]),
      );
    });

    expect(setTransformSpy).toHaveBeenCalledTimes(1);
    const result = setTransformSpy.mock.calls[0][0];
    expect(result.scale).toBe(0.3);
  });

  it("clamps scale to maxScale", () => {
    transform = { x: 0, y: 0, scale: 2 };
    renderHook(() =>
      usePinchZoom(containerRef, getTransform, setTransform, {
        maxScale: 3,
      }),
    );

    // Start with fingers 50px apart
    act(() => {
      container.dispatchEvent(
        makeTouchEvent("touchstart", [
          { clientX: 225, clientY: 300 },
          { clientX: 275, clientY: 300 },
        ]),
      );
    });

    // Spread to 400px apart (8x ratio -> scale would be 16, should clamp to 3)
    act(() => {
      container.dispatchEvent(
        makeTouchEvent("touchmove", [
          { clientX: 50, clientY: 300 },
          { clientX: 450, clientY: 300 },
        ]),
      );
    });

    expect(setTransformSpy).toHaveBeenCalledTimes(1);
    const result = setTransformSpy.mock.calls[0][0];
    expect(result.scale).toBe(3);
  });

  it("prevents default on touchmove during pinch", () => {
    renderHook(() => usePinchZoom(containerRef, getTransform, setTransform));

    act(() => {
      container.dispatchEvent(
        makeTouchEvent("touchstart", [
          { clientX: 200, clientY: 300 },
          { clientX: 300, clientY: 300 },
        ]),
      );
    });

    const moveEvent = makeTouchEvent("touchmove", [
      { clientX: 180, clientY: 300 },
      { clientX: 320, clientY: 300 },
    ]);
    act(() => {
      container.dispatchEvent(moveEvent);
    });

    expect((moveEvent as unknown as { preventDefault: ReturnType<typeof vi.fn> }).preventDefault).toHaveBeenCalled();
  });

  it("deactivates pinch when a finger is lifted", () => {
    renderHook(() => usePinchZoom(containerRef, getTransform, setTransform));

    // Start pinch
    act(() => {
      container.dispatchEvent(
        makeTouchEvent("touchstart", [
          { clientX: 200, clientY: 300 },
          { clientX: 300, clientY: 300 },
        ]),
      );
    });

    // Lift one finger (1 touch remaining)
    act(() => {
      container.dispatchEvent(
        makeTouchEvent("touchend", [{ clientX: 200, clientY: 300 }]),
      );
    });

    // Subsequent move with 2 touches should NOT trigger setTransform
    // because active was reset and no new touchstart with 2 fingers occurred
    act(() => {
      container.dispatchEvent(
        makeTouchEvent("touchmove", [
          { clientX: 180, clientY: 300 },
          { clientX: 320, clientY: 300 },
        ]),
      );
    });

    expect(setTransformSpy).not.toHaveBeenCalled();
  });

  it("adjusts pan to keep pinch midpoint stable", () => {
    transform = { x: 0, y: 0, scale: 1 };
    renderHook(() => usePinchZoom(containerRef, getTransform, setTransform));

    // Two fingers at (200,300) and (300,300) -> midpoint at (250,300)
    // Container starts at (50,100) so midpoint relative to container is (200,200)
    act(() => {
      container.dispatchEvent(
        makeTouchEvent("touchstart", [
          { clientX: 200, clientY: 300 },
          { clientX: 300, clientY: 300 },
        ]),
      );
    });

    // Spread to double distance: 2x scale
    act(() => {
      container.dispatchEvent(
        makeTouchEvent("touchmove", [
          { clientX: 150, clientY: 300 },
          { clientX: 350, clientY: 300 },
        ]),
      );
    });

    const result = setTransformSpy.mock.calls[0][0];
    expect(result.scale).toBeCloseTo(2.0, 1);
    // Midpoint relative to container: (250-50, 300-100) = (200, 200)
    // Pan formula: midX - (midX - initialX) * scaleChange = 200 - (200 - 0) * 2 = -200
    expect(result.x).toBeCloseTo(-200, 0);
    expect(result.y).toBeCloseTo(-200, 0);
  });

  it("cleans up event listeners on unmount", () => {
    const removeSpy = vi.spyOn(container, "removeEventListener");
    const { unmount } = renderHook(() =>
      usePinchZoom(containerRef, getTransform, setTransform),
    );

    unmount();

    const removedEvents = removeSpy.mock.calls.map((c) => c[0]);
    expect(removedEvents).toContain("touchstart");
    expect(removedEvents).toContain("touchmove");
    expect(removedEvents).toContain("touchend");
  });

  it("does nothing when container ref is null", () => {
    const nullRef = { current: null };
    const addSpy = vi.spyOn(container, "addEventListener");

    renderHook(() => usePinchZoom(nullRef, getTransform, setTransform));

    // Should not have added listeners to any element
    expect(addSpy).not.toHaveBeenCalled();
  });

  it("uses default min/max scales when options not provided", () => {
    // Default maxScale is 5.0, start at scale 4
    transform = { x: 0, y: 0, scale: 4 };
    renderHook(() => usePinchZoom(containerRef, getTransform, setTransform));

    // Fingers 100px apart
    act(() => {
      container.dispatchEvent(
        makeTouchEvent("touchstart", [
          { clientX: 200, clientY: 300 },
          { clientX: 300, clientY: 300 },
        ]),
      );
    });

    // Spread to 200px (2x ratio -> scale would be 8, should clamp to default 5.0)
    act(() => {
      container.dispatchEvent(
        makeTouchEvent("touchmove", [
          { clientX: 150, clientY: 300 },
          { clientX: 350, clientY: 300 },
        ]),
      );
    });

    const result = setTransformSpy.mock.calls[0][0];
    expect(result.scale).toBe(5.0);
  });

  it("fires onDoubleTap for two quick two-finger taps without movement", () => {
    const onDoubleTap = vi.fn();
    renderHook(() =>
      usePinchZoom(containerRef, getTransform, setTransform, { onDoubleTap }),
    );

    // First two-finger tap
    act(() => {
      container.dispatchEvent(
        makeTouchEvent("touchstart", [
          { clientX: 200, clientY: 300 },
          { clientX: 300, clientY: 300 },
        ]),
      );
    });
    act(() => {
      container.dispatchEvent(makeTouchEvent("touchend", []));
    });

    // Second two-finger tap (within DOUBLE_TAP_DELAY)
    act(() => {
      container.dispatchEvent(
        makeTouchEvent("touchstart", [
          { clientX: 200, clientY: 300 },
          { clientX: 300, clientY: 300 },
        ]),
      );
    });
    act(() => {
      container.dispatchEvent(makeTouchEvent("touchend", []));
    });

    expect(onDoubleTap).toHaveBeenCalledTimes(1);
  });

  it("does not fire onDoubleTap when fingers moved significantly", () => {
    const onDoubleTap = vi.fn();
    renderHook(() =>
      usePinchZoom(containerRef, getTransform, setTransform, { onDoubleTap }),
    );

    // First tap: fingers 100px apart, then spread to 200px (significant movement)
    act(() => {
      container.dispatchEvent(
        makeTouchEvent("touchstart", [
          { clientX: 200, clientY: 300 },
          { clientX: 300, clientY: 300 },
        ]),
      );
    });
    act(() => {
      container.dispatchEvent(
        makeTouchEvent("touchmove", [
          { clientX: 150, clientY: 300 },
          { clientX: 350, clientY: 300 },
        ]),
      );
    });
    act(() => {
      container.dispatchEvent(makeTouchEvent("touchend", []));
    });

    // Second tap
    act(() => {
      container.dispatchEvent(
        makeTouchEvent("touchstart", [
          { clientX: 200, clientY: 300 },
          { clientX: 300, clientY: 300 },
        ]),
      );
    });
    act(() => {
      container.dispatchEvent(makeTouchEvent("touchend", []));
    });

    expect(onDoubleTap).not.toHaveBeenCalled();
  });

  it("does not fire onDoubleTap when taps are too far apart in time", () => {
    const onDoubleTap = vi.fn();
    vi.useFakeTimers();

    renderHook(() =>
      usePinchZoom(containerRef, getTransform, setTransform, { onDoubleTap }),
    );

    // First tap
    act(() => {
      container.dispatchEvent(
        makeTouchEvent("touchstart", [
          { clientX: 200, clientY: 300 },
          { clientX: 300, clientY: 300 },
        ]),
      );
    });
    act(() => {
      container.dispatchEvent(makeTouchEvent("touchend", []));
    });

    // Wait longer than DOUBLE_TAP_DELAY (300ms)
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Second tap
    act(() => {
      container.dispatchEvent(
        makeTouchEvent("touchstart", [
          { clientX: 200, clientY: 300 },
          { clientX: 300, clientY: 300 },
        ]),
      );
    });
    act(() => {
      container.dispatchEvent(makeTouchEvent("touchend", []));
    });

    expect(onDoubleTap).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("re-attaches listeners when options change", () => {
    const addSpy = vi.spyOn(container, "addEventListener");
    const removeSpy = vi.spyOn(container, "removeEventListener");

    const { rerender } = renderHook(
      ({ minScale }: { minScale: number }) =>
        usePinchZoom(containerRef, getTransform, setTransform, {
          minScale,
          maxScale: 5,
        }),
      { initialProps: { minScale: 0.1 } },
    );

    const addCountBefore = addSpy.mock.calls.length;
    const removeCountBefore = removeSpy.mock.calls.length;

    rerender({ minScale: 0.5 });

    // Should have removed old listeners and added new ones
    expect(removeSpy.mock.calls.length).toBeGreaterThan(removeCountBefore);
    expect(addSpy.mock.calls.length).toBeGreaterThan(addCountBefore);
  });
});
