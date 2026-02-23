import { useStrokeCapture } from "../../hooks/useStrokeCapture";
import { useDrawingStore } from "../../stores/drawing-store";
import { usePageStore } from "../../stores/page-store";
import { useUndoRedoStore } from "../../stores/undo-redo-store";
import { showError } from "../../stores/toast-store";
import * as strokesApi from "../../api/strokes";
import type { InlineLink, InlineLinkRect } from "../../api/pages";
import type { Stroke } from "../../api/strokes";
import { PAGE_WIDTH, PAGE_HEIGHT } from "../../lib/constants";
import { StrokeSpatialIndex } from "../../lib/spatial-index";
import { useCallback, useRef, useMemo } from "react";
import {
  createInlineLinkRect,
  isPointInInlineLinkRect,
} from "../../lib/inline-links";

const EMPTY: Stroke[] = [];
const ERASE_THRESHOLD = 20;
const LINK_HIT_PADDING = 6;
const LINK_TAP_THRESHOLD = 6;

interface DrawingLayerProps {
  pageId: string;
  inlineLinks?: InlineLink[];
  onInlineLinkPreview?: (rect: InlineLinkRect | null) => void;
  onInlineLinkCreate?: (rect: InlineLinkRect) => void;
  onInlineLinkEdit?: (linkId: string) => void;
  onInlineLinkFollow?: (linkId: string) => void;
}

interface LinkInteractionState {
  pointerId: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  mode: "create" | "select";
  linkId: string | null;
  moved: boolean;
}

export function DrawingLayer({
  pageId,
  inlineLinks = [],
  onInlineLinkPreview,
  onInlineLinkCreate,
  onInlineLinkEdit,
  onInlineLinkFollow,
}: DrawingLayerProps) {
  const { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, captureRef } = useStrokeCapture(pageId);
  const tool = useDrawingStore((s) => s.tool);
  const savedStrokes = usePageStore((s) => s.strokesByPage[pageId] ?? EMPTY);
  const removeSavedStroke = usePageStore((s) => s.removeSavedStroke);
  const lastEraseRef = useRef<string | null>(null);
  const linkInteractionRef = useRef<LinkInteractionState | null>(null);
  // Build spatial index for fast eraser hit-testing (rebuilt when strokes change)
  const spatialIndex = useMemo(
    () => StrokeSpatialIndex.fromStrokes(savedStrokes),
    [savedStrokes],
  );

  const isPenOrMouse = (e: React.PointerEvent) =>
    e.pointerType === "pen" || e.pointerType === "mouse";

  const toPagePoint = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * PAGE_WIDTH;
    const y = ((e.clientY - rect.top) / rect.height) * PAGE_HEIGHT;
    return { x, y };
  }, []);

  const hitInlineLink = useCallback((x: number, y: number): InlineLink | null => {
    for (let i = inlineLinks.length - 1; i >= 0; i -= 1) {
      const link = inlineLinks[i];
      if (isPointInInlineLinkRect(x, y, link.rect, LINK_HIT_PADDING)) return link;
    }
    return null;
  }, [inlineLinks]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (tool === "link") {
        const { x, y } = toPagePoint(e);
        const hit = hitInlineLink(x, y);
        linkInteractionRef.current = {
          pointerId: e.pointerId,
          startX: x,
          startY: y,
          currentX: x,
          currentY: y,
          mode: hit ? "select" : "create",
          linkId: hit?.id ?? null,
          moved: false,
        };
        onInlineLinkPreview?.(null);
        e.currentTarget.setPointerCapture(e.pointerId);
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (e.pointerType === "touch") {
        const { x, y } = toPagePoint(e);
        const hit = hitInlineLink(x, y);
        if (hit) {
          e.preventDefault();
          e.stopPropagation();
          onInlineLinkFollow?.(hit.id);
          return;
        }
      }

      if (!isPenOrMouse(e)) return;
      e.preventDefault();
      if (tool === "eraser") {
        eraseAt(e);
      } else {
        onPointerDown(e);
      }
    },
    [tool, onPointerDown, toPagePoint, hitInlineLink, onInlineLinkPreview, onInlineLinkFollow],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (tool === "link") {
        const interaction = linkInteractionRef.current;
        if (!interaction || interaction.pointerId !== e.pointerId) return;

        const { x, y } = toPagePoint(e);
        interaction.currentX = x;
        interaction.currentY = y;
        if (
          Math.abs(interaction.startX - x) > LINK_TAP_THRESHOLD ||
          Math.abs(interaction.startY - y) > LINK_TAP_THRESHOLD
        ) {
          interaction.moved = true;
        }

        if (interaction.mode === "create") {
          const rect = createInlineLinkRect(
            interaction.startX,
            interaction.startY,
            interaction.currentX,
            interaction.currentY,
          );
          onInlineLinkPreview?.(rect);
        }
        return;
      }

      if (!isPenOrMouse(e)) return;
      if (tool === "eraser") {
        if (e.buttons > 0) eraseAt(e);
      } else {
        onPointerMove(e);
      }
    },
    [tool, onPointerMove, toPagePoint, onInlineLinkPreview],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (tool === "link") {
        const interaction = linkInteractionRef.current;
        if (!interaction || interaction.pointerId !== e.pointerId) return;

        if (interaction.mode === "select" && interaction.linkId && !interaction.moved) {
          onInlineLinkEdit?.(interaction.linkId);
        } else if (interaction.mode === "create") {
          const rect = createInlineLinkRect(
            interaction.startX,
            interaction.startY,
            interaction.currentX,
            interaction.currentY,
          );
          if (rect) onInlineLinkCreate?.(rect);
        }

        onInlineLinkPreview?.(null);
        linkInteractionRef.current = null;
        return;
      }

      if (!isPenOrMouse(e)) return;
      if (tool === "eraser") {
        lastEraseRef.current = null;
      } else {
        onPointerUp(e);
      }
    },
    [tool, onPointerUp, onInlineLinkCreate, onInlineLinkEdit, onInlineLinkPreview],
  );

  const handlePointerCancel = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (tool === "link") {
        const interaction = linkInteractionRef.current;
        if (!interaction || interaction.pointerId !== e.pointerId) return;
        onInlineLinkPreview?.(null);
        linkInteractionRef.current = null;
        return;
      }

      if (!isPenOrMouse(e)) return;
      if (tool === "eraser") {
        lastEraseRef.current = null;
      } else {
        onPointerCancel(e);
      }
    },
    [tool, onPointerCancel, onInlineLinkPreview],
  );

  function eraseAt(e: React.PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * PAGE_WIDTH;
    const y = ((e.clientY - rect.top) / rect.height) * PAGE_HEIGHT;

    const hit = spatialIndex.queryPoint(x, y, ERASE_THRESHOLD);
    if (!hit || hit.id === lastEraseRef.current) return;

    lastEraseRef.current = hit.id;
    spatialIndex.removeStroke(hit.id);

    // Record undo command before removing (captures full stroke data)
    useUndoRedoStore.getState().record({
      type: "remove-stroke",
      pageId,
      stroke: hit,
    });
    removeSavedStroke(pageId, hit.id);
    strokesApi.deleteStroke(pageId, hit.id).catch((err) => {
      console.error("Failed to delete stroke:", err);
      showError("Failed to delete stroke from server");
    });
  }

  return (
    <div
      ref={captureRef}
      className="absolute inset-0 touch-none"
      style={{ cursor: tool === "eraser" || tool === "link" ? "crosshair" : "default" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    />
  );
}
