import { useUndoRedo } from "../../../hooks/useUndoRedo";
import { ToolbarButton } from "./ToolbarPrimitives";

export function UndoRedoButtons({ pageId }: { pageId: string }) {
  const { undo, redo, canUndo, canRedo } = useUndoRedo(pageId);

  return (
    <div className="flex gap-1">
      <ToolbarButton onClick={undo} disabled={!canUndo} aria-label="Undo">
        Undo
      </ToolbarButton>
      <ToolbarButton onClick={redo} disabled={!canRedo} aria-label="Redo">
        Redo
      </ToolbarButton>
    </div>
  );
}
