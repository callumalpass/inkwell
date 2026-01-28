import fitCurve from "fit-curve";
import getStroke from "perfect-freehand";
import { getStrokeOptions, type PenStyle } from "./pen-styles";

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
  penStyle?: PenStyle;
}

type Point2D = [number, number];
type BezierCurve = [Point2D, Point2D, Point2D, Point2D];

function evaluateBezier(
  p0: Point2D,
  p1: Point2D,
  p2: Point2D,
  p3: Point2D,
  t: number,
): Point2D {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  return [
    mt2 * mt * p0[0] + 3 * mt2 * t * p1[0] + 3 * mt * t2 * p2[0] + t2 * t * p3[0],
    mt2 * mt * p0[1] + 3 * mt2 * t * p1[1] + 3 * mt * t2 * p2[1] + t2 * t * p3[1],
  ];
}

function sampleBezierCurves(
  curves: BezierCurve[],
  samplesPerCurve: number = 8,
): Point2D[] {
  const result: Point2D[] = [];
  for (const [p0, p1, p2, p3] of curves) {
    for (let i = 0; i < samplesPerCurve; i++) {
      result.push(evaluateBezier(p0, p1, p2, p3, i / samplesPerCurve));
    }
  }
  const last = curves[curves.length - 1];
  result.push(last[3]);
  return result;
}

function interpolatePressure(
  originalPoints: StrokePoint[],
  sampledPoints: Point2D[],
): number[] {
  // Cumulative arc lengths for original points
  const origLen: number[] = [0];
  for (let i = 1; i < originalPoints.length; i++) {
    const dx = originalPoints[i].x - originalPoints[i - 1].x;
    const dy = originalPoints[i].y - originalPoints[i - 1].y;
    origLen.push(origLen[i - 1] + Math.sqrt(dx * dx + dy * dy));
  }
  const totalOrig = origLen[origLen.length - 1];

  // Cumulative arc lengths for sampled points
  const sampLen: number[] = [0];
  for (let i = 1; i < sampledPoints.length; i++) {
    const dx = sampledPoints[i][0] - sampledPoints[i - 1][0];
    const dy = sampledPoints[i][1] - sampledPoints[i - 1][1];
    sampLen.push(sampLen[i - 1] + Math.sqrt(dx * dx + dy * dy));
  }
  const totalSamp = sampLen[sampLen.length - 1];

  // Interpolate pressure by matching arc-length fractions
  const pressures: number[] = [];
  let idx = 0;
  for (let i = 0; i < sampledPoints.length; i++) {
    const frac = totalSamp > 0 ? sampLen[i] / totalSamp : 0;
    const target = frac * totalOrig;

    while (idx < origLen.length - 2 && origLen[idx + 1] < target) {
      idx++;
    }

    const segLen = origLen[idx + 1] - origLen[idx];
    const t = segLen > 0 ? (target - origLen[idx]) / segLen : 0;
    const p0 = originalPoints[idx].pressure;
    const p1 = originalPoints[Math.min(idx + 1, originalPoints.length - 1)].pressure;
    pressures.push(p0 + (p1 - p0) * Math.max(0, Math.min(1, t)));
  }

  return pressures;
}

/**
 * Renders stroke as a stroked SVG path (uniform width).
 * Uses Schneider's algorithm for optimal bezier fitting.
 */
export function getSvgPathFromStroke(stroke: StrokeData): string {
  const pts = stroke.points;
  if (pts.length < 2) return "";

  const f = (n: number) => n.toFixed(2);

  const points2d: Point2D[] = pts.map((p) => [p.x, p.y]);
  const curves = fitCurve(points2d, 0.5);

  if (curves.length === 0) return "";

  const d: string[] = [];
  d.push(`M ${f(curves[0][0][0])} ${f(curves[0][0][1])}`);

  for (const [, cp1, cp2, end] of curves) {
    d.push(
      `C ${f(cp1[0])} ${f(cp1[1])} ${f(cp2[0])} ${f(cp2[1])} ${f(end[0])} ${f(end[1])}`,
    );
  }

  return d.join(" ");
}

/**
 * Renders stroke as a filled SVG path with variable width.
 * Schneider fits the centerline, then perfect-freehand generates
 * the pressure-sensitive outline.
 */
export function getSvgPathFromStrokeFilled(stroke: StrokeData): string {
  const penStyle = stroke.penStyle ?? "pressure";
  const options = getStrokeOptions(penStyle, stroke.width);

  const points2d: Point2D[] = stroke.points.map((p) => [p.x, p.y]);
  const curves = fitCurve(points2d, 0.5) as BezierCurve[];

  if (curves.length === 0) return "";

  // Sample the fitted beziers densely
  const sampled = sampleBezierCurves(curves, 8);

  // Map pressure from original sparse points to dense samples
  const pressures = interpolatePressure(stroke.points, sampled);

  const inputPoints =
    penStyle === "pressure"
      ? sampled.map((p, i) => [p[0], p[1], pressures[i]])
      : sampled.map((p) => [p[0], p[1], 0.5]);

  const points = getStroke(inputPoints, options);

  if (points.length === 0) return "";

  const f = (n: number) => n.toFixed(2);
  const d: string[] = [];
  d.push(`M ${f(points[0][0])} ${f(points[0][1])}`);

  for (let i = 1; i < points.length - 1; i++) {
    const cp = points[i];
    const next = points[i + 1];
    const mx = (cp[0] + next[0]) / 2;
    const my = (cp[1] + next[1]) / 2;
    d.push(`Q ${f(cp[0])} ${f(cp[1])} ${f(mx)} ${f(my)}`);
  }

  if (points.length > 1) {
    const last = points[points.length - 1];
    d.push(`L ${f(last[0])} ${f(last[1])}`);
  }

  d.push("Z");
  return d.join(" ");
}
