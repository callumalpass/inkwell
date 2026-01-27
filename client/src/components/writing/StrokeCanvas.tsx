import { memo } from "react";
import { PAGE_WIDTH, PAGE_HEIGHT } from "../../lib/constants";
import { getSvgPathFromStroke, type StrokeData } from "../../lib/stroke-renderer";

interface StrokeCanvasProps {
  strokes: StrokeData[];
}

const StrokePath = memo(function StrokePath({ stroke }: { stroke: StrokeData }) {
  const d = getSvgPathFromStroke(stroke);
  if (!d) return null;
  return <path d={d} fill={stroke.color} />;
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
