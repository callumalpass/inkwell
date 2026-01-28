import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCanvasTransform } from "./useCanvasTransform";
import { useViewStore } from "../stores/view-store";
import { CANVAS_MIN_ZOOM, CANVAS_MAX_ZOOM } from "../lib/constants";

/**
 * Build a minimal WheelEvent-like object that `onWheel` can consume.
 * jsdom's WheelEvent constructor is incomplete, so we construct it manually.
 */
function makeWheelEvent(
  overrides: Partial<{
    deltaX: number;
    deltaY: number;
    ctrlKey: boolean;
    metaKey: boolean;
    clientX: number;
    clientY: number;
  }> = {},
): React.WheelEvent {
  return {
    deltaX: 0,
    deltaY: 0,
    ctrlKey: false,
    metaKey: false,
    clientX: 0,
    clientY: 0,
    ...overrides,
    preventDefault: vi.fn(),
    currentTarget: {
      getBoundingClientRect: () => ({
        left: 0,
        top: 0,
        right: 800,
        bottom: 600,
        width: 800,
        height: 600,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    },
  } as unknown as React.WheelEvent;
}

/**
 * Build a minimal PointerEvent-like object for pointer handler tests.
 */
function makePointerEvent(
  overrides: Partial<{
    button: number;
    clientX: number;
    clientY: number;
    pointerId: number;
  }> = {},
  /** When true, currentTarget === target (simulates clicking canvas background) */
  targetIsBackground = false,
): React.PointerEvent<HTMLElement> {
  const element = {
    setPointerCapture: vi.fn(),
  } as unknown as HTMLElement;

  return {
    button: 0,
    clientX: 0,
    clientY: 0,
    pointerId: 1,
    ...overrides,
    currentTarget: element,
    target: targetIsBackground ? element : ({} as EventTarget),
    preventDefault: vi.fn(),
  } as unknown as React.PointerEvent<HTMLElement>;
}

describe("useCanvasTransform", () => {
  beforeEach(() => {
    // Reset the view store to default state before each test
    useViewStore.setState({
      canvasTransform: { x: 0, y: 0, scale: 1 },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Wheel pan (no modifier key)
  // ---------------------------------------------------------------------------

  describe("wheel pan", () => {
    it("pans by deltaX and deltaY when no modifier key is held", () => {
      const { result } = renderHook(() => useCanvasTransform());

      act(() => {
        result.current.onWheel(makeWheelEvent({ deltaX: 30, deltaY: 20 }));
      });

      const { canvasTransform } = useViewStore.getState();
      expect(canvasTransform.x).toBe(-30);
      expect(canvasTransform.y).toBe(-20);
      expect(canvasTransform.scale).toBe(1);
    });

    it("accumulates multiple pan events", () => {
      const { result } = renderHook(() => useCanvasTransform());

      act(() => {
        result.current.onWheel(makeWheelEvent({ deltaX: 10, deltaY: 5 }));
      });
      act(() => {
        result.current.onWheel(makeWheelEvent({ deltaX: -20, deltaY: 15 }));
      });

      const { canvasTransform } = useViewStore.getState();
      expect(canvasTransform.x).toBe(10); // -10 + 20
      expect(canvasTransform.y).toBe(-20); // -5 + -15
    });

    it("does not change scale when panning", () => {
      useViewStore.setState({
        canvasTransform: { x: 0, y: 0, scale: 2 },
      });
      const { result } = renderHook(() => useCanvasTransform());

      act(() => {
        result.current.onWheel(makeWheelEvent({ deltaX: 50, deltaY: 50 }));
      });

      const { canvasTransform } = useViewStore.getState();
      expect(canvasTransform.scale).toBe(2);
    });

    it("prevents default on wheel events", () => {
      const { result } = renderHook(() => useCanvasTransform());
      const event = makeWheelEvent({ deltaX: 10, deltaY: 10 });

      act(() => {
        result.current.onWheel(event);
      });

      expect(event.preventDefault).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Wheel zoom (ctrl/meta held)
  // ---------------------------------------------------------------------------

  describe("wheel zoom", () => {
    it("zooms in when scrolling up with ctrl held", () => {
      const { result } = renderHook(() => useCanvasTransform());

      act(() => {
        result.current.onWheel(
          makeWheelEvent({ deltaY: -100, ctrlKey: true, clientX: 400, clientY: 300 }),
        );
      });

      const { canvasTransform } = useViewStore.getState();
      expect(canvasTransform.scale).toBeGreaterThan(1);
    });

    it("zooms out when scrolling down with ctrl held", () => {
      const { result } = renderHook(() => useCanvasTransform());

      act(() => {
        result.current.onWheel(
          makeWheelEvent({ deltaY: 100, ctrlKey: true, clientX: 400, clientY: 300 }),
        );
      });

      const { canvasTransform } = useViewStore.getState();
      expect(canvasTransform.scale).toBeLessThan(1);
    });

    it("zooms with metaKey the same as ctrlKey", () => {
      const { result } = renderHook(() => useCanvasTransform());

      act(() => {
        result.current.onWheel(
          makeWheelEvent({ deltaY: -100, metaKey: true, clientX: 400, clientY: 300 }),
        );
      });

      const { canvasTransform } = useViewStore.getState();
      expect(canvasTransform.scale).toBeGreaterThan(1);
    });

    it("applies zoom factor 0.9 when scrolling down", () => {
      const { result } = renderHook(() => useCanvasTransform());

      act(() => {
        result.current.onWheel(
          makeWheelEvent({ deltaY: 100, ctrlKey: true, clientX: 0, clientY: 0 }),
        );
      });

      expect(useViewStore.getState().canvasTransform.scale).toBeCloseTo(0.9, 5);
    });

    it("applies zoom factor 1.1 when scrolling up", () => {
      const { result } = renderHook(() => useCanvasTransform());

      act(() => {
        result.current.onWheel(
          makeWheelEvent({ deltaY: -100, ctrlKey: true, clientX: 0, clientY: 0 }),
        );
      });

      expect(useViewStore.getState().canvasTransform.scale).toBeCloseTo(1.1, 5);
    });

    it("zooms towards the cursor position", () => {
      // Start at scale 1, origin at (0,0). Cursor at (400,300) relative to
      // the element (which starts at (0,0) per our mock).
      const { result } = renderHook(() => useCanvasTransform());

      act(() => {
        result.current.onWheel(
          makeWheelEvent({ deltaY: -100, ctrlKey: true, clientX: 400, clientY: 300 }),
        );
      });

      const { canvasTransform } = useViewStore.getState();
      const expectedScale = 1.1;
      const scaleChange = expectedScale / 1;
      // x = cursorX - (cursorX - oldX) * scaleChange = 400 - 400 * 1.1 = -40
      expect(canvasTransform.x).toBeCloseTo(400 - 400 * scaleChange, 5);
      // y = cursorY - (cursorY - oldY) * scaleChange = 300 - 300 * 1.1 = -30
      expect(canvasTransform.y).toBeCloseTo(300 - 300 * scaleChange, 5);
    });

    it("preserves cursor position through zoom when not at origin", () => {
      useViewStore.setState({
        canvasTransform: { x: 100, y: 50, scale: 1.5 },
      });
      const { result } = renderHook(() => useCanvasTransform());

      act(() => {
        result.current.onWheel(
          makeWheelEvent({ deltaY: -100, ctrlKey: true, clientX: 200, clientY: 150 }),
        );
      });

      const { canvasTransform } = useViewStore.getState();
      const expectedScale = 1.5 * 1.1;
      const scaleChange = expectedScale / 1.5;
      const expectedX = 200 - (200 - 100) * scaleChange;
      const expectedY = 150 - (150 - 50) * scaleChange;
      expect(canvasTransform.scale).toBeCloseTo(expectedScale, 5);
      expect(canvasTransform.x).toBeCloseTo(expectedX, 5);
      expect(canvasTransform.y).toBeCloseTo(expectedY, 5);
    });
  });

  // ---------------------------------------------------------------------------
  // Zoom clamping
  // ---------------------------------------------------------------------------

  describe("zoom clamping", () => {
    it("clamps zoom at CANVAS_MAX_ZOOM when zooming in", () => {
      useViewStore.setState({
        canvasTransform: { x: 0, y: 0, scale: CANVAS_MAX_ZOOM },
      });
      const { result } = renderHook(() => useCanvasTransform());

      act(() => {
        result.current.onWheel(
          makeWheelEvent({ deltaY: -100, ctrlKey: true, clientX: 0, clientY: 0 }),
        );
      });

      const { canvasTransform } = useViewStore.getState();
      expect(canvasTransform.scale).toBe(CANVAS_MAX_ZOOM);
    });

    it("clamps zoom at CANVAS_MIN_ZOOM when zooming out", () => {
      useViewStore.setState({
        canvasTransform: { x: 0, y: 0, scale: CANVAS_MIN_ZOOM },
      });
      const { result } = renderHook(() => useCanvasTransform());

      act(() => {
        result.current.onWheel(
          makeWheelEvent({ deltaY: 100, ctrlKey: true, clientX: 0, clientY: 0 }),
        );
      });

      const { canvasTransform } = useViewStore.getState();
      expect(canvasTransform.scale).toBe(CANVAS_MIN_ZOOM);
    });

    it("does not overshoot max zoom from a value just below it", () => {
      const almostMax = CANVAS_MAX_ZOOM / 1.05; // close to max but below
      useViewStore.setState({
        canvasTransform: { x: 0, y: 0, scale: almostMax },
      });
      const { result } = renderHook(() => useCanvasTransform());

      // Zoom in with factor 1.1 — would exceed max
      act(() => {
        result.current.onWheel(
          makeWheelEvent({ deltaY: -100, ctrlKey: true, clientX: 0, clientY: 0 }),
        );
      });

      const { canvasTransform } = useViewStore.getState();
      expect(canvasTransform.scale).toBeLessThanOrEqual(CANVAS_MAX_ZOOM);
    });

    it("does not undershoot min zoom from a value just above it", () => {
      const almostMin = CANVAS_MIN_ZOOM * 1.05;
      useViewStore.setState({
        canvasTransform: { x: 0, y: 0, scale: almostMin },
      });
      const { result } = renderHook(() => useCanvasTransform());

      // Zoom out with factor 0.9 — would go below min
      act(() => {
        result.current.onWheel(
          makeWheelEvent({ deltaY: 100, ctrlKey: true, clientX: 0, clientY: 0 }),
        );
      });

      const { canvasTransform } = useViewStore.getState();
      expect(canvasTransform.scale).toBeGreaterThanOrEqual(CANVAS_MIN_ZOOM);
    });
  });

  // ---------------------------------------------------------------------------
  // Pointer drag (panning)
  // ---------------------------------------------------------------------------

  describe("pointer drag pan", () => {
    it("starts panning on middle mouse button", () => {
      const { result } = renderHook(() => useCanvasTransform());
      const event = makePointerEvent({ button: 1, clientX: 100, clientY: 100 });

      act(() => {
        result.current.onPointerDown(event);
      });

      expect(
        (event.currentTarget as unknown as { setPointerCapture: ReturnType<typeof vi.fn> })
          .setPointerCapture,
      ).toHaveBeenCalledWith(1);
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it("starts panning on left click when target is canvas background", () => {
      const { result } = renderHook(() => useCanvasTransform());
      const event = makePointerEvent(
        { button: 0, clientX: 100, clientY: 100 },
        true, // target === currentTarget (background)
      );

      act(() => {
        result.current.onPointerDown(event);
      });

      expect(
        (event.currentTarget as unknown as { setPointerCapture: ReturnType<typeof vi.fn> })
          .setPointerCapture,
      ).toHaveBeenCalled();
    });

    it("does not start panning on left click when target is a child element", () => {
      const { result } = renderHook(() => useCanvasTransform());
      const event = makePointerEvent(
        { button: 0, clientX: 100, clientY: 100 },
        false, // target !== currentTarget (clicking a child)
      );

      act(() => {
        result.current.onPointerDown(event);
      });

      expect(
        (event.currentTarget as unknown as { setPointerCapture: ReturnType<typeof vi.fn> })
          .setPointerCapture,
      ).not.toHaveBeenCalled();
    });

    it("does not start panning for right-click", () => {
      const { result } = renderHook(() => useCanvasTransform());
      const event = makePointerEvent({ button: 2 });

      act(() => {
        result.current.onPointerDown(event);
      });

      expect(
        (event.currentTarget as unknown as { setPointerCapture: ReturnType<typeof vi.fn> })
          .setPointerCapture,
      ).not.toHaveBeenCalled();
    });

    it("updates transform during drag", () => {
      const { result } = renderHook(() => useCanvasTransform());

      // Start drag
      const downEvent = makePointerEvent({ button: 1, clientX: 100, clientY: 100 });
      act(() => {
        result.current.onPointerDown(downEvent);
      });

      // Move pointer
      const moveEvent = makePointerEvent({ clientX: 150, clientY: 130 });
      act(() => {
        result.current.onPointerMove(moveEvent);
      });

      const { canvasTransform } = useViewStore.getState();
      expect(canvasTransform.x).toBe(50); // 150 - 100
      expect(canvasTransform.y).toBe(30); // 130 - 100
    });

    it("accumulates drag across multiple pointer moves", () => {
      const { result } = renderHook(() => useCanvasTransform());

      // Start drag
      act(() => {
        result.current.onPointerDown(
          makePointerEvent({ button: 1, clientX: 100, clientY: 100 }),
        );
      });

      // First move
      act(() => {
        result.current.onPointerMove(makePointerEvent({ clientX: 120, clientY: 110 }));
      });

      // Second move
      act(() => {
        result.current.onPointerMove(makePointerEvent({ clientX: 160, clientY: 140 }));
      });

      const { canvasTransform } = useViewStore.getState();
      // Total delta: (160-100, 140-100) = (60, 40)
      expect(canvasTransform.x).toBe(60);
      expect(canvasTransform.y).toBe(40);
    });

    it("ignores pointer move when not panning", () => {
      const { result } = renderHook(() => useCanvasTransform());

      // Move without starting a drag
      act(() => {
        result.current.onPointerMove(makePointerEvent({ clientX: 200, clientY: 200 }));
      });

      const { canvasTransform } = useViewStore.getState();
      expect(canvasTransform.x).toBe(0);
      expect(canvasTransform.y).toBe(0);
    });

    it("stops panning on pointer up", () => {
      const { result } = renderHook(() => useCanvasTransform());

      // Start drag
      act(() => {
        result.current.onPointerDown(
          makePointerEvent({ button: 1, clientX: 100, clientY: 100 }),
        );
      });

      // End drag
      act(() => {
        result.current.onPointerUp();
      });

      // Subsequent move should not pan
      act(() => {
        result.current.onPointerMove(makePointerEvent({ clientX: 200, clientY: 200 }));
      });

      const { canvasTransform } = useViewStore.getState();
      expect(canvasTransform.x).toBe(0);
      expect(canvasTransform.y).toBe(0);
    });

    it("preserves scale during drag", () => {
      useViewStore.setState({
        canvasTransform: { x: 0, y: 0, scale: 2.5 },
      });
      const { result } = renderHook(() => useCanvasTransform());

      act(() => {
        result.current.onPointerDown(
          makePointerEvent({ button: 1, clientX: 0, clientY: 0 }),
        );
      });
      act(() => {
        result.current.onPointerMove(makePointerEvent({ clientX: 50, clientY: 50 }));
      });

      const { canvasTransform } = useViewStore.getState();
      expect(canvasTransform.scale).toBe(2.5);
    });
  });

  // ---------------------------------------------------------------------------
  // Combined operations
  // ---------------------------------------------------------------------------

  describe("combined zoom and pan", () => {
    it("can pan after zooming", () => {
      const { result } = renderHook(() => useCanvasTransform());

      // Zoom in first
      act(() => {
        result.current.onWheel(
          makeWheelEvent({ deltaY: -100, ctrlKey: true, clientX: 0, clientY: 0 }),
        );
      });

      const afterZoom = { ...useViewStore.getState().canvasTransform };

      // Then pan
      act(() => {
        result.current.onWheel(makeWheelEvent({ deltaX: 10, deltaY: 20 }));
      });

      const afterPan = useViewStore.getState().canvasTransform;
      expect(afterPan.scale).toBeCloseTo(afterZoom.scale, 5);
      expect(afterPan.x).toBeCloseTo(afterZoom.x - 10, 5);
      expect(afterPan.y).toBeCloseTo(afterZoom.y - 20, 5);
    });
  });

  // ---------------------------------------------------------------------------
  // Return value stability
  // ---------------------------------------------------------------------------

  describe("return value", () => {
    it("returns all four event handlers", () => {
      const { result } = renderHook(() => useCanvasTransform());

      expect(result.current.onWheel).toBeTypeOf("function");
      expect(result.current.onPointerDown).toBeTypeOf("function");
      expect(result.current.onPointerMove).toBeTypeOf("function");
      expect(result.current.onPointerUp).toBeTypeOf("function");
    });

    it("onPointerDown and onPointerUp have stable references across re-renders", () => {
      const { result, rerender } = renderHook(() => useCanvasTransform());

      const firstDown = result.current.onPointerDown;
      const firstUp = result.current.onPointerUp;

      rerender();

      // These have empty/no-store dependency arrays, so they should be stable
      expect(result.current.onPointerDown).toBe(firstDown);
      expect(result.current.onPointerUp).toBe(firstUp);
    });
  });
});
