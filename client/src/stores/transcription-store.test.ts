import { useTranscriptionStore } from "./transcription-store";

beforeEach(() => {
  useTranscriptionStore.setState({
    transcriptions: {},
    loading: {},
    panelOpen: false,
    panelPageId: null,
  });
});

describe("transcription store", () => {
  describe("updateStatus", () => {
    it("sets status for a page", () => {
      useTranscriptionStore.getState().updateStatus("pg_1", "pending");
      const info = useTranscriptionStore.getState().transcriptions["pg_1"];
      expect(info.status).toBe("pending");
      expect(info.error).toBeNull();
    });

    it("sets status with content for complete", () => {
      useTranscriptionStore
        .getState()
        .updateStatus("pg_1", "complete", "Hello world");
      const info = useTranscriptionStore.getState().transcriptions["pg_1"];
      expect(info.status).toBe("complete");
      expect(info.content).toBe("Hello world");
    });

    it("sets status with error for failed", () => {
      useTranscriptionStore
        .getState()
        .updateStatus("pg_1", "failed", undefined, "API error");
      const info = useTranscriptionStore.getState().transcriptions["pg_1"];
      expect(info.status).toBe("failed");
      expect(info.error).toBe("API error");
    });

    it("preserves existing content when updating status without content", () => {
      useTranscriptionStore
        .getState()
        .updateStatus("pg_1", "complete", "Existing content");
      useTranscriptionStore.getState().updateStatus("pg_1", "pending");
      const info = useTranscriptionStore.getState().transcriptions["pg_1"];
      expect(info.status).toBe("pending");
      expect(info.content).toBe("Existing content");
    });

    it("sets lastAttempt timestamp", () => {
      const before = new Date().toISOString();
      useTranscriptionStore.getState().updateStatus("pg_1", "processing");
      const info = useTranscriptionStore.getState().transcriptions["pg_1"];
      expect(info.lastAttempt).not.toBeNull();
      expect(info.lastAttempt! >= before).toBe(true);
    });
  });

  describe("panel controls", () => {
    it("opens panel for a specific page", () => {
      useTranscriptionStore.getState().openPanel("pg_1");
      expect(useTranscriptionStore.getState().panelOpen).toBe(true);
      expect(useTranscriptionStore.getState().panelPageId).toBe("pg_1");
    });

    it("closes panel", () => {
      useTranscriptionStore.getState().openPanel("pg_1");
      useTranscriptionStore.getState().closePanel();
      expect(useTranscriptionStore.getState().panelOpen).toBe(false);
      expect(useTranscriptionStore.getState().panelPageId).toBeNull();
    });

    it("switches to different page", () => {
      useTranscriptionStore.getState().openPanel("pg_1");
      useTranscriptionStore.getState().openPanel("pg_2");
      expect(useTranscriptionStore.getState().panelPageId).toBe("pg_2");
    });
  });

  describe("multiple pages", () => {
    it("tracks transcription for multiple pages independently", () => {
      const store = useTranscriptionStore.getState();
      store.updateStatus("pg_1", "complete", "Page 1 content");
      store.updateStatus("pg_2", "pending");
      store.updateStatus("pg_3", "failed", undefined, "Error");

      const state = useTranscriptionStore.getState();
      expect(state.transcriptions["pg_1"].status).toBe("complete");
      expect(state.transcriptions["pg_1"].content).toBe("Page 1 content");
      expect(state.transcriptions["pg_2"].status).toBe("pending");
      expect(state.transcriptions["pg_3"].status).toBe("failed");
      expect(state.transcriptions["pg_3"].error).toBe("Error");
    });
  });
});
