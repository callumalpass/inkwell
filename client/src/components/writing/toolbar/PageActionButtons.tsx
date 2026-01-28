import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLinksPanelStore } from "../../../stores/links-panel-store";
import { useTagsPanelStore } from "../../../stores/tags-panel-store";
import { useNotebookPagesStore } from "../../../stores/notebook-pages-store";
import { usePageStore } from "../../../stores/page-store";
import { useUndoRedoStore } from "../../../stores/undo-redo-store";
import { ExportDialog } from "../../export/ExportDialog";
import { NotebookSettingsDialog } from "../../settings/NotebookSettingsDialog";
import { ConfirmDialog } from "../../ui/ConfirmDialog";
import { ToolbarButton, Divider } from "./ToolbarPrimitives";
import { clearStrokes } from "../../../api/strokes";
import { showSuccess, showError } from "../../../stores/toast-store";

interface PageActionButtonsProps {
  currentPageId: string | null;
  notebookId: string | undefined;
  /** data-testid suffix — "compact" or omitted for full layout */
  testIdSuffix?: string;
}

export function PageActionButtons({
  currentPageId,
  notebookId,
  testIdSuffix,
}: PageActionButtonsProps) {
  const navigate = useNavigate();
  const { notebookId: routeNotebookId } = useParams<{ notebookId: string }>();
  const linksPanelOpen = useLinksPanelStore((s) => s.panelOpen);
  const openLinksPanel = useLinksPanelStore((s) => s.openPanel);
  const closeLinksPanel = useLinksPanelStore((s) => s.closePanel);

  const tagsPanelOpen = useTagsPanelStore((s) => s.panelOpen);
  const openTagsPanel = useTagsPanelStore((s) => s.openPanel);
  const closeTagsPanel = useTagsPanelStore((s) => s.closePanel);

  const duplicatePage = useNotebookPagesStore((s) => s.duplicatePage);
  const pages = useNotebookPagesStore((s) => s.pages);
  const currentPageIndex = useNotebookPagesStore((s) => s.currentPageIndex);
  const removePages = useNotebookPagesStore((s) => s.removePages);

  const [exportOpen, setExportOpen] = useState(false);
  const [notebookSettingsOpen, setNotebookSettingsOpen] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const clearSavedStrokes = usePageStore((s) => s.clearSavedStrokes);
  const clearUndoHistory = useUndoRedoStore((s) => s.clearPage);

  const handleToggleLinks = () => {
    if (!currentPageId) return;
    if (linksPanelOpen) {
      closeLinksPanel();
    } else {
      closeTagsPanel();
      openLinksPanel(currentPageId);
    }
  };

  const handleToggleTags = () => {
    if (!currentPageId) return;
    if (tagsPanelOpen) {
      closeTagsPanel();
    } else {
      closeLinksPanel();
      openTagsPanel(currentPageId);
    }
  };

  const handleDuplicate = async () => {
    if (!currentPageId || duplicating) return;
    setDuplicating(true);
    try {
      const newPage = await duplicatePage(currentPageId);
      showSuccess("Page duplicated");
      // Navigate to the new page
      const nbId = routeNotebookId || notebookId;
      if (nbId) {
        navigate(`/notebook/${nbId}/page/${newPage.id}`, { replace: true });
      }
    } catch (err) {
      console.error("Failed to duplicate page:", err);
      showError("Failed to duplicate page");
    } finally {
      setDuplicating(false);
    }
  };

  const handleClearPage = async () => {
    if (!currentPageId || clearing) return;
    setClearing(true);
    setClearConfirmOpen(false);
    try {
      await clearStrokes(currentPageId);
      clearSavedStrokes(currentPageId);
      clearUndoHistory(currentPageId);
      showSuccess("Page cleared");
    } catch (err) {
      console.error("Failed to clear page:", err);
      showError("Failed to clear page");
    } finally {
      setClearing(false);
    }
  };

  const handleDeletePage = async () => {
    if (!currentPageId || deleting) return;
    setDeleting(true);
    setDeleteConfirmOpen(false);
    try {
      // Find next page to navigate to before deletion
      const nbId = routeNotebookId || notebookId;
      let nextPageId: string | null = null;
      if (pages.length > 1) {
        // Navigate to adjacent page
        const nextIndex = currentPageIndex < pages.length - 1 ? currentPageIndex + 1 : currentPageIndex - 1;
        nextPageId = pages[nextIndex]?.id ?? null;
      }

      await removePages([currentPageId]);
      showSuccess("Page deleted");

      if (nbId) {
        if (nextPageId) {
          navigate(`/notebook/${nbId}/page/${nextPageId}`, { replace: true });
        } else {
          // No pages left, go back to notebook overview
          navigate(`/notebook/${nbId}`, { replace: true });
        }
      }
    } catch (err) {
      console.error("Failed to delete page:", err);
      showError("Failed to delete page");
    } finally {
      setDeleting(false);
    }
  };

  const suffix = testIdSuffix ? `-${testIdSuffix}` : "";

  return (
    <>
      {currentPageId && (
        <>
          <ToolbarButton
            onClick={handleDuplicate}
            disabled={duplicating}
            aria-label="Duplicate page"
            data-testid={`toolbar-duplicate${suffix}`}
          >
            {duplicating ? "..." : "Duplicate"}
          </ToolbarButton>
          <ToolbarButton
            onClick={() => setExportOpen(true)}
            aria-label="Export page"
            data-testid={`toolbar-export${suffix}`}
          >
            Export
          </ToolbarButton>
          <ToolbarButton
            onClick={() => setClearConfirmOpen(true)}
            disabled={clearing}
            aria-label="Clear page"
            data-testid={`toolbar-clear${suffix}`}
          >
            {clearing ? "..." : "Clear"}
          </ToolbarButton>
          <ToolbarButton
            onClick={() => setDeleteConfirmOpen(true)}
            disabled={deleting}
            aria-label="Delete page"
            data-testid={`toolbar-delete${suffix}`}
            variant="danger"
          >
            {deleting ? "..." : "Delete"}
          </ToolbarButton>
          <Divider />
        </>
      )}

      {currentPageId && (
        <>
          <ToolbarButton
            onClick={handleToggleLinks}
            active={linksPanelOpen}
            aria-label="Page links"
            data-testid={`toolbar-links${suffix}`}
          >
            Links
          </ToolbarButton>
          <Divider />
        </>
      )}

      {currentPageId && (
        <>
          <ToolbarButton
            onClick={handleToggleTags}
            active={tagsPanelOpen}
            aria-label="Page tags"
            data-testid={`toolbar-tags${suffix}`}
          >
            Tags
          </ToolbarButton>
          <Divider />
        </>
      )}

      <ToolbarButton
        onClick={() => setNotebookSettingsOpen(true)}
        aria-label="Notebook settings"
        data-testid={`toolbar-notebook-settings${suffix}`}
      >
        {testIdSuffix === "compact" ? "Notebook Settings" : "Settings"}
      </ToolbarButton>

      {currentPageId && (
        <ExportDialog
          open={exportOpen}
          onClose={() => setExportOpen(false)}
          pageId={currentPageId}
          notebookId={notebookId}
        />
      )}

      <NotebookSettingsDialog
        open={notebookSettingsOpen}
        onClose={() => setNotebookSettingsOpen(false)}
      />

      <ConfirmDialog
        open={clearConfirmOpen}
        title="Clear page"
        message="Are you sure you want to clear all strokes from this page? This action cannot be undone."
        confirmLabel="Clear"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleClearPage}
        onCancel={() => setClearConfirmOpen(false)}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Delete page"
        message="Are you sure you want to delete this page? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleDeletePage}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </>
  );
}
