import { describe, it, expect, beforeEach } from "vitest";
import {
  useBulkOperationStore,
  startBulkOperation,
  updateBulkProgress,
  incrementBulkProgress,
  finishBulkOperation,
} from "./bulk-operation-store";

describe("bulk-operation-store", () => {
  beforeEach(() => {
    // Reset store state
    useBulkOperationStore.setState({ operation: null });
  });

  describe("startOperation", () => {
    it("creates a new operation with correct initial values", () => {
      const id = startBulkOperation("transcribe", "Transcribing 5 pages", 5);

      const state = useBulkOperationStore.getState();
      expect(state.operation).not.toBeNull();
      expect(state.operation?.id).toBe(id);
      expect(state.operation?.type).toBe("transcribe");
      expect(state.operation?.label).toBe("Transcribing 5 pages");
      expect(state.operation?.total).toBe(5);
      expect(state.operation?.completed).toBe(0);
      expect(state.operation?.failed).toBe(0);
    });

    it("replaces existing operation when starting new one", () => {
      startBulkOperation("transcribe", "First", 3);
      const secondId = startBulkOperation("export", "Second", 10);

      const state = useBulkOperationStore.getState();
      expect(state.operation?.id).toBe(secondId);
      expect(state.operation?.type).toBe("export");
    });
  });

  describe("updateProgress", () => {
    it("updates completed count", () => {
      startBulkOperation("delete", "Deleting", 10);
      updateBulkProgress(5);

      const state = useBulkOperationStore.getState();
      expect(state.operation?.completed).toBe(5);
    });

    it("updates both completed and failed counts", () => {
      startBulkOperation("move", "Moving", 10);
      updateBulkProgress(7, 2);

      const state = useBulkOperationStore.getState();
      expect(state.operation?.completed).toBe(7);
      expect(state.operation?.failed).toBe(2);
    });

    it("does nothing when no operation is active", () => {
      updateBulkProgress(5);
      const state = useBulkOperationStore.getState();
      expect(state.operation).toBeNull();
    });
  });

  describe("incrementProgress", () => {
    it("increments completed count on success", () => {
      startBulkOperation("duplicate", "Duplicating", 5);
      incrementBulkProgress(true);
      incrementBulkProgress(true);

      const state = useBulkOperationStore.getState();
      expect(state.operation?.completed).toBe(2);
      expect(state.operation?.failed).toBe(0);
    });

    it("increments both completed and failed on failure", () => {
      startBulkOperation("tags", "Tagging", 5);
      incrementBulkProgress(false);

      const state = useBulkOperationStore.getState();
      expect(state.operation?.completed).toBe(1);
      expect(state.operation?.failed).toBe(1);
    });

    it("defaults to success when no argument provided", () => {
      startBulkOperation("export", "Exporting", 3);
      incrementBulkProgress();

      const state = useBulkOperationStore.getState();
      expect(state.operation?.completed).toBe(1);
      expect(state.operation?.failed).toBe(0);
    });
  });

  describe("finishOperation", () => {
    it("clears the active operation", () => {
      startBulkOperation("transcribe", "Working", 5);
      finishBulkOperation();

      const state = useBulkOperationStore.getState();
      expect(state.operation).toBeNull();
    });
  });

  describe("cancelOperation", () => {
    it("clears the active operation", () => {
      startBulkOperation("delete", "Deleting", 10);
      useBulkOperationStore.getState().cancelOperation();

      const state = useBulkOperationStore.getState();
      expect(state.operation).toBeNull();
    });
  });
});
