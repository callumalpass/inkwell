import { useMemo } from "react";
import { useDrawingStore } from "../../stores/drawing-store";
import { usePageStore } from "../../stores/page-store";
import { StrokeCanvas } from "./StrokeCanvas";
import { ActiveStrokeOverlay } from "./ActiveStrokeOverlay";
import { DrawingLayer } from "./DrawingLayer";
import { PageBackground, type GridType } from "./PageBackground";
import type { StrokeData } from "../../lib/stroke-renderer";
import { PAGE_WIDTH, PAGE_HEIGHT } from "../../lib/constants";
import type { Stroke } from "../../api/strokes";

const EMPTY: Stroke[] = [];

interface PageSurfaceProps {
  pageId: string;
  gridType?: GridType;
  lineSpacing?: number;
}

export function PageSurface({
  pageId,
  gridType = "none",
  lineSpacing,
}: PageSurfaceProps) {
  const savedStrokes = usePageStore((s) => s.strokesByPage[pageId] ?? EMPTY);
  const pendingStrokes = useDrawingStore(
    (s) => s.pendingStrokesByPage[pageId] ?? EMPTY,
  );

  const committedStrokes: StrokeData[] = useMemo(
    () => [...savedStrokes, ...pendingStrokes],
    [savedStrokes, pendingStrokes],
  );

  return (
    <div
      className="relative bg-white shadow-sm"
      style={{ aspectRatio: `${PAGE_WIDTH} / ${PAGE_HEIGHT}` }}
    >
      <PageBackground gridType={gridType} lineSpacing={lineSpacing} />
      <StrokeCanvas strokes={committedStrokes} />
      <ActiveStrokeOverlay pageId={pageId} />
      <DrawingLayer pageId={pageId} />
    </div>
  );
}
