import { create } from "zustand";

interface TagsPanelStore {
  panelOpen: boolean;
  panelPageId: string | null;
  openPanel: (pageId: string) => void;
  closePanel: () => void;
}

export const useTagsPanelStore = create<TagsPanelStore>((set) => ({
  panelOpen: false,
  panelPageId: null,
  openPanel: (pageId) => set({ panelOpen: true, panelPageId: pageId }),
  closePanel: () => set({ panelOpen: false, panelPageId: null }),
}));
