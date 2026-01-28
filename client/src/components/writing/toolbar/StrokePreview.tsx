import { useMemo } from "react";
import { useDrawingStore } from "../../../stores/drawing-store";
import { getSvgPathFromStrokeFilled } from "../../../lib/stroke-renderer";
import type { StrokePoint } from "../../../lib/stroke-renderer";

/**
 * Fixed set of points that produce a natural-looking S-curve for preview.
 * Coordinates are in a 0–60 x 0–32 viewbox.
 */
const PREVIEW_POINTS: StrokePoint[] = [
  { x: 4, y: 26, pressure: 0.3 },
  { x: 14, y: 8, pressure: 0.5 },
  { x: 28, y: 6, pressure: 0.7 },
  { x: 38, y: 24, pressure: 0.7 },
  { x: 48, y: 26, pressure: 0.5 },
  { x: 56, y: 10, pressure: 0.3 },
];

export function StrokePreview() {
  const color = useDrawingStore((s) => s.color);
  const width = useDrawingStore((s) => s.width);
  const penStyle = useDrawingStore((s) => s.penStyle);

  const pathD = useMemo(
    () =>
      getSvgPathFromStrokeFilled({
        id: "preview",
        points: PREVIEW_POINTS,
        color,
        width,
        penStyle,
      }),
    [color, width, penStyle],
  );

  return (
    <div className="flex h-9 w-14 items-center justify-center rounded-md border border-gray-300 bg-white">
      <svg viewBox="0 0 60 32" className="h-6 w-10" aria-label="Stroke preview">
        <path d={pathD} fill={color} />
      </svg>
    </div>
  );
}
