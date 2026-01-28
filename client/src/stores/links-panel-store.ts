import { create } from "zustand";

interface LinksPanelStore {
  panelOpen: boolean;
  panelPageId: string | null;
  openPanel: (pageId: string) => void;
  closePanel: () => void;
}

export const useLinksPanelStore = create<LinksPanelStore>((set) => ({
  panelOpen: false,
  panelPageId: null,
  openPanel: (pageId) => set({ panelOpen: true, panelPageId: pageId }),
  closePanel: () => set({ panelOpen: false, panelPageId: null }),
}));
