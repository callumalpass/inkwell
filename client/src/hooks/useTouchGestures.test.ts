import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTouchGestures } from "./useTouchGestures";

function makeTouchEvent(
  type: string,
  touches: Array<{ identifier: number; clientX: number; clientY: number }>,
): TouchEvent {
  const touchList = touches.map(
    (t) =>
      ({
        identifier: t.identifier,
        clientX: t.clientX,
        clientY: t.clientY,
      }) as Touch,
  );
  const event = new Event(type, { bubbles: true }) as unknown as TouchEvent;
  Object.defineProperty(event, "touches", { value: touchList });
  return event;
}

function createContainer(): HTMLDivElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
}

describe("useTouchGestures", () => {
  let container: HTMLDivElement;
  let containerRef: { current: HTMLDivElement | null };

  beforeEach(() => {
    container = createContainer();
    containerRef = { current: container };
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  it("fires onTwoFingerTap for a quick two-finger tap without movement", () => {
    const onTwoFingerTap = vi.fn();
    renderHook(() =>
      useTouchGestures(containerRef, { onTwoFingerTap }),
    );

    // Two fingers down
    act(() => {
      container.dispatchEvent(
        makeTouchEvent("touchstart", [
          { identifier: 0, clientX: 100, clientY: 100 },
          { identifier: 1, clientX: 200, clientY: 100 },
        ]),
      );
    });

    // Both fingers up
    act(() => {
      container.dispatchEvent(makeTouchEvent("touchend", []));
    });

    expect(onTwoFingerTap).toHaveBeenCalledTimes(1);
  });

  it("fires onThreeFingerTap for a quick three-finger tap without movement", () => {
    const onThreeFingerTap = vi.fn();
    renderHook(() =>
      useTouchGestures(containerRef, { onThreeFingerTap }),
    );

    // Three fingers down
    act(() => {
      container.dispatchEvent(
        makeTouchEvent("touchstart", [
          { identifier: 0, clientX: 100, clientY: 100 },
          { identifier: 1, clientX: 200, clientY: 100 },
          { identifier: 2, clientX: 300, clientY: 100 },
        ]),
      );
    });

    // All fingers up
    act(() => {
      container.dispatchEvent(makeTouchEvent("touchend", []));
    });

    expect(onThreeFingerTap).toHaveBeenCalledTimes(1);
  });

  it("does not fire for single-finger tap", () => {
    const onTwoFingerTap = vi.fn();
    const onThreeFingerTap = vi.fn();
    renderHook(() =>
      useTouchGestures(containerRef, { onTwoFingerTap, onThreeFingerTap }),
    );

    // One finger down
    act(() => {
      container.dispatchEvent(
        makeTouchEvent("touchstart", [
          { identifier: 0, clientX: 100, clientY: 100 },
        ]),
      );
    });

    // Finger up
    act(() => {
      container.dispatchEvent(makeTouchEvent("touchend", []));
    });

    expect(onTwoFingerTap).not.toHaveBeenCalled();
    expect(onThreeFingerTap).not.toHaveBeenCalled();
  });

  it("does not fire if fingers moved significantly", () => {
    const onTwoFingerTap = vi.fn();
    renderHook(() =>
      useTouchGestures(containerRef, { onTwoFingerTap }),
    );

    // Two fingers down
    act(() => {
      container.dispatchEvent(
        makeTouchEvent("touchstart", [
          { identifier: 0, clientX: 100, clientY: 100 },
          { identifier: 1, clientX: 200, clientY: 100 },
        ]),
      );
    });

    // Move fingers significantly (> 20px threshold)
    act(() => {
      container.dispatchEvent(
        makeTouchEvent("touchmove", [
          { identifier: 0, clientX: 100, clientY: 100 },
          { identifier: 1, clientX: 250, clientY: 100 }, // moved 50px
        ]),
      );
    });

    // Fingers up
    act(() => {
      container.dispatchEvent(makeTouchEvent("touchend", []));
    });

    expect(onTwoFingerTap).not.toHaveBeenCalled();
  });

  it("does not fire if tap duration exceeds threshold", () => {
    vi.useFakeTimers();
    const onTwoFingerTap = vi.fn();
    renderHook(() =>
      useTouchGestures(containerRef, { onTwoFingerTap }),
    );

    // Two fingers down
    act(() => {
      container.dispatchEvent(
        makeTouchEvent("touchstart", [
          { identifier: 0, clientX: 100, clientY: 100 },
          { identifier: 1, clientX: 200, clientY: 100 },
        ]),
      );
    });

    // Wait longer than TAP_MAX_DURATION (300ms)
    act(() => {
      vi.advanceTimersByTime(400);
    });

    // Fingers up
    act(() => {
      container.dispatchEvent(makeTouchEvent("touchend", []));
    });

    expect(onTwoFingerTap).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("handles incremental finger placement (two fingers placed sequentially)", () => {
    const onTwoFingerTap = vi.fn();
    renderHook(() =>
      useTouchGestures(containerRef, { onTwoFingerTap }),
    );

    // First finger down
    act(() => {
      container.dispatchEvent(
        makeTouchEvent("touchstart", [
          { identifier: 0, clientX: 100, clientY: 100 },
        ]),
      );
    });

    // Second finger down (both fingers now present)
    act(() => {
      container.dispatchEvent(
        makeTouchEvent("touchstart", [
          { identifier: 0, clientX: 100, clientY: 100 },
          { identifier: 1, clientX: 200, clientY: 100 },
        ]),
      );
    });

    // Both fingers up
    act(() => {
      container.dispatchEvent(makeTouchEvent("touchend", []));
    });

    expect(onTwoFingerTap).toHaveBeenCalledTimes(1);
  });

  it("does not fire when enabled is false", () => {
    const onTwoFingerTap = vi.fn();
    renderHook(() =>
      useTouchGestures(containerRef, { onTwoFingerTap, enabled: false }),
    );

    // Two fingers down
    act(() => {
      container.dispatchEvent(
        makeTouchEvent("touchstart", [
          { identifier: 0, clientX: 100, clientY: 100 },
          { identifier: 1, clientX: 200, clientY: 100 },
        ]),
      );
    });

    // Fingers up
    act(() => {
      container.dispatchEvent(makeTouchEvent("touchend", []));
    });

    expect(onTwoFingerTap).not.toHaveBeenCalled();
  });

  it("cleans up event listeners on unmount", () => {
    const removeSpy = vi.spyOn(container, "removeEventListener");
    const { unmount } = renderHook(() =>
      useTouchGestures(containerRef, { onTwoFingerTap: vi.fn() }),
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

    renderHook(() =>
      useTouchGestures(nullRef, { onTwoFingerTap: vi.fn() }),
    );

    expect(addSpy).not.toHaveBeenCalled();
  });

  it("allows small movement within threshold", () => {
    const onTwoFingerTap = vi.fn();
    renderHook(() =>
      useTouchGestures(containerRef, { onTwoFingerTap }),
    );

    // Two fingers down
    act(() => {
      container.dispatchEvent(
        makeTouchEvent("touchstart", [
          { identifier: 0, clientX: 100, clientY: 100 },
          { identifier: 1, clientX: 200, clientY: 100 },
        ]),
      );
    });

    // Small movement (< 20px threshold)
    act(() => {
      container.dispatchEvent(
        makeTouchEvent("touchmove", [
          { identifier: 0, clientX: 105, clientY: 105 },
          { identifier: 1, clientX: 205, clientY: 105 },
        ]),
      );
    });

    // Fingers up
    act(() => {
      container.dispatchEvent(makeTouchEvent("touchend", []));
    });

    expect(onTwoFingerTap).toHaveBeenCalledTimes(1);
  });

  it("does not fire two-finger callback for three-finger tap", () => {
    const onTwoFingerTap = vi.fn();
    const onThreeFingerTap = vi.fn();
    renderHook(() =>
      useTouchGestures(containerRef, { onTwoFingerTap, onThreeFingerTap }),
    );

    // Three fingers down
    act(() => {
      container.dispatchEvent(
        makeTouchEvent("touchstart", [
          { identifier: 0, clientX: 100, clientY: 100 },
          { identifier: 1, clientX: 200, clientY: 100 },
          { identifier: 2, clientX: 300, clientY: 100 },
        ]),
      );
    });

    // All fingers up
    act(() => {
      container.dispatchEvent(makeTouchEvent("touchend", []));
    });

    expect(onTwoFingerTap).not.toHaveBeenCalled();
    expect(onThreeFingerTap).toHaveBeenCalledTimes(1);
  });

  it("resets state after a tap, allowing subsequent taps", () => {
    const onTwoFingerTap = vi.fn();
    renderHook(() =>
      useTouchGestures(containerRef, { onTwoFingerTap }),
    );

    // First tap
    act(() => {
      container.dispatchEvent(
        makeTouchEvent("touchstart", [
          { identifier: 0, clientX: 100, clientY: 100 },
          { identifier: 1, clientX: 200, clientY: 100 },
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
          { identifier: 2, clientX: 100, clientY: 100 },
          { identifier: 3, clientX: 200, clientY: 100 },
        ]),
      );
    });
    act(() => {
      container.dispatchEvent(makeTouchEvent("touchend", []));
    });

    expect(onTwoFingerTap).toHaveBeenCalledTimes(2);
  });

  it("does not fire for four or more finger taps", () => {
    const onTwoFingerTap = vi.fn();
    const onThreeFingerTap = vi.fn();
    renderHook(() =>
      useTouchGestures(containerRef, { onTwoFingerTap, onThreeFingerTap }),
    );

    // Four fingers down
    act(() => {
      container.dispatchEvent(
        makeTouchEvent("touchstart", [
          { identifier: 0, clientX: 100, clientY: 100 },
          { identifier: 1, clientX: 200, clientY: 100 },
          { identifier: 2, clientX: 300, clientY: 100 },
          { identifier: 3, clientX: 400, clientY: 100 },
        ]),
      );
    });

    // All fingers up
    act(() => {
      container.dispatchEvent(makeTouchEvent("touchend", []));
    });

    expect(onTwoFingerTap).not.toHaveBeenCalled();
    expect(onThreeFingerTap).not.toHaveBeenCalled();
  });

  it("handles partial finger lift correctly", () => {
    const onTwoFingerTap = vi.fn();
    renderHook(() =>
      useTouchGestures(containerRef, { onTwoFingerTap }),
    );

    // Two fingers down
    act(() => {
      container.dispatchEvent(
        makeTouchEvent("touchstart", [
          { identifier: 0, clientX: 100, clientY: 100 },
          { identifier: 1, clientX: 200, clientY: 100 },
        ]),
      );
    });

    // One finger up (one remaining)
    act(() => {
      container.dispatchEvent(
        makeTouchEvent("touchend", [
          { identifier: 0, clientX: 100, clientY: 100 },
        ]),
      );
    });

    // Should not fire yet - still one finger on screen
    expect(onTwoFingerTap).not.toHaveBeenCalled();

    // Last finger up
    act(() => {
      container.dispatchEvent(makeTouchEvent("touchend", []));
    });

    // Now it should fire since max was 2
    expect(onTwoFingerTap).toHaveBeenCalledTimes(1);
  });
});
