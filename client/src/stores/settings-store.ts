import { create } from "zustand";
import type { AppSettings } from "../api/settings";
import { getSettings, saveSettings } from "../api/settings";

interface SettingsStore {
  settings: AppSettings;
  loaded: boolean;
  fetchSettings: () => Promise<void>;
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: {},
  loaded: false,

  fetchSettings: async () => {
    try {
      const settings = await getSettings();
      set({ settings, loaded: true });
    } catch {
      // If settings fail to load, continue with empty defaults
      set({ loaded: true });
    }
  },

  updateSettings: async (updates) => {
    const merged = { ...get().settings, ...updates };
    set({ settings: merged });
    const saved = await saveSettings(merged);
    set({ settings: saved });
  },
}));
