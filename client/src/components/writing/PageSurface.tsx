import { useMemo } from "react";
import { useDrawingStore } from "../../stores/drawing-store";
import { usePageStore } from "../../stores/page-store";
import { StrokeCanvas } from "./StrokeCanvas";
import { DrawingLayer } from "./DrawingLayer";
import type { StrokeData } from "../../lib/stroke-renderer";
import { PAGE_WIDTH, PAGE_HEIGHT } from "../../lib/constants";
import type { Stroke } from "../../api/strokes";

const EMPTY: Stroke[] = [];

interface PageSurfaceProps {
  pageId: string;
}

export function PageSurface({ pageId }: PageSurfaceProps) {
  const savedStrokes = usePageStore((s) => s.strokesByPage[pageId] ?? EMPTY);
  const pendingStrokes = useDrawingStore(
    (s) => s.pendingStrokesByPage[pageId] ?? EMPTY,
  );
  const activeStroke = useDrawingStore((s) => s.activeStroke);
  const color = useDrawingStore((s) => s.color);
  const width = useDrawingStore((s) => s.width);
  const penStyle = useDrawingStore((s) => s.penStyle);

  const allStrokes = useMemo(() => {
    const strokes: StrokeData[] = [...savedStrokes, ...pendingStrokes];
    if (
      activeStroke &&
      activeStroke.pageId === pageId &&
      activeStroke.points.length >= 2
    ) {
      strokes.push({ ...activeStroke, color, width, penStyle });
    }
    return strokes;
  }, [savedStrokes, pendingStrokes, activeStroke, color, width, penStyle, pageId]);

  return (
    <div
      className="relative bg-white shadow-sm"
      style={{ aspectRatio: `${PAGE_WIDTH} / ${PAGE_HEIGHT}` }}
    >
      <StrokeCanvas strokes={allStrokes} />
      <DrawingLayer pageId={pageId} />
    </div>
  );
}
