import { create } from "zustand";

export type BulkOperationType =
  | "transcribe"
  | "export"
  | "delete"
  | "move"
  | "duplicate"
  | "tags";

export interface BulkOperation {
  id: string;
  type: BulkOperationType;
  label: string;
  total: number;
  completed: number;
  failed: number;
  startedAt: number;
}

interface BulkOperationStore {
  operation: BulkOperation | null;

  startOperation: (
    type: BulkOperationType,
    label: string,
    total: number,
  ) => string;
  updateProgress: (completed: number, failed?: number) => void;
  incrementProgress: (success?: boolean) => void;
  finishOperation: () => void;
  cancelOperation: () => void;
}

let operationId = 0;

export const useBulkOperationStore = create<BulkOperationStore>((set, get) => ({
  operation: null,

  startOperation: (type, label, total) => {
    const id = `bulk-${++operationId}`;
    set({
      operation: {
        id,
        type,
        label,
        total,
        completed: 0,
        failed: 0,
        startedAt: Date.now(),
      },
    });
    return id;
  },

  updateProgress: (completed, failed = 0) => {
    const { operation } = get();
    if (!operation) return;

    set({
      operation: {
        ...operation,
        completed,
        failed,
      },
    });
  },

  incrementProgress: (success = true) => {
    const { operation } = get();
    if (!operation) return;

    set({
      operation: {
        ...operation,
        completed: operation.completed + 1,
        failed: success ? operation.failed : operation.failed + 1,
      },
    });
  },

  finishOperation: () => {
    set({ operation: null });
  },

  cancelOperation: () => {
    set({ operation: null });
  },
}));

// Helper functions for starting common operations
export function startBulkOperation(
  type: BulkOperationType,
  label: string,
  total: number,
): string {
  return useBulkOperationStore.getState().startOperation(type, label, total);
}

export function updateBulkProgress(completed: number, failed?: number): void {
  useBulkOperationStore.getState().updateProgress(completed, failed);
}

export function incrementBulkProgress(success?: boolean): void {
  useBulkOperationStore.getState().incrementProgress(success);
}

export function finishBulkOperation(): void {
  useBulkOperationStore.getState().finishOperation();
}
