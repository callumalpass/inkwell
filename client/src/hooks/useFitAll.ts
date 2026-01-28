import { useCallback, useMemo } from "react";
import { useViewStore } from "../stores/view-store";
import { useNotebookPagesStore } from "../stores/notebook-pages-store";
import { PAGE_WIDTH, PAGE_HEIGHT, CANVAS_MIN_ZOOM, CANVAS_MAX_ZOOM } from "../lib/constants";

const PAGE_RENDER_WIDTH = 400;
const PAGE_RENDER_HEIGHT = PAGE_RENDER_WIDTH * (PAGE_HEIGHT / PAGE_WIDTH);
const FIT_PADDING = 40;

/**
 * Hook that provides a fitAll function to center and zoom to fit all pages
 * in the canvas view.
 */
export function useFitAll() {
  const canvasContainerSize = useViewStore((s) => s.canvasContainerSize);
  const setCanvasTransform = useViewStore((s) => s.setCanvasTransform);
  const viewMode = useViewStore((s) => s.viewMode);
  const pages = useNotebookPagesStore((s) => s.pages);

  const pagePositions = useMemo(() => {
    return pages.map((page) => ({
      x: page.canvasX ?? 0,
      y: page.canvasY ?? 0,
    }));
  }, [pages]);

  const contentBounds = useMemo(() => {
    if (pagePositions.length === 0) {
      return { minX: 0, minY: 0, maxX: PAGE_RENDER_WIDTH, maxY: PAGE_RENDER_HEIGHT };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const pos of pagePositions) {
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x + PAGE_RENDER_WIDTH);
      maxY = Math.max(maxY, pos.y + PAGE_RENDER_HEIGHT);
    }

    return { minX, minY, maxX, maxY };
  }, [pagePositions]);

  const fitAll = useCallback(() => {
    if (viewMode !== "canvas") return;

    const { width, height } = canvasContainerSize;
    if (width === 0 || height === 0) return;

    const contentWidth = contentBounds.maxX - contentBounds.minX;
    const contentHeight = contentBounds.maxY - contentBounds.minY;

    const availableWidth = width - FIT_PADDING * 2;
    const availableHeight = height - FIT_PADDING * 2;
    const scale = Math.min(
      availableWidth / contentWidth,
      availableHeight / contentHeight,
      CANVAS_MAX_ZOOM
    );

    const clampedScale = Math.max(scale, CANVAS_MIN_ZOOM);

    const scaledContentWidth = contentWidth * clampedScale;
    const scaledContentHeight = contentHeight * clampedScale;
    const x = (width - scaledContentWidth) / 2 - contentBounds.minX * clampedScale;
    const y = (height - scaledContentHeight) / 2 - contentBounds.minY * clampedScale;

    setCanvasTransform({ x, y, scale: clampedScale });
  }, [viewMode, canvasContainerSize, contentBounds, setCanvasTransform]);

  return { fitAll, canFitAll: viewMode === "canvas" && pagePositions.length > 0 };
}
