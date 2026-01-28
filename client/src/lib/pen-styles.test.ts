import { getStrokeOptions, type PenStyle } from "./pen-styles";

describe("getStrokeOptions", () => {
  const styles: PenStyle[] = ["pressure", "uniform", "ballpoint"];

  it.each(styles)("returns options with correct size for %s", (style) => {
    const opts = getStrokeOptions(style, 5);
    expect(opts.size).toBe(5);
  });

  describe("pressure", () => {
    it("enables thinning and tapers", () => {
      const opts = getStrokeOptions("pressure", 3);
      expect(opts.thinning).toBe(0.5);
      expect(opts.simulatePressure).toBe(false);
      expect(opts.start).toEqual({ taper: true });
      expect(opts.end).toEqual({ taper: true });
    });
  });

  describe("uniform", () => {
    it("disables thinning and tapers", () => {
      const opts = getStrokeOptions("uniform", 3);
      expect(opts.thinning).toBe(0);
      expect(opts.simulatePressure).toBe(false);
      expect(opts.start).toEqual({ taper: false });
      expect(opts.end).toEqual({ taper: false });
    });
  });

  describe("ballpoint", () => {
    it("has slight thinning with end taper", () => {
      const opts = getStrokeOptions("ballpoint", 3);
      expect(opts.thinning).toBe(0.15);
      expect(opts.simulatePressure).toBe(false);
      expect(opts.start).toEqual({ taper: false });
      expect(opts.end).toEqual({ taper: 10 });
    });
  });
});
