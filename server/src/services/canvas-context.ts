/**
 * Type-safe wrapper for @napi-rs/canvas context.
 *
 * The @napi-rs/canvas library provides a Node.js-native canvas implementation
 * that's API-compatible with the browser's CanvasRenderingContext2D, but TypeScript
 * doesn't recognize the type compatibility. This module provides type-safe helpers
 * to bridge this gap without using unsafe `as unknown` casts throughout the codebase.
 */

import { createCanvas, type SKRSContext2D } from "@napi-rs/canvas";

/**
 * A subset of CanvasRenderingContext2D methods used in our stroke rendering.
 * This interface represents the API contract we need from any canvas context.
 */
export interface StrokeRenderingContext {
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
  closePath(): void;
  fill(): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  scale(x: number, y: number): void;
  fillStyle: string | CanvasGradient | CanvasPattern;
}

/**
 * Create a canvas context that's type-safe for our stroke rendering operations.
 * This wraps @napi-rs/canvas's createCanvas and returns a properly typed context.
 */
export function createRenderingCanvas(
  width: number,
  height: number,
): {
  canvas: ReturnType<typeof createCanvas>;
  ctx: StrokeRenderingContext;
} {
  const canvas = createCanvas(width, height);
  // SKRSContext2D from @napi-rs/canvas is API-compatible with our interface
  const ctx = canvas.getContext("2d") as StrokeRenderingContext;
  return { canvas, ctx };
}

/**
 * Type guard to check if a context is a valid StrokeRenderingContext.
 * Useful for validating contexts from different sources.
 */
export function isStrokeRenderingContext(
  ctx: unknown,
): ctx is StrokeRenderingContext {
  if (ctx === null || typeof ctx !== "object") return false;
  const c = ctx as Record<string, unknown>;
  return (
    typeof c.beginPath === "function" &&
    typeof c.moveTo === "function" &&
    typeof c.lineTo === "function" &&
    typeof c.quadraticCurveTo === "function" &&
    typeof c.closePath === "function" &&
    typeof c.fill === "function" &&
    typeof c.fillRect === "function" &&
    typeof c.scale === "function" &&
    "fillStyle" in c
  );
}

/**
 * Convert a canvas to a PNG buffer.
 * Handles the type conversion from @napi-rs/canvas's toBuffer method.
 */
export function canvasToPngBuffer(
  canvas: ReturnType<typeof createCanvas>,
): Buffer {
  return canvas.toBuffer("image/png");
}
