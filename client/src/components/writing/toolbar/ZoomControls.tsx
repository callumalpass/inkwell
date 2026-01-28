import { useViewStore } from "../../../stores/view-store";
import {
  CANVAS_MIN_ZOOM,
  CANVAS_MAX_ZOOM,
  VIEW_MIN_ZOOM,
  VIEW_MAX_ZOOM,
} from "../../../lib/constants";
import { BTN, BTN_INACTIVE, BTN_DISABLED, ToolbarButton } from "./ToolbarPrimitives";

const ZOOM_FACTOR = 1.2;

export function ZoomControls() {
  const viewMode = useViewStore((s) => s.viewMode);
  if (viewMode === "overview") return null;
  const isZoomLocked = useViewStore((s) => s.isZoomLocked);
  const toggleZoomLocked = useViewStore((s) => s.toggleZoomLocked);
  const activeTransform = useViewStore((s) =>
    s.viewMode === "canvas" ? s.canvasTransform : s.singlePageTransform,
  );
  const setActiveTransform = useViewStore((s) =>
    s.viewMode === "canvas" ? s.setCanvasTransform : s.setSinglePageTransform,
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
