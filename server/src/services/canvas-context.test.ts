import {
  createRenderingCanvas,
  isStrokeRenderingContext,
  canvasToPngBuffer,
  type StrokeRenderingContext,
} from "./canvas-context.js";

// ─── createRenderingCanvas ───────────────────────────────────────────────

describe("createRenderingCanvas", () => {
  describe("happy path", () => {
    it("returns an object with canvas and ctx properties", () => {
      const result = createRenderingCanvas(100, 100);

      expect(result).toHaveProperty("canvas");
      expect(result).toHaveProperty("ctx");
    });

    it("creates a canvas with the specified dimensions", () => {
      const { canvas } = createRenderingCanvas(200, 300);

      expect(canvas.width).toBe(200);
      expect(canvas.height).toBe(300);
    });

    it("returns a context that satisfies StrokeRenderingContext", () => {
      const { ctx } = createRenderingCanvas(100, 100);

      expect(typeof ctx.beginPath).toBe("function");
      expect(typeof ctx.moveTo).toBe("function");
      expect(typeof ctx.lineTo).toBe("function");
      expect(typeof ctx.quadraticCurveTo).toBe("function");
      expect(typeof ctx.closePath).toBe("function");
      expect(typeof ctx.fill).toBe("function");
      expect(typeof ctx.fillRect).toBe("function");
      expect(typeof ctx.scale).toBe("function");
      expect("fillStyle" in ctx).toBe(true);
    });

    it("context passes the isStrokeRenderingContext type guard", () => {
      const { ctx } = createRenderingCanvas(100, 100);

      expect(isStrokeRenderingContext(ctx)).toBe(true);
    });

    it("can perform basic drawing operations", () => {
      const { ctx } = createRenderingCanvas(100, 100);

      // These operations should not throw
      ctx.fillStyle = "#ff0000";
      ctx.fillRect(0, 0, 50, 50);
      ctx.beginPath();
      ctx.moveTo(10, 10);
      ctx.lineTo(50, 50);
      ctx.quadraticCurveTo(60, 30, 90, 90);
      ctx.closePath();
      ctx.fill();
    });

    it("creates independent canvases for multiple calls", () => {
      const first = createRenderingCanvas(100, 100);
      const second = createRenderingCanvas(200, 200);

      expect(first.canvas).not.toBe(second.canvas);
      expect(first.ctx).not.toBe(second.ctx);
      expect(first.canvas.width).toBe(100);
      expect(second.canvas.width).toBe(200);
    });
  });

  describe("edge cases", () => {
    it("creates a canvas with very small dimensions", () => {
      const { canvas } = createRenderingCanvas(1, 1);

      expect(canvas.width).toBe(1);
      expect(canvas.height).toBe(1);
    });

    it("creates a canvas with large dimensions", () => {
      const { canvas } = createRenderingCanvas(4000, 4000);

      expect(canvas.width).toBe(4000);
      expect(canvas.height).toBe(4000);
    });

    it("creates a canvas with non-square dimensions", () => {
      const { canvas } = createRenderingCanvas(1920, 1080);

      expect(canvas.width).toBe(1920);
      expect(canvas.height).toBe(1080);
    });

    it("supports scale transformation", () => {
      const { ctx } = createRenderingCanvas(100, 100);

      // Should not throw
      ctx.scale(2, 2);
      ctx.fillRect(0, 0, 10, 10);
    });

    it("context fillStyle can be set and read", () => {
      const { ctx } = createRenderingCanvas(100, 100);

      ctx.fillStyle = "#123456";
      // @napi-rs/canvas normalizes color values, just verify it can be set
      expect(ctx.fillStyle).toBeDefined();
    });
  });
});

// ─── isStrokeRenderingContext ────────────────────────────────────────────

describe("isStrokeRenderingContext", () => {
  describe("happy path - valid contexts", () => {
    it("returns true for context from createRenderingCanvas", () => {
      const { ctx } = createRenderingCanvas(100, 100);

      expect(isStrokeRenderingContext(ctx)).toBe(true);
    });

    it("returns true for a mock object with all required methods", () => {
      const mockCtx = {
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        quadraticCurveTo: () => {},
        closePath: () => {},
        fill: () => {},
        fillRect: () => {},
        scale: () => {},
        fillStyle: "#000000",
      };

      expect(isStrokeRenderingContext(mockCtx)).toBe(true);
    });

    it("returns true when fillStyle is a complex object", () => {
      const mockCtx = {
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        quadraticCurveTo: () => {},
        closePath: () => {},
        fill: () => {},
        fillRect: () => {},
        scale: () => {},
        fillStyle: { toString: () => "gradient" }, // Simulating CanvasGradient
      };

      expect(isStrokeRenderingContext(mockCtx)).toBe(true);
    });
  });

  describe("invalid inputs - null and undefined", () => {
    it("returns false for null", () => {
      expect(isStrokeRenderingContext(null)).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(isStrokeRenderingContext(undefined)).toBe(false);
    });
  });

  describe("invalid inputs - wrong types", () => {
    it("returns false for a number", () => {
      expect(isStrokeRenderingContext(42)).toBe(false);
    });

    it("returns false for a string", () => {
      expect(isStrokeRenderingContext("context")).toBe(false);
    });

    it("returns false for a boolean", () => {
      expect(isStrokeRenderingContext(true)).toBe(false);
    });

    it("returns false for an array", () => {
      expect(isStrokeRenderingContext([])).toBe(false);
    });

    it("returns false for a function", () => {
      expect(isStrokeRenderingContext(() => {})).toBe(false);
    });
  });

  describe("invalid inputs - incomplete objects", () => {
    it("returns false for an empty object", () => {
      expect(isStrokeRenderingContext({})).toBe(false);
    });

    it("returns false when beginPath is missing", () => {
      const mockCtx = {
        moveTo: () => {},
        lineTo: () => {},
        quadraticCurveTo: () => {},
        closePath: () => {},
        fill: () => {},
        fillRect: () => {},
        scale: () => {},
        fillStyle: "#000000",
      };

      expect(isStrokeRenderingContext(mockCtx)).toBe(false);
    });

    it("returns false when moveTo is missing", () => {
      const mockCtx = {
        beginPath: () => {},
        lineTo: () => {},
        quadraticCurveTo: () => {},
        closePath: () => {},
        fill: () => {},
        fillRect: () => {},
        scale: () => {},
        fillStyle: "#000000",
      };

      expect(isStrokeRenderingContext(mockCtx)).toBe(false);
    });

    it("returns false when lineTo is missing", () => {
      const mockCtx = {
        beginPath: () => {},
        moveTo: () => {},
        quadraticCurveTo: () => {},
        closePath: () => {},
        fill: () => {},
        fillRect: () => {},
        scale: () => {},
        fillStyle: "#000000",
      };

      expect(isStrokeRenderingContext(mockCtx)).toBe(false);
    });

    it("returns false when quadraticCurveTo is missing", () => {
      const mockCtx = {
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        closePath: () => {},
        fill: () => {},
        fillRect: () => {},
        scale: () => {},
        fillStyle: "#000000",
      };

      expect(isStrokeRenderingContext(mockCtx)).toBe(false);
    });

    it("returns false when closePath is missing", () => {
      const mockCtx = {
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        quadraticCurveTo: () => {},
        fill: () => {},
        fillRect: () => {},
        scale: () => {},
        fillStyle: "#000000",
      };

      expect(isStrokeRenderingContext(mockCtx)).toBe(false);
    });

    it("returns false when fill is missing", () => {
      const mockCtx = {
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        quadraticCurveTo: () => {},
        closePath: () => {},
        fillRect: () => {},
        scale: () => {},
        fillStyle: "#000000",
      };

      expect(isStrokeRenderingContext(mockCtx)).toBe(false);
    });

    it("returns false when fillRect is missing", () => {
      const mockCtx = {
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        quadraticCurveTo: () => {},
        closePath: () => {},
        fill: () => {},
        scale: () => {},
        fillStyle: "#000000",
      };

      expect(isStrokeRenderingContext(mockCtx)).toBe(false);
    });

    it("returns false when scale is missing", () => {
      const mockCtx = {
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        quadraticCurveTo: () => {},
        closePath: () => {},
        fill: () => {},
        fillRect: () => {},
        fillStyle: "#000000",
      };

      expect(isStrokeRenderingContext(mockCtx)).toBe(false);
    });

    it("returns false when fillStyle is missing", () => {
      const mockCtx = {
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        quadraticCurveTo: () => {},
        closePath: () => {},
        fill: () => {},
        fillRect: () => {},
        scale: () => {},
      };

      expect(isStrokeRenderingContext(mockCtx)).toBe(false);
    });
  });

  describe("invalid inputs - wrong property types", () => {
    it("returns false when beginPath is not a function", () => {
      const mockCtx = {
        beginPath: "not a function",
        moveTo: () => {},
        lineTo: () => {},
        quadraticCurveTo: () => {},
        closePath: () => {},
        fill: () => {},
        fillRect: () => {},
        scale: () => {},
        fillStyle: "#000000",
      };

      expect(isStrokeRenderingContext(mockCtx)).toBe(false);
    });

    it("returns false when methods are null", () => {
      const mockCtx = {
        beginPath: null,
        moveTo: () => {},
        lineTo: () => {},
        quadraticCurveTo: () => {},
        closePath: () => {},
        fill: () => {},
        fillRect: () => {},
        scale: () => {},
        fillStyle: "#000000",
      };

      expect(isStrokeRenderingContext(mockCtx)).toBe(false);
    });
  });
});

// ─── canvasToPngBuffer ───────────────────────────────────────────────────

describe("canvasToPngBuffer", () => {
  describe("happy path", () => {
    it("returns a Buffer", () => {
      const { canvas } = createRenderingCanvas(100, 100);

      const buffer = canvasToPngBuffer(canvas);

      expect(Buffer.isBuffer(buffer)).toBe(true);
    });

    it("returns a valid PNG (starts with PNG magic bytes)", () => {
      const { canvas } = createRenderingCanvas(100, 100);

      const buffer = canvasToPngBuffer(canvas);

      // PNG magic bytes: 0x89 P N G
      expect(buffer[0]).toBe(0x89);
      expect(buffer[1]).toBe(0x50); // P
      expect(buffer[2]).toBe(0x4e); // N
      expect(buffer[3]).toBe(0x47); // G
    });

    it("returns non-empty buffer for blank canvas", () => {
      const { canvas } = createRenderingCanvas(100, 100);

      const buffer = canvasToPngBuffer(canvas);

      expect(buffer.length).toBeGreaterThan(0);
    });

    it("returns buffer for canvas with drawings", () => {
      const { canvas, ctx } = createRenderingCanvas(100, 100);
      ctx.fillStyle = "#ff0000";
      ctx.fillRect(10, 10, 80, 80);

      const buffer = canvasToPngBuffer(canvas);

      expect(buffer.length).toBeGreaterThan(0);
      expect(buffer[0]).toBe(0x89);
    });

    it("produces different buffers for different content", () => {
      const { canvas: blank } = createRenderingCanvas(100, 100);

      const { canvas: drawn, ctx } = createRenderingCanvas(100, 100);
      ctx.fillStyle = "#ff0000";
      ctx.fillRect(0, 0, 100, 100);

      const blankBuffer = canvasToPngBuffer(blank);
      const drawnBuffer = canvasToPngBuffer(drawn);

      // The buffers should be different since content differs
      expect(Buffer.compare(blankBuffer, drawnBuffer)).not.toBe(0);
    });

    it("produces consistent buffers for identical canvases", () => {
      const makeCanvas = () => {
        const { canvas, ctx } = createRenderingCanvas(50, 50);
        ctx.fillStyle = "#00ff00";
        ctx.fillRect(0, 0, 50, 50);
        return canvas;
      };

      const buffer1 = canvasToPngBuffer(makeCanvas());
      const buffer2 = canvasToPngBuffer(makeCanvas());

      // Same content should produce identical PNGs
      expect(Buffer.compare(buffer1, buffer2)).toBe(0);
    });
  });

  describe("edge cases", () => {
    it("handles 1x1 canvas", () => {
      const { canvas } = createRenderingCanvas(1, 1);

      const buffer = canvasToPngBuffer(canvas);

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);
      expect(buffer[0]).toBe(0x89);
    });

    it("handles large canvas", () => {
      const { canvas, ctx } = createRenderingCanvas(2000, 2000);
      ctx.fillStyle = "#0000ff";
      ctx.fillRect(0, 0, 2000, 2000);

      const buffer = canvasToPngBuffer(canvas);

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer[0]).toBe(0x89);
    });

    it("handles canvas with complex path drawing", () => {
      const { canvas, ctx } = createRenderingCanvas(200, 200);
      ctx.fillStyle = "#ff00ff";
      ctx.beginPath();
      ctx.moveTo(10, 10);
      ctx.lineTo(190, 10);
      ctx.quadraticCurveTo(190, 190, 10, 190);
      ctx.closePath();
      ctx.fill();

      const buffer = canvasToPngBuffer(canvas);

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer[0]).toBe(0x89);
    });

    it("handles canvas with scale transformation", () => {
      const { canvas, ctx } = createRenderingCanvas(100, 100);
      ctx.scale(2, 2);
      ctx.fillStyle = "#ffff00";
      ctx.fillRect(0, 0, 25, 25);

      const buffer = canvasToPngBuffer(canvas);

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer[0]).toBe(0x89);
    });

    it("buffer size varies with canvas dimensions", () => {
      const { canvas: small } = createRenderingCanvas(10, 10);
      const { canvas: large } = createRenderingCanvas(500, 500);

      const smallBuffer = canvasToPngBuffer(small);
      const largeBuffer = canvasToPngBuffer(large);

      // Larger canvas should generally produce larger PNG
      // (not strictly guaranteed due to compression, but likely for blank canvases)
      expect(largeBuffer.length).toBeGreaterThan(smallBuffer.length);
    });
  });
});

// ─── Integration: Full workflow ──────────────────────────────────────────

describe("canvas-context integration", () => {
  it("create → draw → validate → export workflow", () => {
    // Step 1: Create canvas
    const { canvas, ctx } = createRenderingCanvas(400, 300);
    expect(canvas.width).toBe(400);
    expect(canvas.height).toBe(300);

    // Step 2: Validate context
    expect(isStrokeRenderingContext(ctx)).toBe(true);

    // Step 3: Draw content
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 400, 300);
    ctx.fillStyle = "#000000";
    ctx.beginPath();
    ctx.moveTo(50, 50);
    ctx.lineTo(350, 50);
    ctx.quadraticCurveTo(350, 250, 50, 250);
    ctx.closePath();
    ctx.fill();

    // Step 4: Export to PNG
    const buffer = canvasToPngBuffer(canvas);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer[0]).toBe(0x89);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("supports typical thumbnail generation workflow", () => {
    // Simulate the thumbnail generation workflow
    const THUMBNAIL_WIDTH = 281; // 1404 / 5
    const THUMBNAIL_HEIGHT = 374; // 1872 / 5

    const { canvas, ctx } = createRenderingCanvas(
      THUMBNAIL_WIDTH,
      THUMBNAIL_HEIGHT,
    );

    // Background
    ctx.fillStyle = "#fffbeb";
    ctx.fillRect(0, 0, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);

    // Scale to match page coordinates
    ctx.scale(0.2, 0.2);

    // Simulate drawing some strokes
    ctx.fillStyle = "#2d3748";
    ctx.beginPath();
    ctx.moveTo(100, 100);
    ctx.lineTo(200, 150);
    ctx.quadraticCurveTo(250, 200, 300, 300);
    ctx.lineTo(350, 400);
    ctx.closePath();
    ctx.fill();

    const buffer = canvasToPngBuffer(canvas);

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer[0]).toBe(0x89);
    expect(buffer.length).toBeGreaterThan(100); // Should have meaningful content
  });

  it("multiple canvases can be created and exported independently", () => {
    const canvases = [
      createRenderingCanvas(100, 100),
      createRenderingCanvas(200, 200),
      createRenderingCanvas(300, 300),
    ];

    // Draw different content on each
    canvases[0].ctx.fillStyle = "#ff0000";
    canvases[0].ctx.fillRect(0, 0, 100, 100);

    canvases[1].ctx.fillStyle = "#00ff00";
    canvases[1].ctx.fillRect(0, 0, 200, 200);

    canvases[2].ctx.fillStyle = "#0000ff";
    canvases[2].ctx.fillRect(0, 0, 300, 300);

    // Export all
    const buffers = canvases.map(({ canvas }) => canvasToPngBuffer(canvas));

    // All should be valid PNGs
    buffers.forEach((buffer) => {
      expect(buffer[0]).toBe(0x89);
    });

    // All should be different
    expect(Buffer.compare(buffers[0], buffers[1])).not.toBe(0);
    expect(Buffer.compare(buffers[1], buffers[2])).not.toBe(0);
    expect(Buffer.compare(buffers[0], buffers[2])).not.toBe(0);
  });
});
