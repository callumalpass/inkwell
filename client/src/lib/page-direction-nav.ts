import type { PageMeta } from "../api/pages";

export type Direction = "up" | "down" | "left" | "right";

const EPSILON = 0.0001;

/**
 * Find the nearest page in a given spatial direction from the current page.
 * Distances are measured between page centers in canvas coordinates.
 */
export function findNearestPageInDirection(
  pages: PageMeta[],
  currentPageId: string,
  direction: Direction,
  pageWidth: number,
  pageHeight: number,
): string | null {
  const currentPage = pages.find((p) => p.id === currentPageId);
  if (!currentPage) return null;

  const currentCenterX = currentPage.canvasX + pageWidth / 2;
  const currentCenterY = currentPage.canvasY + pageHeight / 2;

  let bestId: string | null = null;
  let bestDistanceSq = Number.POSITIVE_INFINITY;
  let bestSecondaryOffset = Number.POSITIVE_INFINITY;

  for (const candidate of pages) {
    if (candidate.id === currentPageId) continue;

    const candidateCenterX = candidate.canvasX + pageWidth / 2;
    const candidateCenterY = candidate.canvasY + pageHeight / 2;
    const dx = candidateCenterX - currentCenterX;
    const dy = candidateCenterY - currentCenterY;

    let inDirection = false;
    let secondaryOffset = 0;

    switch (direction) {
      case "up":
        inDirection = dy < -EPSILON;
        secondaryOffset = Math.abs(dx);
        break;
      case "down":
        inDirection = dy > EPSILON;
        secondaryOffset = Math.abs(dx);
        break;
      case "left":
        inDirection = dx < -EPSILON;
        secondaryOffset = Math.abs(dy);
        break;
      case "right":
        inDirection = dx > EPSILON;
        secondaryOffset = Math.abs(dy);
        break;
    }

    if (!inDirection) continue;

    const distanceSq = dx * dx + dy * dy;
    if (
      distanceSq < bestDistanceSq - EPSILON ||
      (Math.abs(distanceSq - bestDistanceSq) <= EPSILON &&
        secondaryOffset < bestSecondaryOffset)
    ) {
      bestDistanceSq = distanceSq;
      bestSecondaryOffset = secondaryOffset;
      bestId = candidate.id;
    }
  }

  return bestId;
}
