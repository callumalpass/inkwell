import { memo } from "react";
import { PAGE_WIDTH, PAGE_HEIGHT } from "../../lib/constants";

export type GridType = "none" | "lined" | "grid" | "dotgrid";

/** Spacing between lines/dots in page coordinates. */
const LINE_SPACING = 48;
/** Top margin before first line (for lined/grid). */
const TOP_MARGIN = 96;
/** Left margin for ruled lines. */
const RULED_LEFT_MARGIN = 96;
/** Color for grid/line strokes — dark enough for e-ink's limited grey levels. */
const GRID_COLOR = "#9ca3af";
/** Color for the ruled left margin line — darkened for e-ink visibility. */
const MARGIN_COLOR = "#b91c1c";
/** Dot radius for dotgrid — enlarged for e-ink. */
const DOT_RADIUS = 2.5;

interface PageBackgroundProps {
  gridType: GridType;
}

export const PageBackground = memo(function PageBackground({
  gridType,
}: PageBackgroundProps) {
  if (gridType === "none") return null;

  return (
    <svg
      viewBox={`0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}`}
      className="absolute inset-0 h-full w-full"
      style={{ pointerEvents: "none" }}
    >
      {gridType === "lined" && <LinedPattern />}
      {gridType === "grid" && <GridPattern />}
      {gridType === "dotgrid" && <DotGridPattern />}
    </svg>
  );
});

/**
 * Lined paper: horizontal rules with a red left margin.
 * Uses an SVG <pattern> for the repeating horizontal lines.
 */
function LinedPattern() {
  return (
    <>
      <defs>
        <pattern
          id="lined-pattern"
          width={PAGE_WIDTH}
          height={LINE_SPACING}
          patternUnits="userSpaceOnUse"
        >
          <line
            x1={0}
            y1={LINE_SPACING}
            x2={PAGE_WIDTH}
            y2={LINE_SPACING}
            stroke={GRID_COLOR}
            strokeWidth={1.5}
          />
        </pattern>
      </defs>
      <rect
        x={0}
        y={TOP_MARGIN - LINE_SPACING}
        width={PAGE_WIDTH}
        height={PAGE_HEIGHT - TOP_MARGIN + LINE_SPACING}
        fill="url(#lined-pattern)"
      />
      {/* Ruled margin line */}
      <line
        x1={RULED_LEFT_MARGIN}
        y1={0}
        x2={RULED_LEFT_MARGIN}
        y2={PAGE_HEIGHT}
        stroke={MARGIN_COLOR}
        strokeWidth={1.5}
      />
    </>
  );
}

/**
 * Grid paper: horizontal and vertical lines.
 * Uses an SVG <pattern> for the repeating grid cells.
 */
function GridPattern() {
  return (
    <>
      <defs>
        <pattern
          id="grid-pattern"
          width={LINE_SPACING}
          height={LINE_SPACING}
          patternUnits="userSpaceOnUse"
        >
          <line
            x1={0}
            y1={LINE_SPACING}
            x2={LINE_SPACING}
            y2={LINE_SPACING}
            stroke={GRID_COLOR}
            strokeWidth={1}
          />
          <line
            x1={LINE_SPACING}
            y1={0}
            x2={LINE_SPACING}
            y2={LINE_SPACING}
            stroke={GRID_COLOR}
            strokeWidth={1}
          />
        </pattern>
      </defs>
      <rect
        x={0}
        y={TOP_MARGIN}
        width={PAGE_WIDTH}
        height={PAGE_HEIGHT - TOP_MARGIN}
        fill="url(#grid-pattern)"
      />
    </>
  );
}

/**
 * Dot grid paper: dots at regular intervals.
 * Uses an SVG <pattern> for the repeating dot cells.
 */
function DotGridPattern() {
  return (
    <>
      <defs>
        <pattern
          id="dotgrid-pattern"
          width={LINE_SPACING}
          height={LINE_SPACING}
          patternUnits="userSpaceOnUse"
        >
          <circle cx={LINE_SPACING} cy={LINE_SPACING} r={DOT_RADIUS} fill={GRID_COLOR} />
        </pattern>
      </defs>
      <rect
        x={0}
        y={TOP_MARGIN - LINE_SPACING}
        width={PAGE_WIDTH}
        height={PAGE_HEIGHT - TOP_MARGIN + LINE_SPACING}
        fill="url(#dotgrid-pattern)"
      />
    </>
  );
}
