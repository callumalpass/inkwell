import { create } from "zustand";

interface BookmarkPanelStore {
  panelOpen: boolean;
  panelPageId: string | null;
  openPanel: (pageId: string) => void;
  closePanel: () => void;
}

export const useBookmarkPanelStore = create<BookmarkPanelStore>((set) => ({
  panelOpen: false,
  panelPageId: null,
  openPanel: (pageId) => set({ panelOpen: true, panelPageId: pageId }),
  closePanel: () => set({ panelOpen: false, panelPageId: null }),
}));
