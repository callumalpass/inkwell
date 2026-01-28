import { useDrawingStore } from "../../../stores/drawing-store";
import type { PenStyle } from "../../../lib/pen-styles";
import { ToolbarButton, ToolbarRow } from "./ToolbarPrimitives";

const PEN_STYLES: PenStyle[] = ["pressure", "uniform", "ballpoint"];

const PEN_STYLE_LABELS: Record<PenStyle, string> = {
  pressure: "Pressure",
  uniform: "Uniform",
  ballpoint: "Ballpoint",
};

export function PenStylePicker({ showLabel }: { showLabel?: boolean }) {
  const penStyle = useDrawingStore((s) => s.penStyle);
  const setPenStyle = useDrawingStore((s) => s.setPenStyle);

  const buttons = PEN_STYLES.map((ps) => (
    <ToolbarButton key={ps} onClick={() => setPenStyle(ps)} active={penStyle === ps}>
      {PEN_STYLE_LABELS[ps]}
    </ToolbarButton>
  ));

  if (showLabel) {
    return <ToolbarRow label="Style">{buttons}</ToolbarRow>;
  }
  return <div className="flex gap-1">{buttons}</div>;
}
