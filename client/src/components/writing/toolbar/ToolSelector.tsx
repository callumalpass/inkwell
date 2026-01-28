import { useDrawingStore, type Tool } from "../../../stores/drawing-store";
import { ToolbarButton } from "./ToolbarPrimitives";

const TOOLS: Tool[] = ["pen", "highlighter", "eraser"];

export function ToolSelector() {
  const tool = useDrawingStore((s) => s.tool);
  const setTool = useDrawingStore((s) => s.setTool);

  return (
    <div className="flex gap-1">
      {TOOLS.map((t) => (
        <ToolbarButton
          key={t}
          onClick={() => setTool(t)}
          active={tool === t}
          className="capitalize"
        >
          {t}
        </ToolbarButton>
      ))}
    </div>
  );
}
