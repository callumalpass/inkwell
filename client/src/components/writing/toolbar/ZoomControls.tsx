import { useViewStore } from "../../../stores/view-store";
import {
  CANVAS_MIN_ZOOM,
  CANVAS_MAX_ZOOM,
  VIEW_MIN_ZOOM,
  VIEW_MAX_ZOOM,
} from "../../../lib/constants";
import { BTN, BTN_INACTIVE, BTN_DISABLED } from "./ToolbarPrimitives";

const ZOOM_FACTOR = 1.2;

export function ZoomControls() {
  const viewMode = useViewStore((s) => s.viewMode);
  const activeTransform = useViewStore((s) =>
    s.viewMode === "canvas"
      ? s.canvasTransform
      : s.viewMode === "scroll"
        ? s.scrollViewTransform
        : s.singlePageTransform,
  );
  const setActiveTransform = useViewStore((s) =>
    s.viewMode === "canvas"
      ? s.setCanvasTransform
      : s.viewMode === "scroll"
        ? s.setScrollViewTransform
        : s.setSinglePageTransform,
  );

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
    </div>
  );
}
