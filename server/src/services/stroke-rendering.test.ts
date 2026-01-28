import type { Stroke } from "../types/index.js";
import type { StrokeRenderingContext } from "./canvas-context.js";
import {
  getStrokeOptions,
  getOutlinePoints,
  renderStrokeToCanvas,
  strokeToSvgPath,
  type PenStyle,
} from "./stroke-rendering.js";

// ─── Helpers ──────────────────────────────────────────────────────────

function makeStroke(
  points: { x: number; y: number; pressure?: number }[],
  overrides?: Partial<Stroke>,
): Stroke {
  return {
    id: "st_test",
    color: "#000000",
    width: 3,
    penStyle: "pressure",
    createdAt: new Date().toISOString(),
    ...overrides,
    points: points.map((p) => ({
      x: p.x,
      y: p.y,
      pressure: p.pressure ?? 0.5,
    })),
  };
}

/** A short horizontal line — minimal valid stroke */
const horizontalLine = makeStroke([
  { x: 0, y: 0 },
  { x: 50, y: 0 },
  { x: 100, y: 0 },
]);

/** Diagonal stroke with varying pressure */
const diagonalWithPressure = makeStroke([
  { x: 0, y: 0, pressure: 0.2 },
  { x: 25, y: 25, pressure: 0.5 },
  { x: 50, y: 50, pressure: 0.8 },
  { x: 75, y: 75, pressure: 0.5 },
  { x: 100, y: 100, pressure: 0.2 },
]);

/** A longer curve */
const curveStroke = makeStroke(
  Array.from({ length: 20 }, (_, i) => {
    const t = i / 19;
    return {
      x: t * 200,
      y: Math.sin(t * Math.PI) * 100,
      pressure: 0.3 + 0.4 * Math.sin(t * Math.PI),
    };
  }),
);

// ─── Canvas mock ──────────────────────────────────────────────────────

function createMockCtx(): StrokeRenderingContext & {
  beginPath: ReturnType<typeof vi.fn>;
  moveTo: ReturnType<typeof vi.fn>;
  quadraticCurveTo: ReturnType<typeof vi.fn>;
  lineTo: ReturnType<typeof vi.fn>;
  closePath: ReturnType<typeof vi.fn>;
  fill: ReturnType<typeof vi.fn>;
} {
  return {
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    scale: vi.fn(),
    fillStyle: "",
  };
}

// ─── SVG path helpers ─────────────────────────────────────────────────

function parseSvgCommands(d: string): string[] {
  return d.split(/(?=[MQLZ])/).filter(Boolean);
}

// ─── getStrokeOptions ─────────────────────────────────────────────────

describe("getStrokeOptions", () => {
  describe("happy path", () => {
    it("returns options for pressure pen style", () => {
      const opts = getStrokeOptions("pressure", 3);
      expect(opts.size).toBe(3);
      expect(opts.smoothing).toBe(0.5);
      expect(opts.thinning).toBe(0.5);
      expect(opts.start).toEqual({ taper: true });
      expect(opts.end).toEqual({ taper: true });
    });

    it("returns options for uniform pen style", () => {
      const opts = getStrokeOptions("uniform", 5);
      expect(opts.size).toBe(5);
      expect(opts.thinning).toBe(0);
      expect(opts.simulatePressure).toBe(false);
      expect(opts.start).toEqual({ taper: false });
      expect(opts.end).toEqual({ taper: false });
    });

    it("returns options for ballpoint pen style", () => {
      const opts = getStrokeOptions("ballpoint", 2);
      expect(opts.size).toBe(2);
      expect(opts.thinning).toBe(0.15);
      expect(opts.simulatePressure).toBe(true);
      expect(opts.start).toEqual({ taper: false });
      expect(opts.end).toEqual({ taper: 10 });
    });

    it("uses the provided width for each pen style", () => {
      for (const style of ["pressure", "uniform", "ballpoint"] as PenStyle[]) {
        expect(getStrokeOptions(style, 10).size).toBe(10);
        expect(getStrokeOptions(style, 0.5).size).toBe(0.5);
      }
    });
  });

  describe("pen style differences", () => {
    it("pressure style enables thinning, uniform does not", () => {
      expect(getStrokeOptions("pressure", 3).thinning).toBeGreaterThan(0);
      expect(getStrokeOptions("uniform", 3).thinning).toBe(0);
    });

    it("uniform disables simulated pressure", () => {
      expect(getStrokeOptions("uniform", 3).simulatePressure).toBe(false);
    });

    it("ballpoint enables simulated pressure", () => {
      expect(getStrokeOptions("ballpoint", 3).simulatePressure).toBe(true);
    });

    it("all styles share the same streamline value", () => {
      const styles: PenStyle[] = ["pressure", "uniform", "ballpoint"];
      const streamlines = styles.map((s) => getStrokeOptions(s, 3).streamline);
      expect(new Set(streamlines).size).toBe(1);
    });
  });
});

// ─── getOutlinePoints ─────────────────────────────────────────────────

describe("getOutlinePoints", () => {
  describe("happy path", () => {
    it("returns outline points for a simple stroke", () => {
      const points = getOutlinePoints(horizontalLine);
      expect(points).toBeInstanceOf(Array);
      expect(points.length).toBeGreaterThan(0);
    });

    it("returns points with x,y coordinates", () => {
      const points = getOutlinePoints(horizontalLine);
      for (const pt of points) {
        expect(pt).toBeInstanceOf(Array);
        expect(pt.length).toBeGreaterThanOrEqual(2);
        expect(typeof pt[0]).toBe("number");
        expect(typeof pt[1]).toBe("number");
      }
    });

    it("returns outline for all pen styles", () => {
      const styles: PenStyle[] = ["pressure", "uniform", "ballpoint"];
      for (const penStyle of styles) {
        const stroke = makeStroke(
          [
            { x: 0, y: 0, pressure: 0.5 },
            { x: 50, y: 25, pressure: 0.7 },
            { x: 100, y: 50, pressure: 0.5 },
            { x: 150, y: 25, pressure: 0.3 },
          ],
          { penStyle },
        );
        const points = getOutlinePoints(stroke);
        expect(points.length).toBeGreaterThan(0);
      }
    });

    it("returns more points for a longer stroke", () => {
      const short = makeStroke([
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 100, y: 0 },
      ]);
      const long = makeStroke(
        Array.from({ length: 30 }, (_, i) => ({
          x: i * 10,
          y: Math.sin(i / 3) * 50,
          pressure: 0.5,
        })),
      );
      expect(getOutlinePoints(long).length).toBeGreaterThan(
        getOutlinePoints(short).length,
      );
    });
  });

  describe("pen style behavior", () => {
    it("defaults to pressure when penStyle is undefined", () => {
      const withPressure = makeStroke(diagonalWithPressure.points, {
        penStyle: "pressure",
      });
      const withoutStyle = makeStroke(diagonalWithPressure.points, {
        penStyle: undefined,
      });

      const a = getOutlinePoints(withPressure);
      const b = getOutlinePoints(withoutStyle);
      expect(a).toEqual(b);
    });

    it("pressure style uses actual pressure values from points", () => {
      const lowPressure = makeStroke(
        [
          { x: 0, y: 0, pressure: 0.1 },
          { x: 50, y: 50, pressure: 0.1 },
          { x: 100, y: 100, pressure: 0.1 },
        ],
        { penStyle: "pressure" },
      );
      const highPressure = makeStroke(
        [
          { x: 0, y: 0, pressure: 0.9 },
          { x: 50, y: 50, pressure: 0.9 },
          { x: 100, y: 100, pressure: 0.9 },
        ],
        { penStyle: "pressure" },
      );
      // Different pressures should produce different outlines
      expect(getOutlinePoints(lowPressure)).not.toEqual(
        getOutlinePoints(highPressure),
      );
    });

    it("uniform style ignores actual pressure values", () => {
      const lowPressure = makeStroke(
        [
          { x: 0, y: 0, pressure: 0.1 },
          { x: 50, y: 50, pressure: 0.1 },
          { x: 100, y: 100, pressure: 0.1 },
        ],
        { penStyle: "uniform" },
      );
      const highPressure = makeStroke(
        [
          { x: 0, y: 0, pressure: 0.9 },
          { x: 50, y: 50, pressure: 0.9 },
          { x: 100, y: 100, pressure: 0.9 },
        ],
        { penStyle: "uniform" },
      );
      // Uniform maps all points to 0.5 pressure, so input pressure is ignored
      expect(getOutlinePoints(lowPressure)).toEqual(
        getOutlinePoints(highPressure),
      );
    });
  });

  describe("edge cases", () => {
    it("returns empty array for zero points", () => {
      const stroke = makeStroke([]);
      const points = getOutlinePoints(stroke);
      expect(points).toEqual([]);
    });

    it("handles a single point", () => {
      const stroke = makeStroke([{ x: 50, y: 50 }]);
      const points = getOutlinePoints(stroke);
      // perfect-freehand may or may not produce output for a single point
      expect(points).toBeInstanceOf(Array);
    });

    it("handles two points", () => {
      const stroke = makeStroke([
        { x: 0, y: 0, pressure: 0.5 },
        { x: 100, y: 100, pressure: 0.5 },
      ]);
      const points = getOutlinePoints(stroke);
      expect(points).toBeInstanceOf(Array);
    });

    it("handles coincident points", () => {
      const stroke = makeStroke([
        { x: 50, y: 50 },
        { x: 50, y: 50 },
        { x: 50, y: 50 },
      ]);
      const points = getOutlinePoints(stroke);
      expect(points).toBeInstanceOf(Array);
    });

    it("handles zero pressure on all points", () => {
      const stroke = makeStroke([
        { x: 0, y: 0, pressure: 0 },
        { x: 50, y: 50, pressure: 0 },
        { x: 100, y: 100, pressure: 0 },
      ]);
      // Should not throw
      const points = getOutlinePoints(stroke);
      expect(points).toBeInstanceOf(Array);
    });

    it("handles maximum pressure on all points", () => {
      const stroke = makeStroke([
        { x: 0, y: 0, pressure: 1 },
        { x: 50, y: 50, pressure: 1 },
        { x: 100, y: 100, pressure: 1 },
      ]);
      const points = getOutlinePoints(stroke);
      expect(points).toBeInstanceOf(Array);
      expect(points.length).toBeGreaterThan(0);
    });

    it("handles negative coordinates", () => {
      const stroke = makeStroke([
        { x: -100, y: -100, pressure: 0.5 },
        { x: -50, y: -50, pressure: 0.5 },
        { x: 0, y: 0, pressure: 0.5 },
      ]);
      const points = getOutlinePoints(stroke);
      expect(points.length).toBeGreaterThan(0);
    });

    it("handles very large coordinates", () => {
      const stroke = makeStroke([
        { x: 10000, y: 10000, pressure: 0.5 },
        { x: 10050, y: 10050, pressure: 0.5 },
        { x: 10100, y: 10100, pressure: 0.5 },
      ]);
      const points = getOutlinePoints(stroke);
      expect(points.length).toBeGreaterThan(0);
    });
  });

  describe("consistency", () => {
    it("produces identical output for the same input", () => {
      const a = getOutlinePoints(horizontalLine);
      const b = getOutlinePoints(horizontalLine);
      expect(a).toEqual(b);
    });

    it("color does not affect outline", () => {
      const red = makeStroke(horizontalLine.points, { color: "#ff0000" });
      const blue = makeStroke(horizontalLine.points, { color: "#0000ff" });
      expect(getOutlinePoints(red)).toEqual(getOutlinePoints(blue));
    });

    it("stroke id does not affect outline", () => {
      const a = makeStroke(horizontalLine.points, { id: "st_a" });
      const b = makeStroke(horizontalLine.points, { id: "st_b" });
      expect(getOutlinePoints(a)).toEqual(getOutlinePoints(b));
    });
  });
});

// ─── renderStrokeToCanvas ─────────────────────────────────────────────

describe("renderStrokeToCanvas", () => {
  describe("happy path", () => {
    it("draws a stroke onto the canvas context", () => {
      const ctx = createMockCtx();
      renderStrokeToCanvas(ctx, diagonalWithPressure);

      expect(ctx.beginPath).toHaveBeenCalledOnce();
      expect(ctx.moveTo).toHaveBeenCalledOnce();
      expect(ctx.closePath).toHaveBeenCalledOnce();
      expect(ctx.fill).toHaveBeenCalledOnce();
    });

    it("sets fillStyle to the stroke color", () => {
      const ctx = createMockCtx();
      const stroke = makeStroke(
        [
          { x: 0, y: 0 },
          { x: 50, y: 50 },
          { x: 100, y: 0 },
          { x: 150, y: 50 },
        ],
        { color: "#ff0000" },
      );
      renderStrokeToCanvas(ctx, stroke);
      expect(ctx.fillStyle).toBe("#ff0000");
    });

    it("defaults color to #000000 when stroke has empty color", () => {
      const ctx = createMockCtx();
      const stroke = makeStroke(
        [
          { x: 0, y: 0 },
          { x: 50, y: 50 },
          { x: 100, y: 0 },
          { x: 150, y: 50 },
        ],
        { color: "" },
      );
      renderStrokeToCanvas(ctx, stroke);
      expect(ctx.fillStyle).toBe("#000000");
    });

    it("uses quadratic curves for the outline", () => {
      const ctx = createMockCtx();
      renderStrokeToCanvas(ctx, curveStroke);
      expect(ctx.quadraticCurveTo).toHaveBeenCalled();
    });

    it("calls lineTo for the last point", () => {
      const ctx = createMockCtx();
      renderStrokeToCanvas(ctx, diagonalWithPressure);
      expect(ctx.lineTo).toHaveBeenCalled();
    });
  });

  describe("scaling", () => {
    it("applies default scale of 1,1", () => {
      const ctx = createMockCtx();
      renderStrokeToCanvas(ctx, diagonalWithPressure);

      // With scale 1,1, the moveTo coordinates should match the outline
      const outlinePoints = getOutlinePoints(diagonalWithPressure);
      expect(ctx.moveTo).toHaveBeenCalledWith(
        outlinePoints[0][0],
        outlinePoints[0][1],
      );
    });

    it("scales coordinates when scaleX and scaleY are provided", () => {
      const ctx = createMockCtx();
      const scaleX = 0.5;
      const scaleY = 0.25;
      renderStrokeToCanvas(ctx, diagonalWithPressure, scaleX, scaleY);

      const outlinePoints = getOutlinePoints(diagonalWithPressure);
      expect(ctx.moveTo).toHaveBeenCalledWith(
        outlinePoints[0][0] * scaleX,
        outlinePoints[0][1] * scaleY,
      );
    });

    it("handles very small scale factors (thumbnail)", () => {
      const ctx = createMockCtx();
      // Simulating thumbnail scale: 200/1404 ≈ 0.142
      renderStrokeToCanvas(ctx, diagonalWithPressure, 0.142, 0.142);

      expect(ctx.beginPath).toHaveBeenCalled();
      expect(ctx.fill).toHaveBeenCalled();
    });

    it("handles scale factors greater than 1", () => {
      const ctx = createMockCtx();
      renderStrokeToCanvas(ctx, horizontalLine, 2, 3);
      expect(ctx.fill).toHaveBeenCalled();
    });
  });

  describe("edge cases", () => {
    it("does not draw when stroke has empty points", () => {
      const ctx = createMockCtx();
      const empty = makeStroke([]);
      renderStrokeToCanvas(ctx, empty);
      // getOutlinePoints returns [] for empty, so beginPath should not be called
      expect(ctx.beginPath).not.toHaveBeenCalled();
      expect(ctx.fill).not.toHaveBeenCalled();
    });

    it("renders all pen styles without error", () => {
      const styles: PenStyle[] = ["pressure", "uniform", "ballpoint"];
      for (const penStyle of styles) {
        const ctx = createMockCtx();
        const stroke = makeStroke(
          [
            { x: 0, y: 0, pressure: 0.5 },
            { x: 50, y: 50, pressure: 0.7 },
            { x: 100, y: 0, pressure: 0.5 },
            { x: 150, y: 50, pressure: 0.3 },
          ],
          { penStyle },
        );
        expect(() => renderStrokeToCanvas(ctx, stroke)).not.toThrow();
      }
    });
  });
});

// ─── strokeToSvgPath ──────────────────────────────────────────────────

describe("strokeToSvgPath", () => {
  describe("happy path", () => {
    it("returns path and color for a valid stroke", () => {
      const result = strokeToSvgPath(diagonalWithPressure);
      expect(result).not.toBeNull();
      expect(result!.path).toBeTruthy();
      expect(result!.color).toBe("#000000");
    });

    it("starts with M command", () => {
      const result = strokeToSvgPath(diagonalWithPressure);
      expect(result!.path).toMatch(/^M\s/);
    });

    it("contains Q (quadratic bezier) commands", () => {
      const result = strokeToSvgPath(curveStroke);
      expect(result!.path).toContain("Q ");
    });

    it("closes the path with Z", () => {
      const result = strokeToSvgPath(diagonalWithPressure);
      expect(result!.path.trim()).toMatch(/Z$/);
    });

    it("contains L command before Z for closing segment", () => {
      const result = strokeToSvgPath(curveStroke);
      const commands = parseSvgCommands(result!.path);
      const lastNonZ = commands[commands.length - 2];
      expect(lastNonZ).toMatch(/^L\s/);
    });

    it("uses the stroke color", () => {
      const stroke = makeStroke(
        [
          { x: 0, y: 0 },
          { x: 50, y: 50 },
          { x: 100, y: 0 },
          { x: 150, y: 50 },
        ],
        { color: "#ff5733" },
      );
      const result = strokeToSvgPath(stroke);
      expect(result!.color).toBe("#ff5733");
    });

    it("defaults color to #000000 when stroke color is empty", () => {
      const stroke = makeStroke(
        [
          { x: 0, y: 0 },
          { x: 50, y: 50 },
          { x: 100, y: 0 },
          { x: 150, y: 50 },
        ],
        { color: "" },
      );
      const result = strokeToSvgPath(stroke);
      expect(result!.color).toBe("#000000");
    });
  });

  describe("pen styles", () => {
    const testPoints = [
      { x: 0, y: 0, pressure: 0.3 },
      { x: 20, y: 10, pressure: 0.6 },
      { x: 40, y: 5, pressure: 0.8 },
      { x: 60, y: 15, pressure: 0.5 },
      { x: 80, y: 0, pressure: 0.3 },
    ];

    it("produces SVG path for pressure style", () => {
      const result = strokeToSvgPath(makeStroke(testPoints, { penStyle: "pressure" }));
      expect(result).not.toBeNull();
      expect(result!.path).toContain("Z");
    });

    it("produces SVG path for uniform style", () => {
      const result = strokeToSvgPath(makeStroke(testPoints, { penStyle: "uniform" }));
      expect(result).not.toBeNull();
      expect(result!.path).toContain("Z");
    });

    it("produces SVG path for ballpoint style", () => {
      const result = strokeToSvgPath(makeStroke(testPoints, { penStyle: "ballpoint" }));
      expect(result).not.toBeNull();
      expect(result!.path).toContain("Z");
    });

    it("pressure and uniform styles produce different paths", () => {
      const pressureResult = strokeToSvgPath(
        makeStroke(testPoints, { penStyle: "pressure" }),
      );
      const uniformResult = strokeToSvgPath(
        makeStroke(testPoints, { penStyle: "uniform" }),
      );
      expect(pressureResult!.path).not.toBe(uniformResult!.path);
    });
  });

  describe("edge cases", () => {
    it("returns null for zero points", () => {
      const stroke = makeStroke([]);
      expect(strokeToSvgPath(stroke)).toBeNull();
    });

    it("handles a single point", () => {
      const stroke = makeStroke([{ x: 50, y: 50 }]);
      const result = strokeToSvgPath(stroke);
      // perfect-freehand may return empty for single point
      if (result) {
        expect(result.path).toMatch(/^M\s/);
      }
    });

    it("handles two points", () => {
      const stroke = makeStroke([
        { x: 0, y: 0, pressure: 0.5 },
        { x: 100, y: 100, pressure: 0.5 },
      ]);
      const result = strokeToSvgPath(stroke);
      // May be null or a valid path
      if (result) {
        expect(result.path).toMatch(/^M\s/);
        expect(result.path).toContain("Z");
      }
    });

    it("handles coincident points without throwing", () => {
      const stroke = makeStroke([
        { x: 50, y: 50 },
        { x: 50, y: 50 },
        { x: 50, y: 50 },
      ]);
      expect(() => strokeToSvgPath(stroke)).not.toThrow();
    });

    it("handles zero pressure", () => {
      const stroke = makeStroke([
        { x: 0, y: 0, pressure: 0 },
        { x: 50, y: 50, pressure: 0 },
        { x: 100, y: 100, pressure: 0 },
      ]);
      expect(() => strokeToSvgPath(stroke)).not.toThrow();
    });

    it("handles negative coordinates", () => {
      const stroke = makeStroke([
        { x: -100, y: -100, pressure: 0.5 },
        { x: -50, y: -50, pressure: 0.5 },
        { x: 0, y: 0, pressure: 0.5 },
      ]);
      const result = strokeToSvgPath(stroke);
      expect(result).not.toBeNull();
      expect(result!.path).toContain("-");
    });

    it("handles very large coordinates", () => {
      const stroke = makeStroke([
        { x: 10000, y: 10000, pressure: 0.5 },
        { x: 10050, y: 10050, pressure: 0.5 },
        { x: 10100, y: 10100, pressure: 0.5 },
      ]);
      const result = strokeToSvgPath(stroke);
      expect(result).not.toBeNull();
    });
  });

  describe("consistency", () => {
    it("produces identical output for the same input", () => {
      const a = strokeToSvgPath(diagonalWithPressure);
      const b = strokeToSvgPath(diagonalWithPressure);
      expect(a).toEqual(b);
    });

    it("color does not affect path geometry", () => {
      const redStroke = makeStroke(horizontalLine.points, { color: "#ff0000" });
      const blueStroke = makeStroke(horizontalLine.points, { color: "#0000ff" });
      const red = strokeToSvgPath(redStroke);
      const blue = strokeToSvgPath(blueStroke);
      expect(red!.path).toBe(blue!.path);
      expect(red!.color).not.toBe(blue!.color);
    });

    it("stroke id does not affect path geometry", () => {
      const a = strokeToSvgPath(makeStroke(horizontalLine.points, { id: "st_a" }));
      const b = strokeToSvgPath(makeStroke(horizontalLine.points, { id: "st_b" }));
      expect(a!.path).toBe(b!.path);
    });
  });

  describe("path structure", () => {
    it("path has expected command sequence: M, Q*, L, Z", () => {
      const result = strokeToSvgPath(curveStroke);
      expect(result).not.toBeNull();
      const commands = parseSvgCommands(result!.path);
      expect(commands[0]).toMatch(/^M\s/);
      expect(commands[commands.length - 1].trim()).toBe("Z");

      // Middle commands should be Q or L
      for (let i = 1; i < commands.length - 1; i++) {
        expect(commands[i]).toMatch(/^[QL]\s/);
      }
    });

    it("M command has exactly 2 coordinate values", () => {
      const result = strokeToSvgPath(diagonalWithPressure);
      const mCommand = result!.path.match(/^M\s+(-?\d+\.?\d*)\s+(-?\d+\.?\d*)/);
      expect(mCommand).not.toBeNull();
      expect(typeof parseFloat(mCommand![1])).toBe("number");
      expect(typeof parseFloat(mCommand![2])).toBe("number");
    });

    it("Q commands have 4 coordinate values (control + end point)", () => {
      const result = strokeToSvgPath(curveStroke);
      const qCommands = result!.path.match(
        /Q\s+-?\d+\.?\d*\s+-?\d+\.?\d*\s+-?\d+\.?\d*\s+-?\d+\.?\d*/g,
      );
      expect(qCommands).not.toBeNull();
      expect(qCommands!.length).toBeGreaterThan(0);
    });

    it("more input points produce more path commands", () => {
      const short = strokeToSvgPath(horizontalLine);
      const long = strokeToSvgPath(curveStroke);
      if (short && long) {
        const shortCmds = parseSvgCommands(short.path);
        const longCmds = parseSvgCommands(long.path);
        expect(longCmds.length).toBeGreaterThan(shortCmds.length);
      }
    });
  });
});
