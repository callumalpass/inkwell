import { useMemo } from "react";
import { useDrawingStore } from "../../stores/drawing-store";
import { usePageStore } from "../../stores/page-store";
import { StrokeCanvas } from "./StrokeCanvas";
import { DrawingLayer } from "./DrawingLayer";
import { Toolbar } from "./Toolbar";
import type { StrokeData } from "../../lib/stroke-renderer";
import { PAGE_WIDTH, PAGE_HEIGHT } from "../../lib/constants";

export function WritingView() {
  const savedStrokes = usePageStore((s) => s.savedStrokes);
  const pendingStrokes = useDrawingStore((s) => s.pendingStrokes);
  const activeStroke = useDrawingStore((s) => s.activeStroke);
  const color = useDrawingStore((s) => s.color);
  const width = useDrawingStore((s) => s.width);

  const allStrokes = useMemo(() => {
    const strokes: StrokeData[] = [...savedStrokes, ...pendingStrokes];
    if (activeStroke && activeStroke.points.length >= 2) {
      strokes.push({ ...activeStroke, color, width });
    }
    return strokes;
  }, [savedStrokes, pendingStrokes, activeStroke, color, width]);

  return (
    <div className="flex h-screen flex-col">
      <Toolbar />
      <div className="flex min-h-0 flex-1 items-center justify-center bg-gray-100 p-4">
        <div
          className="relative h-full bg-white shadow-sm"
          style={{ aspectRatio: `${PAGE_WIDTH} / ${PAGE_HEIGHT}` }}
        >
          <StrokeCanvas strokes={allStrokes} />
          <DrawingLayer />
        </div>
      </div>
    </div>
  );
}
