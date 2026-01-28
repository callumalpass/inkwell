import { useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useNotebookPagesStore } from "../stores/notebook-pages-store";
import { useViewStore } from "../stores/view-store";

/**
 * Hook that enables arrow key navigation between pages.
 * - Left arrow: go to previous page
 * - Right arrow: go to next page
 * Only active in single page view mode.
 */
export function usePageNavKeyboard() {
  const navigate = useNavigate();
  const { notebookId } = useParams<{ notebookId: string }>();
  const viewMode = useViewStore((s) => s.viewMode);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Only handle in single page view
      if (viewMode !== "single") return;

      // Don't intercept if user is typing in an input
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // Don't intercept if modifier keys are pressed (let other shortcuts work)
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const { pages, currentPageIndex, goToNextPage, goToPrevPage } =
        useNotebookPagesStore.getState();

      if (e.key === "ArrowLeft") {
        if (currentPageIndex > 0) {
          e.preventDefault();
          goToPrevPage();
          const prevPage = pages[currentPageIndex - 1];
          if (prevPage && notebookId) {
            navigate(`/notebook/${notebookId}/page/${prevPage.id}`, { replace: true });
          }
        }
      } else if (e.key === "ArrowRight") {
        if (currentPageIndex < pages.length - 1) {
          e.preventDefault();
          goToNextPage();
          const nextPage = pages[currentPageIndex + 1];
          if (nextPage && notebookId) {
            navigate(`/notebook/${notebookId}/page/${nextPage.id}`, { replace: true });
          }
        }
      }
    },
    [viewMode, notebookId, navigate],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
