import { memo } from "react";
import { PAGE_WIDTH, PAGE_HEIGHT } from "../../lib/constants";
import {
  getSvgPathFromStroke,
  getSvgPathFromStrokeFilled,
  type StrokeData,
} from "../../lib/stroke-renderer";

interface StrokeCanvasProps {
  strokes: StrokeData[];
}

const StrokePath = memo(function StrokePath({ stroke }: { stroke: StrokeData }) {
  const useFilled = stroke.penStyle === "pressure" || !stroke.penStyle;

  if (useFilled) {
    const d = getSvgPathFromStrokeFilled(stroke);
    if (!d) return null;
    return <path d={d} fill={stroke.color} />;
  }

  const d = getSvgPathFromStroke(stroke);
  if (!d) return null;
  return (
    <path
      d={d}
      fill="none"
      stroke={stroke.color}
      strokeWidth={stroke.width}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
});

export const StrokeCanvas = memo(function StrokeCanvas({
  strokes,
}: StrokeCanvasProps) {
  return (
    <svg
      viewBox={`0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}`}
      className="absolute inset-0 h-full w-full"
      style={{ pointerEvents: "none" }}
    >
      {strokes.map((stroke) => (
        <StrokePath key={stroke.id} stroke={stroke} />
      ))}
    </svg>
  );
});
