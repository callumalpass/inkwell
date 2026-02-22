import { useMemo, useCallback, useRef, useState } from "react";
import { useViewStore } from "../../stores/view-store";
import { PAGE_WIDTH, PAGE_HEIGHT } from "../../lib/constants";

const PAGE_RENDER_WIDTH = 400;
const PAGE_RENDER_HEIGHT = PAGE_RENDER_WIDTH * (PAGE_HEIGHT / PAGE_WIDTH);
const MINIMAP_WIDTH = 160;
const MINIMAP_HEIGHT = 120;
const MINIMAP_PADDING = 8;
const COLLAPSE_TAB_WIDTH = 20;

interface MinimapProps {
  pagePositions: { id: string; x: number; y: number }[];
  containerWidth: number;
  containerHeight: number;
}

export function Minimap({ pagePositions, containerWidth, containerHeight }: MinimapProps) {
  const canvasTransform = useViewStore((s) => s.canvasTransform);
  const setCanvasTransform = useViewStore((s) => s.setCanvasTransform);
  const [isDragging, setIsDragging] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const minimapRef = useRef<HTMLDivElement>(null);

  // Calculate the bounding box of all pages
  const bounds = useMemo(() => {
    if (pagePositions.length === 0) {
      return { minX: 0, minY: 0, maxX: PAGE_RENDER_WIDTH, maxY: PAGE_RENDER_HEIGHT };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const pos of pagePositions) {
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x + PAGE_RENDER_WIDTH);
      maxY = Math.max(maxY, pos.y + PAGE_RENDER_HEIGHT);
    }

    // Add padding around the bounds
    const paddingX = PAGE_RENDER_WIDTH * 0.5;
    const paddingY = PAGE_RENDER_HEIGHT * 0.5;
    return {
      minX: minX - paddingX,
      minY: minY - paddingY,
      maxX: maxX + paddingX,
      maxY: maxY + paddingY,
    };
  }, [pagePositions]);

  // Calculate scale to fit all content in the minimap
  const minimapScale = useMemo(() => {
    const contentWidth = bounds.maxX - bounds.minX;
    const contentHeight = bounds.maxY - bounds.minY;
    const availableWidth = MINIMAP_WIDTH - MINIMAP_PADDING * 2;
    const availableHeight = MINIMAP_HEIGHT - MINIMAP_PADDING * 2;
    return Math.min(
      availableWidth / contentWidth,
      availableHeight / contentHeight,
      1 // Don't scale up
    );
  }, [bounds]);

  // Convert canvas coordinates to minimap coordinates
  const toMinimapCoords = useCallback(
    (x: number, y: number) => {
      return {
        x: (x - bounds.minX) * minimapScale + MINIMAP_PADDING,
        y: (y - bounds.minY) * minimapScale + MINIMAP_PADDING,
      };
    },
    [bounds.minX, bounds.minY, minimapScale]
  );

  // Convert minimap coordinates to canvas coordinates
  const fromMinimapCoords = useCallback(
    (mx: number, my: number) => {
      return {
        x: (mx - MINIMAP_PADDING) / minimapScale + bounds.minX,
        y: (my - MINIMAP_PADDING) / minimapScale + bounds.minY,
      };
    },
    [bounds.minX, bounds.minY, minimapScale]
  );

  // Calculate viewport rectangle in minimap coordinates
  const viewport = useMemo(() => {
    const { x, y, scale } = canvasTransform;

    // The viewport shows what's visible in the container
    // Canvas coordinates of the visible area corners
    const viewLeft = -x / scale;
    const viewTop = -y / scale;
    const viewWidth = containerWidth / scale;
    const viewHeight = containerHeight / scale;

    const topLeft = toMinimapCoords(viewLeft, viewTop);
    return {
      x: topLeft.x,
      y: topLeft.y,
      width: viewWidth * minimapScale,
      height: viewHeight * minimapScale,
    };
  }, [canvasTransform, containerWidth, containerHeight, minimapScale, toMinimapCoords]);

  // Handle clicking/dragging on minimap to navigate
  const handleMinimapClick = useCallback(
    (e: React.MouseEvent | React.PointerEvent) => {
      const rect = minimapRef.current?.getBoundingClientRect();
      if (!rect) return;

      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const canvasCoords = fromMinimapCoords(mx, my);

      // Center the viewport on the clicked point
      const newX = -canvasCoords.x * canvasTransform.scale + containerWidth / 2;
      const newY = -canvasCoords.y * canvasTransform.scale + containerHeight / 2;

      setCanvasTransform({
        ...canvasTransform,
        x: newX,
        y: newY,
      });
    },
    [canvasTransform, containerWidth, containerHeight, fromMinimapCoords, setCanvasTransform]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      setIsDragging(true);
      const target = e.target as HTMLElement;
      if (target.setPointerCapture) {
        target.setPointerCapture(e.pointerId);
      }
      handleMinimapClick(e);
    },
    [handleMinimapClick]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      handleMinimapClick(e);
    },
    [isDragging, handleMinimapClick]
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Page rectangles in minimap coordinates
  const pageRects = useMemo(() => {
    return pagePositions.map((pos) => {
      const topLeft = toMinimapCoords(pos.x, pos.y);
      return {
        id: pos.id,
        x: topLeft.x,
        y: topLeft.y,
        width: PAGE_RENDER_WIDTH * minimapScale,
        height: PAGE_RENDER_HEIGHT * minimapScale,
      };
    });
  }, [pagePositions, minimapScale, toMinimapCoords]);

  if (pagePositions.length === 0) return null;

  return (
    <div
      className="absolute top-4 right-0"
      style={{
        transform: isCollapsed
          ? `translateX(${MINIMAP_WIDTH}px)`
          : "translateX(0)",
        transition: "transform 200ms ease-in-out",
        paddingRight: 16,
      }}
    >
      {/* Collapse/expand tab */}
      <button
        className="absolute top-1/2 cursor-pointer rounded-l-md border border-r-0 border-gray-300 bg-white/95 shadow-sm backdrop-blur-sm"
        style={{
          left: -COLLAPSE_TAB_WIDTH,
          width: COLLAPSE_TAB_WIDTH,
          height: 40,
          transform: "translateY(-50%)",
        }}
        onClick={() => setIsCollapsed((c) => !c)}
        aria-label={isCollapsed ? "Show minimap" : "Hide minimap"}
        data-testid="minimap-toggle"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          className="mx-auto text-gray-400"
          style={{
            transform: isCollapsed ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 200ms ease-in-out",
          }}
        >
          <path
            d="M7 1 L3 5 L7 9"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* Minimap body */}
      <div
        ref={minimapRef}
        className="cursor-crosshair rounded-lg border border-gray-300 bg-white/95 shadow-md backdrop-blur-sm"
        style={{
          width: MINIMAP_WIDTH,
          height: MINIMAP_HEIGHT,
          touchAction: "none",
        }}
        onPointerDown={isCollapsed ? undefined : handlePointerDown}
        onPointerMove={isCollapsed ? undefined : handlePointerMove}
        onPointerUp={isCollapsed ? undefined : handlePointerUp}
        onPointerCancel={isCollapsed ? undefined : handlePointerUp}
        data-testid="canvas-minimap"
      >
        {/* Background grid pattern */}
        <svg
          width="100%"
          height="100%"
          className="absolute inset-0"
          style={{ opacity: 0.1 }}
        >
          <pattern
            id="minimap-grid"
            width="10"
            height="10"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 10 0 L 0 0 0 10"
              fill="none"
              stroke="#9ca3af"
              strokeWidth="0.5"
            />
          </pattern>
          <rect width="100%" height="100%" fill="url(#minimap-grid)" />
        </svg>

        {/* Page rectangles */}
        <svg
          width="100%"
          height="100%"
          className="absolute inset-0"
          style={{ overflow: "visible" }}
        >
          {pageRects.map((rect) => (
            <rect
              key={rect.id}
              x={rect.x}
              y={rect.y}
              width={rect.width}
              height={rect.height}
              fill="#f3f4f6"
              stroke="#9ca3af"
              strokeWidth="0.5"
              rx="1"
            />
          ))}

          {/* Viewport indicator */}
          <rect
            x={viewport.x}
            y={viewport.y}
            width={Math.max(viewport.width, 4)}
            height={Math.max(viewport.height, 4)}
            fill="rgba(59, 130, 246, 0.15)"
            stroke="#3b82f6"
            strokeWidth="1.5"
            rx="2"
            data-testid="minimap-viewport"
          />
        </svg>

        {/* Label */}
        <div className="absolute bottom-1 left-2 text-[9px] font-medium text-gray-400">
          {pagePositions.length} page{pagePositions.length !== 1 ? "s" : ""}
        </div>
      </div>
    </div>
  );
}
