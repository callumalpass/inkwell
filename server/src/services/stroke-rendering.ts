import getStroke from "perfect-freehand";
import type { Stroke, StrokePoint } from "../types/index.js";

export type PenStyle = "pressure" | "uniform" | "ballpoint";

export function getStrokeOptions(penStyle: PenStyle, width: number) {
  switch (penStyle) {
    case "pressure":
      return {
        size: width,
        smoothing: 0.5,
        thinning: 0.5,
        streamline: 0.5,
        start: { taper: true },
        end: { taper: true },
      };
    case "uniform":
      return {
        size: width,
        smoothing: 0.5,
        thinning: 0,
        streamline: 0.5,
        simulatePressure: false,
        start: { taper: false },
        end: { taper: false },
      };
    case "ballpoint":
      return {
        size: width,
        smoothing: 0.5,
        thinning: 0.15,
        streamline: 0.5,
        simulatePressure: true,
        start: { taper: false },
        end: { taper: 10 },
      };
  }
}

/**
 * Compute the Perfect Freehand outline points for a stroke.
 */
export function getOutlinePoints(stroke: Stroke): number[][] {
  const penStyle: PenStyle = stroke.penStyle ?? "pressure";
  const options = getStrokeOptions(penStyle, stroke.width);

  const inputPoints =
    penStyle === "pressure"
      ? stroke.points.map((p: StrokePoint) => [p.x, p.y, p.pressure])
      : stroke.points.map((p: StrokePoint) => [p.x, p.y, 0.5]);

  return getStroke(inputPoints, options);
}

/**
 * Render a stroke to a Canvas 2D context, with optional scaling.
 */
export function renderStrokeToCanvas(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  scaleX: number = 1,
  scaleY: number = 1,
) {
  const outlinePoints = getOutlinePoints(stroke);
  if (outlinePoints.length === 0) return;

  ctx.beginPath();
  ctx.moveTo(outlinePoints[0][0] * scaleX, outlinePoints[0][1] * scaleY);

  for (let i = 1; i < outlinePoints.length - 1; i++) {
    const cp = outlinePoints[i];
    const next = outlinePoints[i + 1];
    const mx = (cp[0] + next[0]) / 2;
    const my = (cp[1] + next[1]) / 2;
    ctx.quadraticCurveTo(
      cp[0] * scaleX,
      cp[1] * scaleY,
      mx * scaleX,
      my * scaleY,
    );
  }

  if (outlinePoints.length > 1) {
    const last = outlinePoints[outlinePoints.length - 1];
    ctx.lineTo(last[0] * scaleX, last[1] * scaleY);
  }

  ctx.closePath();
  ctx.fillStyle = stroke.color || "#000000";
  ctx.fill();
}

/**
 * Convert a stroke to an SVG path string.
 * Returns the path data and fill color, or null if the stroke produces no outline.
 */
export function strokeToSvgPath(stroke: Stroke): { path: string; color: string } | null {
  const outlinePoints = getOutlinePoints(stroke);
  if (outlinePoints.length === 0) return null;

  const parts: string[] = [];
  parts.push(`M ${outlinePoints[0][0]} ${outlinePoints[0][1]}`);

  for (let i = 1; i < outlinePoints.length - 1; i++) {
    const cp = outlinePoints[i];
    const next = outlinePoints[i + 1];
    const mx = (cp[0] + next[0]) / 2;
    const my = (cp[1] + next[1]) / 2;
    parts.push(`Q ${cp[0]} ${cp[1]} ${mx} ${my}`);
  }

  if (outlinePoints.length > 1) {
    const last = outlinePoints[outlinePoints.length - 1];
    parts.push(`L ${last[0]} ${last[1]}`);
  }

  parts.push("Z");

  return { path: parts.join(" "), color: stroke.color || "#000000" };
}
