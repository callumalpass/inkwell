import { memo } from "react";
import { useDrawingStore } from "../../stores/drawing-store";
import { PAGE_WIDTH, PAGE_HEIGHT } from "../../lib/constants";
import {
  getSvgPathFromStroke,
  getSvgPathFromStrokeFilled,
} from "../../lib/stroke-renderer";

interface ActiveStrokeOverlayProps {
  pageId: string;
}

/**
 * Renders only the in-progress active stroke as a separate SVG overlay.
 * This isolates the high-frequency drawing updates from the static
 * saved/pending strokes, preventing StrokeCanvas from re-rendering
 * on every pointer event frame.
 */
export const ActiveStrokeOverlay = memo(function ActiveStrokeOverlay({
  pageId,
}: ActiveStrokeOverlayProps) {
  const activeStroke = useDrawingStore((s) => s.activeStroke);
  const color = useDrawingStore((s) => s.color);
  const width = useDrawingStore((s) => s.width);
  const penStyle = useDrawingStore((s) => s.penStyle);

  if (
    !activeStroke ||
    activeStroke.pageId !== pageId ||
    activeStroke.points.length < 2
  ) {
    return null;
  }

  const strokeData = { ...activeStroke, color, width, penStyle };
  const useFilled = penStyle === "pressure" || !penStyle;

  let pathEl: React.ReactNode = null;
  if (useFilled) {
    const d = getSvgPathFromStrokeFilled(strokeData);
    if (d) pathEl = <path d={d} fill={color} />;
  } else {
    const d = getSvgPathFromStroke(strokeData);
    if (d) {
      pathEl = (
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={width}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    }
  }

  if (!pathEl) return null;

  return (
    <svg
      viewBox={`0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}`}
      className="absolute inset-0 h-full w-full"
      style={{ pointerEvents: "none" }}
    >
      {pathEl}
    </svg>
  );
});
