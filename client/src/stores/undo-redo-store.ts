import { create } from "zustand";
import type { Stroke } from "../api/strokes";

/**
 * Command pattern for undo/redo.
 *
 * Each command captures what happened so it can be reversed:
 * - AddStroke: a stroke was drawn → undo removes it, redo re-adds it
 * - RemoveStroke: a stroke was erased → undo re-adds it, redo removes it
 */
export type UndoCommand =
  | { type: "add-stroke"; pageId: string; stroke: Stroke }
  | { type: "remove-stroke"; pageId: string; stroke: Stroke };

interface PageHistory {
  undoStack: UndoCommand[];
  redoStack: UndoCommand[];
}

const MAX_HISTORY = 200;

interface UndoRedoStore {
  historyByPage: Record<string, PageHistory>;

  /** Record a new command (clears redo stack for that page). */
  record: (command: UndoCommand) => void;

  /** Pop the last undo command for a page. Returns null if nothing to undo. */
  popUndo: (pageId: string) => UndoCommand | null;

  /** Pop the last redo command for a page. Returns null if nothing to redo. */
  popRedo: (pageId: string) => UndoCommand | null;

  /** Check if undo is available for a page. */
  canUndo: (pageId: string) => boolean;

  /** Check if redo is available for a page. */
  canRedo: (pageId: string) => boolean;

  /** Clear history for a page. */
  clearPage: (pageId: string) => void;
}

function getHistory(
  historyByPage: Record<string, PageHistory>,
  pageId: string,
): PageHistory {
  return historyByPage[pageId] ?? { undoStack: [], redoStack: [] };
}

export const useUndoRedoStore = create<UndoRedoStore>((set, get) => ({
  historyByPage: {},

  record: (command) => {
    const { historyByPage } = get();
    const pageId = command.pageId;
    const history = getHistory(historyByPage, pageId);

    const undoStack = [...history.undoStack, command];
    // Cap history size
    if (undoStack.length > MAX_HISTORY) {
      undoStack.splice(0, undoStack.length - MAX_HISTORY);
    }

    set({
      historyByPage: {
        ...historyByPage,
        [pageId]: {
          undoStack,
          redoStack: [], // New action clears redo
        },
      },
    });
  },

  popUndo: (pageId) => {
    const { historyByPage } = get();
    const history = getHistory(historyByPage, pageId);
    if (history.undoStack.length === 0) return null;

    const command = history.undoStack[history.undoStack.length - 1];
    set({
      historyByPage: {
        ...historyByPage,
        [pageId]: {
          undoStack: history.undoStack.slice(0, -1),
          redoStack: [...history.redoStack, command],
        },
      },
    });
    return command;
  },

  popRedo: (pageId) => {
    const { historyByPage } = get();
    const history = getHistory(historyByPage, pageId);
    if (history.redoStack.length === 0) return null;

    const command = history.redoStack[history.redoStack.length - 1];
    set({
      historyByPage: {
        ...historyByPage,
        [pageId]: {
          undoStack: [...history.undoStack, command],
          redoStack: history.redoStack.slice(0, -1),
        },
      },
    });
    return command;
  },

  canUndo: (pageId) => {
    const history = getHistory(get().historyByPage, pageId);
    return history.undoStack.length > 0;
  },

  canRedo: (pageId) => {
    const history = getHistory(get().historyByPage, pageId);
    return history.redoStack.length > 0;
  },

  clearPage: (pageId) => {
    const { historyByPage } = get();
    const { [pageId]: _, ...rest } = historyByPage;
    set({ historyByPage: rest });
  },
}));
