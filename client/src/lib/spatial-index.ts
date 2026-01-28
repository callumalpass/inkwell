import type { Stroke } from "../api/strokes";

/**
 * Grid-based spatial index for fast stroke hit-testing.
 *
 * Divides the page into a grid of cells. Each stroke is registered
 * in every cell its bounding box overlaps. Eraser lookups only need
 * to check strokes in the cell under the pointer, reducing hit-testing
 * from O(totalPoints) to O(pointsInCell).
 */

const DEFAULT_CELL_SIZE = 60;

interface CellKey {
  col: number;
  row: number;
}

function cellKeyStr(col: number, row: number): string {
  return `${col},${row}`;
}

export class StrokeSpatialIndex {
  private cellSize: number;
  private grid: Map<string, Set<string>> = new Map();
  private strokeMap: Map<string, Stroke> = new Map();

  constructor(cellSize: number = DEFAULT_CELL_SIZE) {
    this.cellSize = cellSize;
  }

  /** Build (or rebuild) the index from a full stroke array. */
  static fromStrokes(strokes: Stroke[], cellSize?: number): StrokeSpatialIndex {
    const index = new StrokeSpatialIndex(cellSize);
    for (const stroke of strokes) {
      index.addStroke(stroke);
    }
    return index;
  }

  /** Add a single stroke to the index. */
  addStroke(stroke: Stroke): void {
    if (stroke.points.length === 0) return;

    this.strokeMap.set(stroke.id, stroke);

    // Compute bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const pt of stroke.points) {
      if (pt.x < minX) minX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y > maxY) maxY = pt.y;
    }

    const colMin = Math.floor(minX / this.cellSize);
    const colMax = Math.floor(maxX / this.cellSize);
    const rowMin = Math.floor(minY / this.cellSize);
    const rowMax = Math.floor(maxY / this.cellSize);

    for (let col = colMin; col <= colMax; col++) {
      for (let row = rowMin; row <= rowMax; row++) {
        const key = cellKeyStr(col, row);
        let set = this.grid.get(key);
        if (!set) {
          set = new Set();
          this.grid.set(key, set);
        }
        set.add(stroke.id);
      }
    }
  }

  /** Remove a stroke from the index. */
  removeStroke(strokeId: string): void {
    const stroke = this.strokeMap.get(strokeId);
    if (!stroke) return;

    this.strokeMap.delete(strokeId);

    // Remove from all cells
    for (const [, set] of this.grid) {
      set.delete(strokeId);
    }
  }

  /**
   * Find the first stroke within `threshold` pixels of point (x, y).
   * Returns the stroke or null if nothing is close enough.
   */
  queryPoint(x: number, y: number, threshold: number): Stroke | null {
    const thresholdSq = threshold * threshold;

    // Check all cells that the threshold circle could overlap
    const colMin = Math.floor((x - threshold) / this.cellSize);
    const colMax = Math.floor((x + threshold) / this.cellSize);
    const rowMin = Math.floor((y - threshold) / this.cellSize);
    const rowMax = Math.floor((y + threshold) / this.cellSize);

    const checked = new Set<string>();

    for (let col = colMin; col <= colMax; col++) {
      for (let row = rowMin; row <= rowMax; row++) {
        const key = cellKeyStr(col, row);
        const strokeIds = this.grid.get(key);
        if (!strokeIds) continue;

        for (const id of strokeIds) {
          if (checked.has(id)) continue;
          checked.add(id);

          const stroke = this.strokeMap.get(id);
          if (!stroke) continue;

          for (const pt of stroke.points) {
            const dx = pt.x - x;
            const dy = pt.y - y;
            if (dx * dx + dy * dy < thresholdSq) {
              return stroke;
            }
          }
        }
      }
    }

    return null;
  }

  /** Number of strokes in the index. */
  get size(): number {
    return this.strokeMap.size;
  }
}
