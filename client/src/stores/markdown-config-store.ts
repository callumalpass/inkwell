import { create } from "zustand";
import type { MarkdownConfig, SyncStatus, FrontmatterConfig, SyncConfig } from "../api/markdown";
import { getMarkdownConfig, updateMarkdownConfig, getSyncStatus } from "../api/markdown";

interface MarkdownConfigStore {
  config: MarkdownConfig | null;
  syncStatus: SyncStatus | null;
  loading: boolean;
  error: string | null;
  fetchConfig: () => Promise<void>;
  fetchSyncStatus: () => Promise<void>;
  updateFrontmatter: (updates: Partial<FrontmatterConfig>) => Promise<void>;
  updateSync: (updates: Partial<SyncConfig>) => Promise<void>;
}

export const useMarkdownConfigStore = create<MarkdownConfigStore>((set, get) => ({
  config: null,
  syncStatus: null,
  loading: false,
  error: null,

  fetchConfig: async () => {
    set({ loading: true, error: null });
    try {
      const config = await getMarkdownConfig();
      set({ config, loading: false });
    } catch (err: any) {
      set({ error: err.message || "Failed to load config", loading: false });
    }
  },

  fetchSyncStatus: async () => {
    try {
      const syncStatus = await getSyncStatus();
      set({ syncStatus });
    } catch {
      // Non-critical, swallow
    }
  },

  updateFrontmatter: async (updates) => {
    const { config } = get();
    if (!config) return;
    const optimistic = {
      ...config,
      frontmatter: { ...config.frontmatter, ...updates },
    };
    set({ config: optimistic, error: null });
    try {
      const saved = await updateMarkdownConfig({ frontmatter: updates });
      set({ config: saved });
    } catch (err: any) {
      set({ config, error: err.message || "Failed to save" });
    }
  },

  updateSync: async (updates) => {
    const { config } = get();
    if (!config) return;
    const optimistic = {
      ...config,
      sync: { ...config.sync, ...updates },
    };
    set({ config: optimistic, error: null });
    try {
      const saved = await updateMarkdownConfig({ sync: updates });
      set({ config: saved });
    } catch (err: any) {
      set({ config, error: err.message || "Failed to save" });
    }
  },
}));
