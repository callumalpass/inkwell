import { create } from "zustand";
import type { StrokePoint } from "../lib/stroke-renderer";
import type { Stroke } from "../api/strokes";
import type { PenStyle } from "../lib/pen-styles";
import { generateStrokeId } from "../lib/id";
import { DEFAULT_STROKE_COLOR, DEFAULT_STROKE_WIDTH } from "../lib/constants";

export type Tool = "pen" | "highlighter" | "eraser";

interface ActiveStroke {
  id: string;
  pageId: string;
  points: StrokePoint[];
}

interface DrawingStore {
  tool: Tool;
  color: string;
  width: number;
  penStyle: PenStyle;
  activeStroke: ActiveStroke | null;
  pendingStrokesByPage: Record<string, Stroke[]>;
  debugLastPointCount: number;

  setTool: (tool: Tool) => void;
  setColor: (color: string) => void;
  setWidth: (width: number) => void;
  setPenStyle: (penStyle: PenStyle) => void;

  startStroke: (pageId: string, point: StrokePoint) => void;
  addPoint: (point: StrokePoint) => void;
  addPoints: (points: StrokePoint[]) => void;
  endStroke: () => void;

  flushPendingForPage: (pageId: string) => Stroke[];
  flushAllPending: () => Record<string, Stroke[]>;
}

export const useDrawingStore = create<DrawingStore>((set, get) => ({
  tool: "pen",
  color: DEFAULT_STROKE_COLOR,
  width: DEFAULT_STROKE_WIDTH,
  penStyle: "pressure",
  activeStroke: null,
  pendingStrokesByPage: {},
  debugLastPointCount: 0,

  setTool: (tool) => set({ tool }),
  setColor: (color) => set({ color }),
  setWidth: (width) => set({ width }),
  setPenStyle: (penStyle) => set({ penStyle }),

  startStroke: (pageId, point) => {
    set({ activeStroke: { id: generateStrokeId(), pageId, points: [point] } });
  },

  addPoint: (point) => {
    const { activeStroke } = get();
    if (!activeStroke) return;
    set({
      activeStroke: {
        ...activeStroke,
        points: [...activeStroke.points, point],
      },
    });
  },

  addPoints: (points) => {
    const { activeStroke } = get();
    if (!activeStroke || points.length === 0) return;
    set({
      activeStroke: {
        ...activeStroke,
        points: [...activeStroke.points, ...points],
      },
    });
  },

  endStroke: () => {
    const { activeStroke, tool, color, width, penStyle, pendingStrokesByPage } = get();
    if (!activeStroke || activeStroke.points.length < 2) {
      set({ activeStroke: null });
      return;
    }

    const stroke: Stroke = {
      id: activeStroke.id,
      points: activeStroke.points,
      color,
      width,
      penStyle,
      // Only store tool for highlighter - pen is the default
      ...(tool === "highlighter" ? { tool: "highlighter" as const } : {}),
      createdAt: new Date().toISOString(),
    };

    const pageId = activeStroke.pageId;
    const existing = pendingStrokesByPage[pageId] ?? [];

    set({
      activeStroke: null,
      debugLastPointCount: activeStroke.points.length,
      pendingStrokesByPage: {
        ...pendingStrokesByPage,
        [pageId]: [...existing, stroke],
      },
    });
  },

  flushPendingForPage: (pageId) => {
    const { pendingStrokesByPage } = get();
    const pending = pendingStrokesByPage[pageId] ?? [];
    if (pending.length === 0) return [];

    const { [pageId]: _, ...rest } = pendingStrokesByPage;
    set({ pendingStrokesByPage: rest });
    return pending;
  },

  flushAllPending: () => {
    const { pendingStrokesByPage } = get();
    set({ pendingStrokesByPage: {} });
    return pendingStrokesByPage;
  },
}));
