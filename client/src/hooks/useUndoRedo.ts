import { useCallback, useEffect } from "react";
import { useUndoRedoStore } from "../stores/undo-redo-store";
import { usePageStore } from "../stores/page-store";
import * as strokesApi from "../api/strokes";

/**
 * Provides undo/redo actions for a specific page.
 *
 * Undo/redo works by reversing commands:
 * - Undoing an add-stroke → removes the stroke (from store + server)
 * - Undoing a remove-stroke → re-adds the stroke (to store + server)
 * - Redo is the inverse of undo
 */
export function useUndoRedo(pageId: string) {
  const canUndo = useUndoRedoStore((s) => s.canUndo(pageId));
  const canRedo = useUndoRedoStore((s) => s.canRedo(pageId));

  const undo = useCallback(() => {
    const command = useUndoRedoStore.getState().popUndo(pageId);
    if (!command) return;

    const pageStore = usePageStore.getState();

    switch (command.type) {
      case "add-stroke":
        // Undo drawing → remove the stroke
        pageStore.removeSavedStroke(pageId, command.stroke.id);
        strokesApi.deleteStroke(pageId, command.stroke.id).catch(console.error);
        break;
      case "remove-stroke":
        // Undo erasing → re-add the stroke
        pageStore.addSavedStrokes(pageId, [command.stroke]);
        strokesApi.postStrokes(pageId, [command.stroke]).catch(console.error);
        break;
    }
  }, [pageId]);

  const redo = useCallback(() => {
    const command = useUndoRedoStore.getState().popRedo(pageId);
    if (!command) return;

    const pageStore = usePageStore.getState();

    switch (command.type) {
      case "add-stroke":
        // Redo drawing → re-add the stroke
        pageStore.addSavedStrokes(pageId, [command.stroke]);
        strokesApi.postStrokes(pageId, [command.stroke]).catch(console.error);
        break;
      case "remove-stroke":
        // Redo erasing → remove the stroke again
        pageStore.removeSavedStroke(pageId, command.stroke.id);
        strokesApi.deleteStroke(pageId, command.stroke.id).catch(console.error);
        break;
    }
  }, [pageId]);

  return { undo, redo, canUndo, canRedo };
}

/**
 * Attaches Ctrl+Z / Ctrl+Shift+Z keyboard shortcuts for undo/redo.
 * Should be called once at the writing view level.
 */
export function useUndoRedoKeyboard(pageId: string) {
  const { undo, redo } = useUndoRedo(pageId);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || e.key !== "z") return;

      e.preventDefault();
      if (e.shiftKey) {
        redo();
      } else {
        undo();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);
}
