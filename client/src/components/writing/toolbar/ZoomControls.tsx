import { useMemo, useCallback } from "react";
import { useViewStore } from "../../../stores/view-store";
import { useNotebookPagesStore } from "../../../stores/notebook-pages-store";
import {
  CANVAS_MIN_ZOOM,
  CANVAS_MAX_ZOOM,
  VIEW_MIN_ZOOM,
  VIEW_MAX_ZOOM,
  PAGE_WIDTH,
  PAGE_HEIGHT,
} from "../../../lib/constants";
import { BTN, BTN_INACTIVE, BTN_DISABLED, ToolbarButton } from "./ToolbarPrimitives";

const PAGE_RENDER_WIDTH = 400;
const PAGE_RENDER_HEIGHT = PAGE_RENDER_WIDTH * (PAGE_HEIGHT / PAGE_WIDTH);

const ZOOM_FACTOR = 1.2;
const FIT_PADDING = 40; // Padding around content when fitting all pages

export function ZoomControls() {
  const viewMode = useViewStore((s) => s.viewMode);
  const isZoomLocked = useViewStore((s) => s.isZoomLocked);
  const toggleZoomLocked = useViewStore((s) => s.toggleZoomLocked);
  const canvasContainerSize = useViewStore((s) => s.canvasContainerSize);
  const activeTransform = useViewStore((s) =>
    s.viewMode === "canvas" ? s.canvasTransform : s.singlePageTransform,
  );
  const setActiveTransform = useViewStore((s) =>
    s.viewMode === "canvas" ? s.setCanvasTransform : s.setSinglePageTransform,
  );
  const pages = useNotebookPagesStore((s) => s.pages);

  // Calculate page positions for Fit All
  const pagePositions = useMemo(() => {
    return pages.map((page) => ({
      x: page.canvasX ?? 0,
      y: page.canvasY ?? 0,
    }));
  }, [pages]);

  // Calculate bounding box of all pages
  const contentBounds = useMemo(() => {
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

    return { minX, minY, maxX, maxY };
  }, [pagePositions]);

  const handleFitAll = useCallback(() => {
    const { width, height } = canvasContainerSize;
    if (width === 0 || height === 0) return;

    const contentWidth = contentBounds.maxX - contentBounds.minX;
    const contentHeight = contentBounds.maxY - contentBounds.minY;

    // Calculate scale to fit all content with padding
    const availableWidth = width - FIT_PADDING * 2;
    const availableHeight = height - FIT_PADDING * 2;
    const scale = Math.min(
      availableWidth / contentWidth,
      availableHeight / contentHeight,
      CANVAS_MAX_ZOOM // Don't zoom in more than max
    );

    // Clamp scale to min
    const clampedScale = Math.max(scale, CANVAS_MIN_ZOOM);

    // Calculate position to center the content
    const scaledContentWidth = contentWidth * clampedScale;
    const scaledContentHeight = contentHeight * clampedScale;
    const x = (width - scaledContentWidth) / 2 - contentBounds.minX * clampedScale;
    const y = (height - scaledContentHeight) / 2 - contentBounds.minY * clampedScale;

    setActiveTransform({ x, y, scale: clampedScale });
  }, [canvasContainerSize, contentBounds, setActiveTransform]);

  if (viewMode === "overview") return null;

  const minZoom = viewMode === "canvas" ? CANVAS_MIN_ZOOM : VIEW_MIN_ZOOM;
  const maxZoom = viewMode === "canvas" ? CANVAS_MAX_ZOOM : VIEW_MAX_ZOOM;

  const canZoomIn = activeTransform.scale < maxZoom;
  const canZoomOut = activeTransform.scale > minZoom;
  const zoomPercent = Math.round(activeTransform.scale * 100);

  const handleZoomIn = () => {
    const newScale = Math.min(maxZoom, activeTransform.scale * ZOOM_FACTOR);
    setActiveTransform({ ...activeTransform, scale: newScale });
  };

  const handleZoomOut = () => {
    const newScale = Math.max(minZoom, activeTransform.scale / ZOOM_FACTOR);
    setActiveTransform({ ...activeTransform, scale: newScale });
  };

  const handleZoomReset = () => {
    setActiveTransform({ x: 0, y: 0, scale: 1 });
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={handleZoomOut}
        disabled={!canZoomOut}
        aria-label="Zoom out"
        className={`${BTN} ${BTN_INACTIVE} ${!canZoomOut ? BTN_DISABLED : ""}`}
      >
        −
      </button>
      <button
        onClick={handleZoomReset}
        aria-label="Reset zoom"
        className="min-w-[3.5rem] px-1 py-2 text-center text-sm font-medium text-gray-800"
      >
        {zoomPercent}%
      </button>
      <button
        onClick={handleZoomIn}
        disabled={!canZoomIn}
        aria-label="Zoom in"
        className={`${BTN} ${BTN_INACTIVE} ${!canZoomIn ? BTN_DISABLED : ""}`}
      >
        +
      </button>
      {viewMode === "canvas" && (
        <ToolbarButton
          onClick={handleFitAll}
          aria-label="Fit all pages"
          data-testid="fit-all-button"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {/* Fit/expand icon - four corners pointing inward */}
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
          </svg>
        </ToolbarButton>
      )}
      <ToolbarButton
        onClick={toggleZoomLocked}
        active={isZoomLocked}
        aria-label={isZoomLocked ? "Unlock pinch zoom" : "Lock pinch zoom"}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {isZoomLocked ? (
            <>
              {/* Locked icon */}
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </>
          ) : (
            <>
              {/* Unlocked icon */}
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 9.9-1" />
            </>
          )}
        </svg>
      </ToolbarButton>
    </div>
  );
}
