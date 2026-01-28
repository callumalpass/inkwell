import { useDrawingStore } from "../../stores/drawing-store";
import { PAGE_WIDTH, PAGE_HEIGHT } from "../../lib/constants";

/** Eraser threshold radius in page coordinates (must match DrawingLayer) */
const ERASE_RADIUS = 20;

interface EraserCursorProps {
  /** Cursor position in page coordinates, or null if not over the page */
  position: { x: number; y: number } | null;
}

/**
 * Visual eraser cursor that shows the erase radius as a circle.
 * Only visible when eraser tool is active and a position is provided.
 * This is a purely visual component with no pointer events.
 */
export function EraserCursor({ position }: EraserCursorProps) {
  const tool = useDrawingStore((s) => s.tool);

  if (tool !== "eraser" || !position) return null;

  // Convert from page coordinates to percentage for positioning
  const radiusPctX = (ERASE_RADIUS / PAGE_WIDTH) * 100;
  const radiusPctY = (ERASE_RADIUS / PAGE_HEIGHT) * 100;

  return (
    <div className="pointer-events-none absolute inset-0">
      <div
        className="absolute rounded-full border-2 border-gray-400 bg-white/20"
        style={{
          left: `${(position.x / PAGE_WIDTH) * 100}%`,
          top: `${(position.y / PAGE_HEIGHT) * 100}%`,
          width: `${radiusPctX * 2}%`,
          height: `${radiusPctY * 2}%`,
          transform: "translate(-50%, -50%)",
        }}
        data-testid="eraser-cursor"
      />
    </div>
  );
}
