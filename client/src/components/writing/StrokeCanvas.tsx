import { memo } from "react";
import { PAGE_WIDTH, PAGE_HEIGHT } from "../../lib/constants";
import {
  getSvgPathFromStroke,
  getSvgPathFromStrokeFilled,
  type StrokeData,
} from "../../lib/stroke-renderer";
import { pathCache } from "../../lib/path-cache";

interface StrokeCanvasProps {
  strokes: StrokeData[];
  /** Stroke ID to highlight (e.g., for eraser preview) */
  highlightedStrokeId?: string | null;
}

function computePath(stroke: StrokeData): string | null {
  const cached = pathCache.get(stroke.id);
  if (cached !== undefined) return cached || null;

  const useFilled = stroke.penStyle === "pressure" || !stroke.penStyle;
  const d = useFilled
    ? getSvgPathFromStrokeFilled(stroke)
    : getSvgPathFromStroke(stroke);

  // Cache the result (empty string for null so we don't recompute)
  pathCache.set(stroke.id, d ?? "");
  return d;
}

interface StrokePathProps {
  stroke: StrokeData;
  isHighlighted?: boolean;
}

const StrokePath = memo(function StrokePath({ stroke, isHighlighted }: StrokePathProps) {
  const useFilled = stroke.penStyle === "pressure" || !stroke.penStyle;
  const isHighlighter = stroke.tool === "highlighter";
  const d = computePath(stroke);
  if (!d) return null;

  // Highlighter strokes are semi-transparent
  const opacity = isHighlighter ? 0.4 : 1;
  // Use red color for eraser preview highlight
  const color = isHighlighted ? "#ef4444" : stroke.color;

  if (useFilled) {
    return <path d={d} fill={color} opacity={opacity} />;
  }

  return (
    <path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={stroke.width}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={opacity}
    />
  );
});

export const StrokeCanvas = memo(function StrokeCanvas({
  strokes,
  highlightedStrokeId,
}: StrokeCanvasProps) {
  return (
    <svg
      viewBox={`0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}`}
      className="absolute inset-0 h-full w-full"
      style={{ pointerEvents: "none" }}
    >
      {strokes.map((stroke) => (
        <StrokePath
          key={stroke.id}
          stroke={stroke}
          isHighlighted={highlightedStrokeId === stroke.id}
        />
      ))}
    </svg>
  );
});
