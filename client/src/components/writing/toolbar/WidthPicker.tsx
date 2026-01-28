import { useDrawingStore } from "../../../stores/drawing-store";
import { ToolbarRow } from "./ToolbarPrimitives";

const WIDTHS = [2, 3, 5, 8];

export function WidthPicker({ showLabel }: { showLabel?: boolean }) {
  const width = useDrawingStore((s) => s.width);
  const color = useDrawingStore((s) => s.color);
  const setWidth = useDrawingStore((s) => s.setWidth);

  const buttons = WIDTHS.map((w) => (
    <button
      key={w}
      onClick={() => setWidth(w)}
      className={`flex h-9 w-9 items-center justify-center rounded-md border ${
        width === w ? "border-black bg-gray-100" : "border-gray-300 bg-white"
      }`}
    >
      <span
        className="rounded-full"
        style={{ width: w + 4, height: w + 4, backgroundColor: color }}
      />
    </button>
  ));

  if (showLabel) {
    return <ToolbarRow label="Width">{buttons}</ToolbarRow>;
  }
  return <div className="flex gap-1">{buttons}</div>;
}
