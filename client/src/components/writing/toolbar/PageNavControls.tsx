import { useEffect, useRef, useState, useCallback } from "react";
import { useNotebookPagesStore } from "../../../stores/notebook-pages-store";
import { useViewStore } from "../../../stores/view-store";
import { useUIStore } from "../../../stores/ui-store";
import { useNavigate, useParams } from "react-router-dom";
import { ToolbarButton, Divider } from "./ToolbarPrimitives";
import { showError } from "../../../stores/toast-store";

interface PageNavControlsProps {
  showNavigation?: boolean;
  showAddPage?: boolean;
  addPageFirst?: boolean;
}

export function PageNavControls({
  showNavigation = true,
  showAddPage = true,
  addPageFirst = false,
}: PageNavControlsProps = {}) {
  const setPageJumpOpen = useUIStore((s) => s.setPageJumpOpen);
  const viewMode = useViewStore((s) => s.viewMode);
  const pages = useNotebookPagesStore((s) => s.pages);
  const currentPageIndex = useNotebookPagesStore((s) => s.currentPageIndex);
  const goToNextPage = useNotebookPagesStore((s) => s.goToNextPage);
  const goToPrevPage = useNotebookPagesStore((s) => s.goToPrevPage);
  const addNewPage = useNotebookPagesStore((s) => s.addNewPage);
  const addPageToRight = useNotebookPagesStore((s) => s.addPageToRight);
  const navigate = useNavigate();
  const { notebookId } = useParams<{ notebookId: string }>();
  const [creating, setCreating] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const [addMenuPosition, setAddMenuPosition] = useState({ top: 0, left: 0 });

  const updateAddMenuPosition = useCallback(() => {
    const button = addButtonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const menuWidth = 144; // Tailwind w-36
    const viewportPadding = 8;
    const left = Math.min(
      Math.max(viewportPadding, rect.left),
      window.innerWidth - menuWidth - viewportPadding,
    );

    setAddMenuPosition({
      top: rect.bottom + 4,
      left,
    });
  }, []);

  useEffect(() => {
    if (!addMenuOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!addMenuRef.current) return;
      if (event.target instanceof Node && !addMenuRef.current.contains(event.target)) {
        setAddMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [addMenuOpen]);

  useEffect(() => {
    if (!addMenuOpen) return;

    updateAddMenuPosition();

    const handleReposition = () => updateAddMenuPosition();
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [addMenuOpen, updateAddMenuPosition]);

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

  const handleAddPage = async (direction: "below" | "right") => {
    if (creating) return;
    setAddMenuOpen(false);
    setCreating(true);
    try {
      const page = direction === "right" ? await addPageToRight() : await addNewPage();
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

  const navigationControls =
    showNavigation && viewMode === "single" && pages.length > 0 ? (
      <>
        <div className="flex shrink-0 items-center gap-1">
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
        {showAddPage && <Divider />}
      </>
    ) : null;

  const addPageButton = showAddPage ? (
    <div className="relative shrink-0" ref={addMenuRef}>
      <button
        ref={addButtonRef}
        onClick={() => {
          setAddMenuOpen((open) => !open);
        }}
        disabled={creating}
        className={`shrink-0 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800 ${creating ? "opacity-50" : ""}`}
        aria-label="Add new page"
        aria-expanded={addMenuOpen}
      >
        {creating ? "..." : "+ Page"}
      </button>
      {addMenuOpen && !creating && (
        <div
          className="fixed z-50 w-36 rounded-md border border-gray-200 bg-white p-1 shadow-lg"
          style={{ top: addMenuPosition.top, left: addMenuPosition.left }}
          data-testid="add-page-menu"
        >
          <button
            onClick={() => handleAddPage("below")}
            className="block w-full rounded px-2 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50"
            data-testid="add-page-below"
          >
            +Page below
          </button>
          <button
            onClick={() => handleAddPage("right")}
            className="block w-full rounded px-2 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50"
            data-testid="add-page-right"
          >
            +Page right
          </button>
        </div>
      )}
    </div>
  ) : null;

  return (
    <>
      {addPageFirst && addPageButton}
      {navigationControls}
      {!addPageFirst && addPageButton}
    </>
  );
}
