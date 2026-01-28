import { useDrawingStore } from "../../../stores/drawing-store";
import { COLOR_PRESETS } from "../../../lib/constants";
import { ToolbarRow } from "./ToolbarPrimitives";

export function ColorPicker({ showLabel }: { showLabel?: boolean }) {
  const color = useDrawingStore((s) => s.color);
  const setColor = useDrawingStore((s) => s.setColor);

  const buttons = COLOR_PRESETS.map((preset) => (
    <button
      key={preset.color}
      onClick={() => setColor(preset.color)}
      aria-label={preset.label}
      className={`flex h-9 w-9 items-center justify-center rounded-md border-2 ${
        color === preset.color ? "border-black" : "border-gray-300"
      }`}
    >
      <span
        className="rounded-full"
        style={{ width: 18, height: 18, backgroundColor: preset.color }}
      />
    </button>
  ));

  if (showLabel) {
    return <ToolbarRow label="Color">{buttons}</ToolbarRow>;
  }
  return <div className="flex gap-1">{buttons}</div>;
}
