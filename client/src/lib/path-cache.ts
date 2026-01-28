/**
 * LRU cache for computed SVG path strings.
 *
 * Stroke path computation (Bezier fitting + perfect-freehand) is expensive.
 * Since strokes are immutable once created, we can safely cache the SVG path
 * string by stroke ID. This avoids recomputation when React re-renders the
 * StrokeCanvas with the same strokes (e.g. when a new stroke is added, only
 * the new one needs computation — existing ones hit the cache).
 */

const DEFAULT_MAX_SIZE = 2000;

export class PathCache {
  private cache: Map<string, string> = new Map();
  private maxSize: number;

  constructor(maxSize: number = DEFAULT_MAX_SIZE) {
    this.maxSize = maxSize;
  }

  get(strokeId: string): string | undefined {
    const val = this.cache.get(strokeId);
    if (val !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(strokeId);
      this.cache.set(strokeId, val);
    }
    return val;
  }

  set(strokeId: string, path: string): void {
    // If already present, delete first so insertion puts it at the end
    this.cache.delete(strokeId);
    this.cache.set(strokeId, path);

    // Evict oldest entries if over capacity
    if (this.cache.size > this.maxSize) {
      const first = this.cache.keys().next().value;
      if (first !== undefined) {
        this.cache.delete(first);
      }
    }
  }

  get size(): number {
    return this.cache.size;
  }

  clear(): void {
    this.cache.clear();
  }
}

/** Shared singleton used by StrokeCanvas. */
export const pathCache = new PathCache();
