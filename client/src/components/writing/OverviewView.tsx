import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useNotebookPagesStore } from "../../stores/notebook-pages-store";
import { useViewStore } from "../../stores/view-store";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { showError, showSuccess, showInfo } from "../../stores/toast-store";
import { triggerTranscription, bulkTranscribe } from "../../api/transcription";
import {
  TagDialog,
  MoveDialog,
  ExportDialog,
  PageCard,
  OverviewToolbar,
  reorderById,
  parseTags,
  mergeTags,
} from "./overview";
import { useSelection } from "./overview/useSelection";
import { useKeyboardNavigation } from "./overview/useKeyboardNavigation";

export function OverviewView() {
  const pages = useNotebookPagesStore((s) => s.pages);
  const notebookId = useNotebookPagesStore((s) => s.notebookId);
  const setCurrentPageIndex = useNotebookPagesStore(
    (s) => s.setCurrentPageIndex,
  );
  const reorderPages = useNotebookPagesStore((s) => s.reorderPages);
  const removePages = useNotebookPagesStore((s) => s.removePages);
  const movePages = useNotebookPagesStore((s) => s.movePages);
  const updatePageTags = useNotebookPagesStore((s) => s.updatePageTags);
  const duplicatePage = useNotebookPagesStore((s) => s.duplicatePage);
  const setViewMode = useViewStore((s) => s.setViewMode);

  // Dialog state
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [tagMode, setTagMode] = useState<"add" | "remove">("add");
  const [tagInput, setTagInput] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Operation state
  const [transcribing, setTranscribing] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [moving, setMoving] = useState(false);

  // Drag and drop state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const pageIds = useMemo(() => pages.map((p) => p.id), [pages]);

  const {
    selected,
    selectedIds,
    selectedCount,
    toggleSelect,
    selectAll,
    clearSelection,
  } = useSelection({ pageIds, notebookId });

  const anyDialogOpen =
    tagDialogOpen || exportOpen || moveOpen || deleteConfirmOpen;

  const handleOpenPage = useCallback(
    (pageId: string) => {
      const idx = pages.findIndex((p) => p.id === pageId);
      if (idx >= 0) {
        setCurrentPageIndex(idx);
        setViewMode("single");
      }
    },
    [pages, setCurrentPageIndex, setViewMode],
  );

  const handleEnter = useCallback(
    (index: number) => {
      if (index >= 0 && index < pages.length) {
        handleOpenPage(pages[index].id);
      }
    },
    [pages, handleOpenPage],
  );

  const handleSpace = useCallback(
    (index: number) => {
      if (index >= 0 && index < pages.length) {
        toggleSelect(pages[index].id);
      }
    },
    [pages, toggleSelect],
  );

  const { focusedIndex, setFocusedIndex, handleContainerFocus, handleKeyDown } =
    useKeyboardNavigation({
      itemCount: pages.length,
      gridRef,
      disabled: anyDialogOpen,
      onEnter: handleEnter,
      onSpace: handleSpace,
    });

  // Attach keyboard handler to container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener("keydown", handleKeyDown);
    return () => container.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Drag handlers
  const handleDragStart =
    (pageId: string) => (e: React.DragEvent) => {
      setDraggingId(pageId);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", pageId);
    };

  const handleDragOver =
    (pageId: string) => (e: React.DragEvent) => {
      e.preventDefault();
      setDragOverId(pageId);
    };

  const handleDrop =
    (pageId: string) => async (e: React.DragEvent) => {
      e.preventDefault();
      const sourceId = draggingId || e.dataTransfer.getData("text/plain");
      if (!sourceId || sourceId === pageId) {
        setDraggingId(null);
        setDragOverId(null);
        return;
      }

      const order = reorderById(pageIds, sourceId, pageId);
      await reorderPages(order);
      setDraggingId(null);
      setDragOverId(null);
    };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverId(null);
  };

  // Tag operations
  const handleTagsApply = async () => {
    const tags = parseTags(tagInput);
    if (tags.length === 0) return;
    const selectedPages = pages.filter((p) => selected.has(p.id));
    try {
      await Promise.all(
        selectedPages.map((page) => {
          const current = page.tags ?? [];
          const next =
            tagMode === "add"
              ? mergeTags(current, tags)
              : current.filter((t) => !tags.includes(t));
          return updatePageTags(page.id, next);
        }),
      );
      showSuccess(
        tagMode === "add"
          ? `Added tags to ${selectedPages.length} page${selectedPages.length > 1 ? "s" : ""}`
          : `Removed tags from ${selectedPages.length} page${selectedPages.length > 1 ? "s" : ""}`,
      );
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : "Failed to update tags");
    }
    setTagInput("");
    setTagDialogOpen(false);
  };

  // Delete operations
  const handleDeleteClick = () => {
    if (selectedCount === 0) return;
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    setDeleteConfirmOpen(false);
    setDeleting(true);
    try {
      await removePages(selectedIds);
      showSuccess(
        `Deleted ${selectedCount} page${selectedCount > 1 ? "s" : ""}`,
      );
      clearSelection();
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : "Failed to delete pages");
    } finally {
      setDeleting(false);
    }
  };

  // Move operations
  const handleMove = async (targetNotebookId: string) => {
    if (!targetNotebookId || selectedCount === 0) return;
    setMoving(true);
    try {
      await movePages(selectedIds, targetNotebookId);
      showSuccess(
        `Moved ${selectedCount} page${selectedCount > 1 ? "s" : ""} to new notebook`,
      );
      clearSelection();
      setMoveOpen(false);
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : "Failed to move pages");
    } finally {
      setMoving(false);
    }
  };

  // Transcription operations
  const handleTranscribeSelected = async () => {
    if (selectedCount === 0) return;
    setTranscribing(true);
    showInfo(
      `Queuing ${selectedCount} page${selectedCount > 1 ? "s" : ""} for transcription...`,
    );
    try {
      let queued = 0;
      for (const pageId of selectedIds) {
        try {
          await triggerTranscription(pageId, false);
          queued++;
        } catch {
          // Continue with other pages even if one fails
        }
      }
      showSuccess(
        `Queued ${queued} page${queued > 1 ? "s" : ""} for transcription`,
      );
    } catch (err: unknown) {
      showError(
        err instanceof Error ? err.message : "Failed to queue transcription",
      );
    } finally {
      setTranscribing(false);
    }
  };

  const handleTranscribeAll = async () => {
    if (!notebookId) return;
    setTranscribing(true);
    showInfo("Queuing all pages for transcription...");
    try {
      const result = await bulkTranscribe(notebookId);
      showSuccess(
        `Queued ${result.queued} of ${result.total} pages for transcription`,
      );
    } catch (err: unknown) {
      showError(
        err instanceof Error ? err.message : "Failed to queue transcription",
      );
    } finally {
      setTranscribing(false);
    }
  };

  // Duplicate operations
  const handleDuplicate = async () => {
    if (selectedCount === 0) return;
    setDuplicating(true);
    try {
      let duplicated = 0;
      for (const pageId of selectedIds) {
        try {
          await duplicatePage(pageId);
          duplicated++;
        } catch {
          // Continue with other pages even if one fails
        }
      }
      showSuccess(
        `Duplicated ${duplicated} page${duplicated > 1 ? "s" : ""}`,
      );
      clearSelection();
    } catch (err: unknown) {
      showError(
        err instanceof Error ? err.message : "Failed to duplicate pages",
      );
    } finally {
      setDuplicating(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto bg-gray-50 px-6 py-4 outline-none"
      data-testid="overview-view"
      tabIndex={0}
      onFocus={handleContainerFocus}
    >
      <OverviewToolbar
        selectedCount={selectedCount}
        transcribing={transcribing}
        duplicating={duplicating}
        deleting={deleting}
        moving={moving}
        onSelectAll={selectAll}
        onClearSelection={clearSelection}
        onAddTags={() => {
          setTagMode("add");
          setTagDialogOpen(true);
        }}
        onRemoveTags={() => {
          setTagMode("remove");
          setTagDialogOpen(true);
        }}
        onExport={() => setExportOpen(true)}
        onDuplicate={handleDuplicate}
        onMove={() => setMoveOpen(true)}
        onTranscribeSelected={handleTranscribeSelected}
        onTranscribeAll={handleTranscribeAll}
        onDelete={handleDeleteClick}
      />

      <div
        ref={gridRef}
        className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4"
      >
        {pages.map((page, index) => (
          <PageCard
            key={page.id}
            page={page}
            index={index}
            selected={selected.has(page.id)}
            focused={focusedIndex === index}
            dragOver={dragOverId === page.id}
            onSelect={toggleSelect}
            onOpen={handleOpenPage}
            onFocus={setFocusedIndex}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
          />
        ))}
      </div>

      {tagDialogOpen && (
        <TagDialog
          mode={tagMode}
          value={tagInput}
          onChange={setTagInput}
          onClose={() => setTagDialogOpen(false)}
          onApply={handleTagsApply}
        />
      )}

      <ExportDialog
        open={exportOpen}
        pageIds={selectedIds}
        onClose={() => setExportOpen(false)}
      />

      {moveOpen && notebookId && (
        <MoveDialog
          open={moveOpen}
          currentNotebookId={notebookId}
          onClose={() => setMoveOpen(false)}
          onMove={handleMove}
        />
      )}

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Delete pages"
        message={`Are you sure you want to delete ${selectedCount} page${selectedCount > 1 ? "s" : ""}? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </div>
  );
}
