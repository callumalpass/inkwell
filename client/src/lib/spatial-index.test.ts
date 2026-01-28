import { StrokeSpatialIndex } from "./spatial-index";
import type { Stroke } from "../api/strokes";

function makeStroke(
  id: string,
  points: { x: number; y: number; pressure?: number }[],
): Stroke {
  return {
    id,
    color: "#000000",
    width: 2,
    createdAt: new Date().toISOString(),
    points: points.map((p) => ({ x: p.x, y: p.y, pressure: p.pressure ?? 0.5 })),
  };
}

describe("StrokeSpatialIndex", () => {
  describe("construction", () => {
    it("creates an empty index", () => {
      const idx = new StrokeSpatialIndex();
      expect(idx.size).toBe(0);
    });

    it("builds from an array of strokes", () => {
      const strokes = [
        makeStroke("s1", [{ x: 10, y: 10 }, { x: 20, y: 20 }]),
        makeStroke("s2", [{ x: 100, y: 100 }, { x: 110, y: 110 }]),
      ];
      const idx = StrokeSpatialIndex.fromStrokes(strokes);
      expect(idx.size).toBe(2);
    });

    it("skips strokes with no points", () => {
      const idx = StrokeSpatialIndex.fromStrokes([makeStroke("s1", [])]);
      expect(idx.size).toBe(0);
    });
  });

  describe("queryPoint", () => {
    it("finds a stroke near the query point", () => {
      const stroke = makeStroke("s1", [{ x: 50, y: 50 }, { x: 55, y: 55 }]);
      const idx = StrokeSpatialIndex.fromStrokes([stroke]);

      const hit = idx.queryPoint(52, 52, 20);
      expect(hit).not.toBeNull();
      expect(hit!.id).toBe("s1");
    });

    it("returns null when no stroke is close enough", () => {
      const stroke = makeStroke("s1", [{ x: 50, y: 50 }, { x: 55, y: 55 }]);
      const idx = StrokeSpatialIndex.fromStrokes([stroke]);

      const hit = idx.queryPoint(500, 500, 20);
      expect(hit).toBeNull();
    });

    it("respects the threshold distance", () => {
      const stroke = makeStroke("s1", [{ x: 50, y: 50 }]);
      const idx = StrokeSpatialIndex.fromStrokes([stroke]);

      // 30 pixels away, threshold of 20 → should miss
      expect(idx.queryPoint(80, 50, 20)).toBeNull();

      // Same distance, but larger threshold → should hit
      expect(idx.queryPoint(80, 50, 35)).not.toBeNull();
    });

    it("finds the correct stroke among multiple", () => {
      const strokes = [
        makeStroke("s1", [{ x: 10, y: 10 }, { x: 15, y: 15 }]),
        makeStroke("s2", [{ x: 200, y: 200 }, { x: 210, y: 210 }]),
        makeStroke("s3", [{ x: 500, y: 500 }, { x: 510, y: 510 }]),
      ];
      const idx = StrokeSpatialIndex.fromStrokes(strokes);

      const hit = idx.queryPoint(205, 205, 20);
      expect(hit).not.toBeNull();
      expect(hit!.id).toBe("s2");
    });

    it("handles strokes spanning multiple grid cells", () => {
      // A stroke that goes from (10,10) to (300,300) spans many cells
      const stroke = makeStroke("s1", [
        { x: 10, y: 10 },
        { x: 150, y: 150 },
        { x: 300, y: 300 },
      ]);
      const idx = StrokeSpatialIndex.fromStrokes(stroke.points.length > 0 ? [stroke] : []);

      // Query near the middle point
      expect(idx.queryPoint(152, 152, 10)).not.toBeNull();

      // Query near the end point
      expect(idx.queryPoint(302, 302, 10)).not.toBeNull();
    });
  });

  describe("removeStroke", () => {
    it("removes a stroke so it no longer appears in queries", () => {
      const stroke = makeStroke("s1", [{ x: 50, y: 50 }]);
      const idx = StrokeSpatialIndex.fromStrokes([stroke]);

      expect(idx.queryPoint(50, 50, 10)).not.toBeNull();
      expect(idx.size).toBe(1);

      idx.removeStroke("s1");

      expect(idx.queryPoint(50, 50, 10)).toBeNull();
      expect(idx.size).toBe(0);
    });

    it("removing a non-existent stroke is a no-op", () => {
      const idx = StrokeSpatialIndex.fromStrokes([
        makeStroke("s1", [{ x: 50, y: 50 }]),
      ]);

      idx.removeStroke("nonexistent");
      expect(idx.size).toBe(1);
    });

    it("only removes the specified stroke, not others", () => {
      const strokes = [
        makeStroke("s1", [{ x: 50, y: 50 }]),
        makeStroke("s2", [{ x: 55, y: 55 }]),
      ];
      const idx = StrokeSpatialIndex.fromStrokes(strokes);

      idx.removeStroke("s1");

      expect(idx.size).toBe(1);
      const hit = idx.queryPoint(55, 55, 10);
      expect(hit).not.toBeNull();
      expect(hit!.id).toBe("s2");
    });
  });

  describe("addStroke", () => {
    it("adds a stroke to an existing index", () => {
      const idx = new StrokeSpatialIndex();
      expect(idx.size).toBe(0);

      idx.addStroke(makeStroke("s1", [{ x: 50, y: 50 }]));
      expect(idx.size).toBe(1);
      expect(idx.queryPoint(50, 50, 10)).not.toBeNull();
    });
  });

  describe("custom cell size", () => {
    it("works with a small cell size", () => {
      const stroke = makeStroke("s1", [{ x: 50, y: 50 }]);
      const idx = StrokeSpatialIndex.fromStrokes([stroke], 10);
      expect(idx.queryPoint(50, 50, 5)).not.toBeNull();
    });

    it("works with a large cell size", () => {
      const stroke = makeStroke("s1", [{ x: 50, y: 50 }]);
      const idx = StrokeSpatialIndex.fromStrokes([stroke], 1000);
      expect(idx.queryPoint(50, 50, 5)).not.toBeNull();
    });
  });

  describe("edge cases", () => {
    it("handles strokes at the origin (0,0)", () => {
      const stroke = makeStroke("s1", [{ x: 0, y: 0 }]);
      const idx = StrokeSpatialIndex.fromStrokes([stroke]);
      expect(idx.queryPoint(0, 0, 5)).not.toBeNull();
    });

    it("handles negative coordinates", () => {
      const stroke = makeStroke("s1", [{ x: -50, y: -50 }]);
      const idx = StrokeSpatialIndex.fromStrokes([stroke]);
      expect(idx.queryPoint(-50, -50, 5)).not.toBeNull();
    });

    it("handles a stroke with a single point", () => {
      const stroke = makeStroke("s1", [{ x: 100, y: 100 }]);
      const idx = StrokeSpatialIndex.fromStrokes([stroke]);
      expect(idx.queryPoint(100, 100, 5)).not.toBeNull();
    });

    it("handles many strokes efficiently", () => {
      const strokes: Stroke[] = [];
      for (let i = 0; i < 500; i++) {
        strokes.push(
          makeStroke(`s${i}`, [
            { x: i * 10, y: i * 10 },
            { x: i * 10 + 5, y: i * 10 + 5 },
          ]),
        );
      }
      const idx = StrokeSpatialIndex.fromStrokes(strokes);
      expect(idx.size).toBe(500);

      // Query near the 250th stroke (x=2500, y=2500).
      // s249 has points at (2490,2490) and (2495,2495) — both within 10px.
      // s250 has points at (2500,2500) — exact match.
      // The spatial index may return either; just verify we get one of them.
      const hit = idx.queryPoint(2500, 2500, 10);
      expect(hit).not.toBeNull();
      expect(["s249", "s250"]).toContain(hit!.id);
    });
  });
});
