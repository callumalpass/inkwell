export interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
}

export interface Stroke {
  id: string;
  points: StrokePoint[];
  color: string;
  width: number;
  penStyle?: "pressure" | "uniform" | "ballpoint";
  tool?: "pen" | "highlighter";
  createdAt: string;
}
