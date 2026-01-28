import { useState } from "react";
import { useNotebookPagesStore } from "../../../stores/notebook-pages-store";
import { useViewStore } from "../../../stores/view-store";
import { useUIStore } from "../../../stores/ui-store";
import { useNavigate, useParams } from "react-router-dom";
import { ToolbarButton, Divider } from "./ToolbarPrimitives";
import { showError } from "../../../stores/toast-store";

export function PageNavControls() {
  const setPageJumpOpen = useUIStore((s) => s.setPageJumpOpen);
  const viewMode = useViewStore((s) => s.viewMode);
  const pages = useNotebookPagesStore((s) => s.pages);
  const currentPageIndex = useNotebookPagesStore((s) => s.currentPageIndex);
  const goToNextPage = useNotebookPagesStore((s) => s.goToNextPage);
  const goToPrevPage = useNotebookPagesStore((s) => s.goToPrevPage);
  const addNewPage = useNotebookPagesStore((s) => s.addNewPage);
  const navigate = useNavigate();
  const { notebookId } = useParams<{ notebookId: string }>();
  const [creating, setCreating] = useState(false);

  const handlePageNav = (direction: "prev" | "next") => {
    if (direction === "prev") {
      goToPrevPage();
      const prevPage = pages[currentPageIndex - 1];
      if (prevPage && notebookId) {
        navigate(`/notebook/${notebookId}/page/${prevPage.id}`, { replace: true });
      }
    } else {
      goToNextPage();
      const nextPage = pages[currentPageIndex + 1];
      if (nextPage && notebookId) {
        navigate(`/notebook/${notebookId}/page/${nextPage.id}`, { replace: true });
      }
    }
  };

  const handleAddPage = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const page = await addNewPage();
      if (notebookId) {
        navigate(`/notebook/${notebookId}/page/${page.id}`, { replace: true });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create page";
      showError(message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      {viewMode === "single" && pages.length > 0 && (
        <>
          <div className="flex items-center gap-1">
            <ToolbarButton
              onClick={() => handlePageNav("prev")}
              disabled={currentPageIndex === 0}
            >
              Prev
            </ToolbarButton>
            <button
              onClick={() => setPageJumpOpen(true)}
              className="rounded px-2 py-1 text-sm font-medium text-gray-800 hover:bg-gray-100"
              title="Click to jump to page (G)"
              aria-label="Jump to page"
              data-testid="page-jump-button"
            >
              {currentPageIndex + 1}/{pages.length}
            </button>
            <ToolbarButton
              onClick={() => handlePageNav("next")}
              disabled={currentPageIndex >= pages.length - 1}
            >
              Next
            </ToolbarButton>
          </div>
          <Divider />
        </>
      )}

      <button
        onClick={handleAddPage}
        disabled={creating}
        className={`rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800 ${creating ? "opacity-50" : ""}`}
        aria-label="Add new page"
      >
        {creating ? "..." : "+ Page"}
      </button>
    </>
  );
}
