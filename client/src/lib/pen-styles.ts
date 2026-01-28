export type PenStyle = "pressure" | "uniform" | "ballpoint";

export function getStrokeOptions(penStyle: PenStyle, width: number) {
  switch (penStyle) {
    case "pressure":
      return {
        size: width,
        smoothing: 0.5,
        thinning: 0.5,
        streamline: 0,
        simulatePressure: false,
        start: { taper: true },
        end: { taper: true },
      };
    case "uniform":
      return {
        size: width,
        smoothing: 0.5,
        thinning: 0,
        streamline: 0,
        simulatePressure: false,
        start: { taper: false },
        end: { taper: false },
      };
    case "ballpoint":
      return {
        size: width,
        smoothing: 0.5,
        thinning: 0.15,
        streamline: 0,
        simulatePressure: false,
        start: { taper: false },
        end: { taper: 10 },
      };
  }
}
