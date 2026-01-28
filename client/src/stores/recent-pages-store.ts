import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface RecentPage {
  pageId: string;
  notebookId: string;
  notebookTitle: string;
  pageNumber: number;
  visitedAt: number;
  thumbnailUrl: string;
}

interface RecentPagesStore {
  recentPages: RecentPage[];
  addRecentPage: (page: Omit<RecentPage, "visitedAt">) => void;
  removeRecentPage: (pageId: string) => void;
  clearRecentPages: () => void;
}

const MAX_RECENT_PAGES = 10;

export const useRecentPagesStore = create<RecentPagesStore>()(
  persist(
    (set) => ({
      recentPages: [],

      addRecentPage: (page) => {
        set((state) => {
          // Remove existing entry for this page if present
          const filtered = state.recentPages.filter((p) => p.pageId !== page.pageId);
          // Add new entry at the beginning
          const newEntry: RecentPage = {
            ...page,
            visitedAt: Date.now(),
          };
          // Keep only the most recent pages
          const updated = [newEntry, ...filtered].slice(0, MAX_RECENT_PAGES);
          return { recentPages: updated };
        });
      },

      removeRecentPage: (pageId) => {
        set((state) => ({
          recentPages: state.recentPages.filter((p) => p.pageId !== pageId),
        }));
      },

      clearRecentPages: () => {
        set({ recentPages: [] });
      },
    }),
    {
      name: "inkwell-recent-pages",
    }
  )
);
