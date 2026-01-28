import { useNotebookPagesStore } from "../../../stores/notebook-pages-store";
import { LINE_SPACING_OPTIONS, DEFAULT_LINE_SPACING } from "../../../lib/constants";
import { ToolbarButton, ToolbarRow } from "./ToolbarPrimitives";

const LINE_SPACING_LABELS: Record<number, string> = {
  32: "Tight",
  40: "Small",
  48: "Normal",
  56: "Large",
  64: "Extra",
};

export function LineSpacingPicker({ showLabel }: { showLabel?: boolean }) {
  const lineSpacing = useNotebookPagesStore(
    (s) => s.settings.backgroundLineSpacing ?? DEFAULT_LINE_SPACING,
  );
  const updateSettings = useNotebookPagesStore((s) => s.updateSettings);

  const buttons = LINE_SPACING_OPTIONS.map((spacing) => (
    <ToolbarButton
      key={spacing}
      onClick={() => updateSettings({ backgroundLineSpacing: spacing })}
      active={lineSpacing === spacing}
    >
      {LINE_SPACING_LABELS[spacing] ?? spacing}
    </ToolbarButton>
  ));

  if (showLabel) {
    return <ToolbarRow label="Line Spacing">{buttons}</ToolbarRow>;
  }
  return <div className="flex gap-1">{buttons}</div>;
}
