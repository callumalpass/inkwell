import { useMemo, useState, useCallback } from "react";
import { useDrawingStore } from "../../stores/drawing-store";
import { usePageStore } from "../../stores/page-store";
import { StrokeCanvas } from "./StrokeCanvas";
import { ActiveStrokeOverlay } from "./ActiveStrokeOverlay";
import { DrawingLayer } from "./DrawingLayer";
import { EraserCursor } from "./EraserCursor";
import { PageBackground, type GridType } from "./PageBackground";
import type { StrokeData } from "../../lib/stroke-renderer";
import { PAGE_WIDTH, PAGE_HEIGHT } from "../../lib/constants";
import { StrokeSpatialIndex } from "../../lib/spatial-index";
import type { Stroke } from "../../api/strokes";

const EMPTY: Stroke[] = [];
const ERASE_THRESHOLD = 20;

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
  const tool = useDrawingStore((s) => s.tool);
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null);

  const committedStrokes: StrokeData[] = useMemo(
    () => [...savedStrokes, ...pendingStrokes],
    [savedStrokes, pendingStrokes],
  );

  // Build spatial index for eraser preview hit-testing
  const spatialIndex = useMemo(
    () => StrokeSpatialIndex.fromStrokes(committedStrokes),
    [committedStrokes],
  );

  // Find which stroke would be erased at the current cursor position
  const highlightedStrokeId = useMemo(() => {
    if (tool !== "eraser" || !cursorPosition) return null;
    const hit = spatialIndex.queryPoint(cursorPosition.x, cursorPosition.y, ERASE_THRESHOLD);
    return hit?.id ?? null;
  }, [tool, cursorPosition, spatialIndex]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (tool !== "eraser") return;
    if (e.pointerType !== "pen" && e.pointerType !== "mouse") return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * PAGE_WIDTH;
    const y = ((e.clientY - rect.top) / rect.height) * PAGE_HEIGHT;
    setCursorPosition({ x, y });
  }, [tool]);

  const handlePointerLeave = useCallback(() => {
    setCursorPosition(null);
  }, []);

  return (
    <div
      className="relative bg-white shadow-sm"
      style={{ aspectRatio: `${PAGE_WIDTH} / ${PAGE_HEIGHT}` }}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <PageBackground gridType={gridType} lineSpacing={lineSpacing} />
      <StrokeCanvas strokes={committedStrokes} highlightedStrokeId={highlightedStrokeId} />
      <ActiveStrokeOverlay pageId={pageId} />
      <DrawingLayer pageId={pageId} />
      <EraserCursor position={cursorPosition} />
    </div>
  );
}
