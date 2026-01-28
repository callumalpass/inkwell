export const PAGE_WIDTH = 1404;
export const PAGE_HEIGHT = 1872;

export const DEFAULT_STROKE_COLOR = "#000000";
export const DEFAULT_STROKE_WIDTH = 3;
export const DEFAULT_LINE_SPACING = 48;
export const LINE_SPACING_OPTIONS = [32, 40, 48, 56, 64] as const;

/** Color presets for e-ink display (limited palette). */
export const COLOR_PRESETS = [
  { color: "#000000", label: "Black" },
  { color: "#4b5563", label: "Dark Gray" },
  { color: "#1e40af", label: "Blue" },
  { color: "#dc2626", label: "Red" },
  { color: "#166534", label: "Green" },
] as const;

export const BATCH_SAVE_INTERVAL_MS = 2000;

export const CANVAS_MIN_ZOOM = 0.1;
export const CANVAS_MAX_ZOOM = 3.0;

export const VIEW_MIN_ZOOM = 0.5;
export const VIEW_MAX_ZOOM = 5.0;
