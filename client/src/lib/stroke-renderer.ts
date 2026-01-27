import getStroke from "perfect-freehand";

export interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
}

export interface StrokeData {
  id: string;
  points: StrokePoint[];
  color: string;
  width: number;
}

const STROKE_OPTIONS = {
  smoothing: 0.5,
  thinning: 0.5,
  streamline: 0.5,
  start: { taper: true },
  end: { taper: true },
};

export function getSvgPathFromStroke(stroke: StrokeData): string {
  const points = getStroke(
    stroke.points.map((p) => [p.x, p.y, p.pressure]),
    { ...STROKE_OPTIONS, size: stroke.width },
  );

  if (points.length === 0) return "";

  const d: string[] = [];
  d.push(`M ${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}`);

  for (let i = 1; i < points.length - 1; i++) {
    const cp = points[i];
    const next = points[i + 1];
    const mx = (cp[0] + next[0]) / 2;
    const my = (cp[1] + next[1]) / 2;
    d.push(
      `Q ${cp[0].toFixed(2)} ${cp[1].toFixed(2)} ${mx.toFixed(2)} ${my.toFixed(2)}`,
    );
  }

  if (points.length > 1) {
    const last = points[points.length - 1];
    d.push(`L ${last[0].toFixed(2)} ${last[1].toFixed(2)}`);
  }

  d.push("Z");
  return d.join(" ");
}
