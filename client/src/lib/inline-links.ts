import type { InlineLinkRect } from "../api/pages";
import { PAGE_WIDTH, PAGE_HEIGHT } from "./constants";

const MIN_LINK_SIZE = 24;
let linkCounter = 0;

export function createInlineLinkId(): string {
  linkCounter += 1;
  return `lnk_${Date.now().toString(36)}_${linkCounter.toString(36)}`;
}

export function clampInlineLinkRect(rect: InlineLinkRect): InlineLinkRect {
  const x = clamp(rect.x, 0, PAGE_WIDTH);
  const y = clamp(rect.y, 0, PAGE_HEIGHT);
  const maxWidth = PAGE_WIDTH - x;
  const maxHeight = PAGE_HEIGHT - y;
  return {
    x,
    y,
    width: clamp(rect.width, 1, maxWidth),
    height: clamp(rect.height, 1, maxHeight),
  };
}

export function createInlineLinkRect(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): InlineLinkRect | null {
  const x = Math.min(startX, endX);
  const y = Math.min(startY, endY);
  const width = Math.abs(endX - startX);
  const height = Math.abs(endY - startY);

  if (width < MIN_LINK_SIZE || height < MIN_LINK_SIZE) return null;

  return clampInlineLinkRect({
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
  });
}

export function isPointInInlineLinkRect(
  x: number,
  y: number,
  rect: InlineLinkRect,
  padding = 0,
): boolean {
  return (
    x >= rect.x - padding &&
    x <= rect.x + rect.width + padding &&
    y >= rect.y - padding &&
    y <= rect.y + rect.height + padding
  );
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
