import { useCallback, type RefObject } from "react";
import { useTouchGestures } from "./useTouchGestures";
import { useUndoRedo } from "./useUndoRedo";

/**
 * Combines touch gesture detection with undo/redo functionality.
 *
 * - Two-finger tap: Undo
 * - Three-finger tap: Redo
 *
 * This hook should be used alongside useUndoRedoKeyboard which handles
 * keyboard shortcuts (Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z).
 */
export function useUndoRedoTouch(
  containerRef: RefObject<HTMLElement | null>,
  pageId: string,
  enabled: boolean = true,
): void {
  const { undo, redo } = useUndoRedo(pageId);

  const onTwoFingerTap = useCallback(() => {
    undo();
  }, [undo]);

  const onThreeFingerTap = useCallback(() => {
    redo();
  }, [redo]);

  useTouchGestures(containerRef, {
    onTwoFingerTap,
    onThreeFingerTap,
    enabled,
  });
}
