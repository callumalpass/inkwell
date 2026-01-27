import { create } from "zustand";
import type { StrokePoint } from "../lib/stroke-renderer";
import type { Stroke } from "../api/strokes";
import { generateStrokeId } from "../lib/id";
import { DEFAULT_STROKE_COLOR, DEFAULT_STROKE_WIDTH } from "../lib/constants";

export type Tool = "pen" | "eraser";

interface DrawingStore {
  tool: Tool;
  color: string;
  width: number;
  activeStroke: { id: string; points: StrokePoint[] } | null;
  pendingStrokes: Stroke[];

  setTool: (tool: Tool) => void;
  setColor: (color: string) => void;
  setWidth: (width: number) => void;

  startStroke: (point: StrokePoint) => void;
  addPoint: (point: StrokePoint) => void;
  endStroke: () => void;

  flushPending: () => Stroke[];
}

export const useDrawingStore = create<DrawingStore>((set, get) => ({
  tool: "pen",
  color: DEFAULT_STROKE_COLOR,
  width: DEFAULT_STROKE_WIDTH,
  activeStroke: null,
  pendingStrokes: [],

  setTool: (tool) => set({ tool }),
  setColor: (color) => set({ color }),
  setWidth: (width) => set({ width }),

  startStroke: (point) => {
    set({ activeStroke: { id: generateStrokeId(), points: [point] } });
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

  endStroke: () => {
    const { activeStroke, color, width, pendingStrokes } = get();
    if (!activeStroke || activeStroke.points.length < 2) {
      set({ activeStroke: null });
      return;
    }

    const stroke: Stroke = {
      id: activeStroke.id,
      points: activeStroke.points,
      color,
      width,
      createdAt: new Date().toISOString(),
    };

    set({
      activeStroke: null,
      pendingStrokes: [...pendingStrokes, stroke],
    });
  },

  flushPending: () => {
    const { pendingStrokes } = get();
    set({ pendingStrokes: [] });
    return pendingStrokes;
  },
}));
