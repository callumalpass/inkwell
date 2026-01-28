import { describe, it, expect } from "vitest";
import {
  getSvgPathFromStroke,
  getSvgPathFromStrokeFilled,
  type StrokeData,
} from "./stroke-renderer";

function makeStroke(
  points: { x: number; y: number; pressure?: number }[],
  overrides?: Partial<StrokeData>,
): StrokeData {
  return {
    id: "test-stroke",
    color: "#000000",
    width: 3,
    penStyle: "pressure",
    ...overrides,
    points: points.map((p) => ({ x: p.x, y: p.y, pressure: p.pressure ?? 0.5 })),
  };
}

/** Simple stroke: a short horizontal line */
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

/** A multi-point curve (arc-like) */
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

// ─── SVG path format helpers ────────────────────────────────────────────

const SVG_MOVE = /^M\s/;
const SVG_CUBIC = /C\s/;
const SVG_QUAD = /Q\s/;

function parseSvgCommands(d: string): string[] {
  // Split on command letters while keeping them
  return d.split(/(?=[MCLQZ])/).filter(Boolean);
}

// ─── getSvgPathFromStroke (stroked / uniform-width path) ────────────────

describe("getSvgPathFromStroke", () => {
  describe("happy path", () => {
    it("returns a valid SVG path for a simple stroke", () => {
      const path = getSvgPathFromStroke(horizontalLine);
      expect(path).toBeTruthy();
      expect(path).toMatch(SVG_MOVE);
      expect(path).toMatch(SVG_CUBIC);
    });

    it("starts with an M (moveto) command", () => {
      const path = getSvgPathFromStroke(horizontalLine);
      expect(path.trimStart().startsWith("M")).toBe(true);
    });

    it("contains C (cubic bezier) commands from curve fitting", () => {
      const path = getSvgPathFromStroke(curveStroke);
      const commands = parseSvgCommands(path);
      const cubics = commands.filter((c) => c.startsWith("C"));
      expect(cubics.length).toBeGreaterThan(0);
    });

    it("formats coordinates with 2 decimal places", () => {
      const path = getSvgPathFromStroke(horizontalLine);
      // Extract all numbers from the path
      const numbers = path.match(/-?\d+\.\d+/g) ?? [];
      for (const num of numbers) {
        const decimals = num.split(".")[1];
        expect(decimals.length).toBe(2);
      }
    });

    it("produces output for a curved stroke", () => {
      const path = getSvgPathFromStroke(curveStroke);
      expect(path).toBeTruthy();
      const commands = parseSvgCommands(path);
      // Curve with 20 points should produce multiple Bezier segments
      expect(commands.length).toBeGreaterThan(2);
    });
  });

  describe("edge cases", () => {
    it("returns empty string for 0 points", () => {
      const stroke = makeStroke([]);
      expect(getSvgPathFromStroke(stroke)).toBe("");
    });

    it("returns empty string for 1 point", () => {
      const stroke = makeStroke([{ x: 50, y: 50 }]);
      expect(getSvgPathFromStroke(stroke)).toBe("");
    });

    it("handles 2 points (minimum valid)", () => {
      const stroke = makeStroke([
        { x: 0, y: 0 },
        { x: 100, y: 100 },
      ]);
      const path = getSvgPathFromStroke(stroke);
      // fit-curve may or may not produce a result for 2 points;
      // either empty or a valid path is acceptable
      if (path) {
        expect(path).toMatch(SVG_MOVE);
      }
    });

    it("handles coincident points", () => {
      const stroke = makeStroke([
        { x: 50, y: 50 },
        { x: 50, y: 50 },
        { x: 50, y: 50 },
      ]);
      const path = getSvgPathFromStroke(stroke);
      // Should not throw; empty or path is fine
      expect(typeof path).toBe("string");
    });

    it("handles very large coordinates", () => {
      const stroke = makeStroke([
        { x: 10000, y: 10000 },
        { x: 10050, y: 10050 },
        { x: 10100, y: 10100 },
      ]);
      const path = getSvgPathFromStroke(stroke);
      expect(path).toBeTruthy();
      expect(path).toMatch(/10[01]\d{2}\.\d{2}/);
    });

    it("handles negative coordinates", () => {
      const stroke = makeStroke([
        { x: -100, y: -100 },
        { x: -50, y: -50 },
        { x: 0, y: 0 },
      ]);
      const path = getSvgPathFromStroke(stroke);
      expect(path).toBeTruthy();
      expect(path).toContain("-");
    });
  });

  describe("consistency", () => {
    it("produces identical output for the same input", () => {
      const a = getSvgPathFromStroke(horizontalLine);
      const b = getSvgPathFromStroke(horizontalLine);
      expect(a).toBe(b);
    });

    it("ignores pressure values (stroked path has uniform width)", () => {
      const noPressure = makeStroke([
        { x: 0, y: 0, pressure: 0.1 },
        { x: 50, y: 50, pressure: 0.1 },
        { x: 100, y: 100, pressure: 0.1 },
      ]);
      const highPressure = makeStroke([
        { x: 0, y: 0, pressure: 0.9 },
        { x: 50, y: 50, pressure: 0.9 },
        { x: 100, y: 100, pressure: 0.9 },
      ]);
      // getSvgPathFromStroke only uses x,y — pressure doesn't affect the path
      expect(getSvgPathFromStroke(noPressure)).toBe(getSvgPathFromStroke(highPressure));
    });
  });
});

// ─── getSvgPathFromStrokeFilled (filled / pressure-sensitive path) ──────

describe("getSvgPathFromStrokeFilled", () => {
  describe("happy path", () => {
    it("returns a valid closed SVG path for a pressure stroke", () => {
      const path = getSvgPathFromStrokeFilled(diagonalWithPressure);
      expect(path).toBeTruthy();
      expect(path).toMatch(SVG_MOVE);
      expect(path).toContain("Z");
    });

    it("contains Q (quadratic bezier) commands for the outline", () => {
      const path = getSvgPathFromStrokeFilled(curveStroke);
      expect(path).toMatch(SVG_QUAD);
    });

    it("closes the path with Z", () => {
      const path = getSvgPathFromStrokeFilled(diagonalWithPressure);
      expect(path.trim().endsWith("Z")).toBe(true);
    });

    it("produces output for a long stroke", () => {
      const longStroke = makeStroke(
        Array.from({ length: 50 }, (_, i) => ({
          x: i * 5,
          y: Math.sin(i / 5) * 30,
          pressure: 0.3 + 0.4 * Math.abs(Math.sin(i / 10)),
        })),
      );
      const path = getSvgPathFromStrokeFilled(longStroke);
      expect(path).toBeTruthy();
      const commands = parseSvgCommands(path);
      expect(commands.length).toBeGreaterThan(5);
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

    it("renders with pressure pen style", () => {
      const stroke = makeStroke(testPoints, { penStyle: "pressure" });
      const path = getSvgPathFromStrokeFilled(stroke);
      expect(path).toBeTruthy();
      expect(path).toContain("Z");
    });

    it("renders with uniform pen style", () => {
      const stroke = makeStroke(testPoints, { penStyle: "uniform" });
      const path = getSvgPathFromStrokeFilled(stroke);
      expect(path).toBeTruthy();
      expect(path).toContain("Z");
    });

    it("renders with ballpoint pen style", () => {
      const stroke = makeStroke(testPoints, { penStyle: "ballpoint" });
      const path = getSvgPathFromStrokeFilled(stroke);
      expect(path).toBeTruthy();
      expect(path).toContain("Z");
    });

    it("defaults to pressure when penStyle is undefined", () => {
      const stroke = makeStroke(testPoints, { penStyle: undefined });
      const withPressure = makeStroke(testPoints, { penStyle: "pressure" });
      // Both should produce the same result since the default is "pressure"
      expect(getSvgPathFromStrokeFilled(stroke)).toBe(
        getSvgPathFromStrokeFilled(withPressure),
      );
    });

    it("produces different paths for pressure vs uniform styles", () => {
      const pressureStroke = makeStroke(testPoints, { penStyle: "pressure" });
      const uniformStroke = makeStroke(testPoints, { penStyle: "uniform" });
      // Uniform uses constant 0.5 pressure, pressure uses actual values
      // These should generally differ
      const pressurePath = getSvgPathFromStrokeFilled(pressureStroke);
      const uniformPath = getSvgPathFromStrokeFilled(uniformStroke);
      // Both valid, but different because pressure handling differs
      expect(pressurePath).toBeTruthy();
      expect(uniformPath).toBeTruthy();
      expect(pressurePath).not.toBe(uniformPath);
    });
  });

  describe("edge cases", () => {
    it("returns empty string for 0 points", () => {
      const stroke = makeStroke([], { penStyle: "pressure" });
      expect(getSvgPathFromStrokeFilled(stroke)).toBe("");
    });

    it("returns empty string for 1 point", () => {
      const stroke = makeStroke([{ x: 50, y: 50 }]);
      expect(getSvgPathFromStrokeFilled(stroke)).toBe("");
    });

    it("handles 2 points", () => {
      const stroke = makeStroke([
        { x: 0, y: 0, pressure: 0.5 },
        { x: 100, y: 0, pressure: 0.5 },
      ]);
      const path = getSvgPathFromStrokeFilled(stroke);
      // May be empty or a valid closed path
      if (path) {
        expect(path).toContain("Z");
      }
    });

    it("handles zero pressure on all points", () => {
      const stroke = makeStroke([
        { x: 0, y: 0, pressure: 0 },
        { x: 50, y: 50, pressure: 0 },
        { x: 100, y: 100, pressure: 0 },
      ]);
      const path = getSvgPathFromStrokeFilled(stroke);
      // Should not throw; perfect-freehand handles zero pressure
      expect(typeof path).toBe("string");
    });

    it("handles maximum pressure on all points", () => {
      const stroke = makeStroke([
        { x: 0, y: 0, pressure: 1 },
        { x: 50, y: 50, pressure: 1 },
        { x: 100, y: 100, pressure: 1 },
      ]);
      const path = getSvgPathFromStrokeFilled(stroke);
      expect(typeof path).toBe("string");
    });

    it("handles coincident points", () => {
      const stroke = makeStroke([
        { x: 50, y: 50, pressure: 0.5 },
        { x: 50, y: 50, pressure: 0.5 },
        { x: 50, y: 50, pressure: 0.5 },
      ]);
      const path = getSvgPathFromStrokeFilled(stroke);
      expect(typeof path).toBe("string");
    });

    it("handles near-coincident points (subpixel movement)", () => {
      const stroke = makeStroke([
        { x: 50, y: 50, pressure: 0.5 },
        { x: 50.01, y: 50.01, pressure: 0.5 },
        { x: 50.02, y: 50.02, pressure: 0.5 },
      ]);
      const path = getSvgPathFromStrokeFilled(stroke);
      expect(typeof path).toBe("string");
    });

    it("handles very wide stroke width", () => {
      const stroke = makeStroke(
        [
          { x: 0, y: 0, pressure: 0.5 },
          { x: 50, y: 50, pressure: 0.5 },
          { x: 100, y: 0, pressure: 0.5 },
        ],
        { width: 50 },
      );
      const path = getSvgPathFromStrokeFilled(stroke);
      expect(path).toBeTruthy();
    });

    it("handles very thin stroke width", () => {
      const stroke = makeStroke(
        [
          { x: 0, y: 0, pressure: 0.5 },
          { x: 50, y: 50, pressure: 0.5 },
          { x: 100, y: 0, pressure: 0.5 },
        ],
        { width: 0.5 },
      );
      const path = getSvgPathFromStrokeFilled(stroke);
      expect(typeof path).toBe("string");
    });
  });

  describe("pressure interpolation", () => {
    it("varying pressure produces different outline than constant pressure", () => {
      const points = [
        { x: 0, y: 0 },
        { x: 30, y: 0 },
        { x: 60, y: 0 },
        { x: 90, y: 0 },
        { x: 120, y: 0 },
      ];

      const varying = makeStroke(
        points.map((p, i) => ({
          ...p,
          pressure: i % 2 === 0 ? 0.2 : 0.8,
        })),
        { penStyle: "pressure" },
      );
      const constant = makeStroke(
        points.map((p) => ({ ...p, pressure: 0.5 })),
        { penStyle: "pressure" },
      );

      const varyingPath = getSvgPathFromStrokeFilled(varying);
      const constantPath = getSvgPathFromStrokeFilled(constant);

      expect(varyingPath).toBeTruthy();
      expect(constantPath).toBeTruthy();
      expect(varyingPath).not.toBe(constantPath);
    });

    it("uniform pen style ignores actual pressure values", () => {
      const basePoints = [
        { x: 0, y: 0 },
        { x: 30, y: 10 },
        { x: 60, y: 5 },
        { x: 90, y: 15 },
        { x: 120, y: 0 },
      ];

      const lowPressure = makeStroke(
        basePoints.map((p) => ({ ...p, pressure: 0.1 })),
        { penStyle: "uniform" },
      );
      const highPressure = makeStroke(
        basePoints.map((p) => ({ ...p, pressure: 0.9 })),
        { penStyle: "uniform" },
      );

      // Uniform mode passes constant 0.5, so original pressure is irrelevant
      expect(getSvgPathFromStrokeFilled(lowPressure)).toBe(
        getSvgPathFromStrokeFilled(highPressure),
      );
    });
  });

  describe("path structure", () => {
    it("always starts with M and ends with Z when non-empty", () => {
      const path = getSvgPathFromStrokeFilled(diagonalWithPressure);
      if (path) {
        const commands = parseSvgCommands(path);
        expect(commands[0]).toMatch(/^M\s/);
        expect(commands[commands.length - 1].trim()).toBe("Z");
      }
    });

    it("contains L command before Z for the closing segment", () => {
      const path = getSvgPathFromStrokeFilled(curveStroke);
      expect(path).toBeTruthy();
      const commands = parseSvgCommands(path);
      // The function adds L to the last point, then Z
      const lastNonZ = commands[commands.length - 2];
      expect(lastNonZ).toMatch(/^L\s/);
    });

    it("formats all coordinates with 2 decimal places", () => {
      const path = getSvgPathFromStrokeFilled(diagonalWithPressure);
      const numbers = path.match(/-?\d+\.\d+/g) ?? [];
      expect(numbers.length).toBeGreaterThan(0);
      for (const num of numbers) {
        const decimals = num.split(".")[1];
        expect(decimals.length).toBe(2);
      }
    });
  });

  describe("consistency", () => {
    it("produces identical output for the same input", () => {
      const a = getSvgPathFromStrokeFilled(diagonalWithPressure);
      const b = getSvgPathFromStrokeFilled(diagonalWithPressure);
      expect(a).toBe(b);
    });

    it("different colors do not affect path geometry", () => {
      const red = makeStroke(
        [
          { x: 0, y: 0 },
          { x: 50, y: 50 },
          { x: 100, y: 0 },
        ],
        { color: "#ff0000" },
      );
      const blue = makeStroke(
        [
          { x: 0, y: 0 },
          { x: 50, y: 50 },
          { x: 100, y: 0 },
        ],
        { color: "#0000ff" },
      );
      expect(getSvgPathFromStrokeFilled(red)).toBe(getSvgPathFromStrokeFilled(blue));
    });

    it("different stroke IDs do not affect path geometry", () => {
      const a = makeStroke(
        [
          { x: 0, y: 0 },
          { x: 50, y: 50 },
          { x: 100, y: 0 },
        ],
        { id: "stroke-a" },
      );
      const b = makeStroke(
        [
          { x: 0, y: 0 },
          { x: 50, y: 50 },
          { x: 100, y: 0 },
        ],
        { id: "stroke-b" },
      );
      expect(getSvgPathFromStrokeFilled(a)).toBe(getSvgPathFromStrokeFilled(b));
    });
  });
});
