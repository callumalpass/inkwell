import { useDrawingStore, type Tool } from "../../stores/drawing-store";

const WIDTHS = [2, 3, 5, 8];

export function Toolbar() {
  const { tool, width, setTool, setWidth } = useDrawingStore();

  return (
    <div className="flex items-center gap-4 border-b border-gray-200 bg-white px-4 py-2">
      <div className="flex gap-1">
        {(["pen", "eraser"] as Tool[]).map((t) => (
          <button
            key={t}
            onClick={() => setTool(t)}
            className={`rounded px-3 py-1 text-sm capitalize ${
              tool === t
                ? "bg-gray-900 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="h-4 w-px bg-gray-300" />
      <div className="flex gap-1">
        {WIDTHS.map((w) => (
          <button
            key={w}
            onClick={() => setWidth(w)}
            className={`flex h-7 w-7 items-center justify-center rounded ${
              width === w
                ? "bg-gray-200"
                : "hover:bg-gray-100"
            }`}
          >
            <span
              className="rounded-full bg-gray-900"
              style={{ width: w + 2, height: w + 2 }}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
