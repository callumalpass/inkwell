import { useNotebookPagesStore } from "../../../stores/notebook-pages-store";
import type { GridType } from "../PageBackground";
import { ToolbarButton, ToolbarRow } from "./ToolbarPrimitives";

const GRID_TYPES: GridType[] = ["none", "lined", "grid", "dotgrid"];

const GRID_TYPE_LABELS: Record<GridType, string> = {
  none: "Plain",
  lined: "Lined",
  grid: "Grid",
  dotgrid: "Dots",
};

export function GridTypePicker({ showLabel }: { showLabel?: boolean }) {
  const gridType = useNotebookPagesStore(
    (s) => (s.settings.gridType ?? "none") as GridType,
  );
  const updateSettings = useNotebookPagesStore((s) => s.updateSettings);

  const buttons = GRID_TYPES.map((gt) => (
    <ToolbarButton
      key={gt}
      onClick={() => updateSettings({ gridType: gt })}
      active={gridType === gt}
    >
      {GRID_TYPE_LABELS[gt]}
    </ToolbarButton>
  ));

  if (showLabel) {
    return <ToolbarRow label="Grid">{buttons}</ToolbarRow>;
  }
  return <div className="flex gap-1">{buttons}</div>;
}
