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

/**
 * Returns the most recently visited page ID for a notebook.
 * Optionally validates against a set/list of currently-existing page IDs.
 */
export function getLastVisitedPageIdForNotebook(
  notebookId: string,
  existingPageIds?: Iterable<string>,
): string | null {
  const recentPages = useRecentPagesStore.getState().recentPages;
  const validIds = existingPageIds ? new Set(existingPageIds) : null;

  for (const page of recentPages) {
    if (page.notebookId !== notebookId) continue;
    if (validIds && !validIds.has(page.pageId)) continue;
    return page.pageId;
  }

  return null;
}

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
