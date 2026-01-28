import { useViewStore, type ViewMode } from "../../../stores/view-store";
import { ToolbarButton, ToolbarRow } from "./ToolbarPrimitives";

const VIEW_MODES: ViewMode[] = ["single", "canvas", "overview"];

const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  single: "Single",
  canvas: "Canvas",
  overview: "Overview",
};

export function ViewModePicker({ showLabel }: { showLabel?: boolean }) {
  const viewMode = useViewStore((s) => s.viewMode);
  const setViewMode = useViewStore((s) => s.setViewMode);

  const buttons = VIEW_MODES.map((vm) => (
    <ToolbarButton key={vm} onClick={() => setViewMode(vm)} active={viewMode === vm}>
      {VIEW_MODE_LABELS[vm]}
    </ToolbarButton>
  ));

  if (showLabel) {
    return <ToolbarRow label="View">{buttons}</ToolbarRow>;
  }
  return <div className="flex gap-1">{buttons}</div>;
}
