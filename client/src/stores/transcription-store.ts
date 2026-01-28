import { create } from "zustand";
import * as transcriptionApi from "../api/transcription";
import type { TranscriptionStatus, TranscriptionInfo } from "../api/transcription";
import { showInfo, showError } from "./toast-store";

interface TranscriptionStore {
  // Per-page transcription data
  transcriptions: Record<string, TranscriptionInfo>;
  loading: Record<string, boolean>;
  panelOpen: boolean;
  panelPageId: string | null;

  loadTranscription: (pageId: string) => Promise<void>;
  triggerTranscription: (pageId: string, force?: boolean) => Promise<void>;
  updateStatus: (pageId: string, status: TranscriptionStatus, content?: string, error?: string) => void;
  openPanel: (pageId: string) => void;
  closePanel: () => void;
}

export const useTranscriptionStore = create<TranscriptionStore>((set, get) => ({
  transcriptions: {},
  loading: {},
  panelOpen: false,
  panelPageId: null,

  loadTranscription: async (pageId: string) => {
    const { loading } = get();
    if (loading[pageId]) return;

    set({ loading: { ...get().loading, [pageId]: true } });
    try {
      const info = await transcriptionApi.getTranscription(pageId);
      set({
        transcriptions: { ...get().transcriptions, [pageId]: info },
        loading: { ...get().loading, [pageId]: false },
      });
    } catch (err) {
      console.error(`Failed to load transcription for ${pageId}:`, err);
      set({ loading: { ...get().loading, [pageId]: false } });
    }
  },

  triggerTranscription: async (pageId: string, force = false) => {
    try {
      await transcriptionApi.triggerTranscription(pageId, force);
      // Optimistically update status to pending
      const existing = get().transcriptions[pageId];
      set({
        transcriptions: {
          ...get().transcriptions,
          [pageId]: {
            status: "pending",
            content: existing?.content ?? "",
            lastAttempt: existing?.lastAttempt ?? null,
            error: null,
          },
        },
      });
      showInfo("Transcription started");
    } catch (err) {
      console.error(`Failed to trigger transcription for ${pageId}:`, err);
      showError("Failed to start transcription");
    }
  },

  updateStatus: (pageId, status, content, error) => {
    const existing = get().transcriptions[pageId];
    set({
      transcriptions: {
        ...get().transcriptions,
        [pageId]: {
          status,
          content: content ?? existing?.content ?? "",
          lastAttempt: new Date().toISOString(),
          error: error ?? null,
        },
      },
    });
  },

  openPanel: (pageId) => set({ panelOpen: true, panelPageId: pageId }),
  closePanel: () => set({ panelOpen: false, panelPageId: null }),
}));
