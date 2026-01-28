import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useNotebookPagesStore } from "../../stores/notebook-pages-store";
import { useViewStore } from "../../stores/view-store";
import { exportPagePdf, exportPagePng } from "../../api/export";
import { listNotebooks } from "../../api/notebooks";
import type { NotebookMeta } from "../../api/notebooks";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { showError, showSuccess, showInfo } from "../../stores/toast-store";
import { triggerTranscription, bulkTranscribe } from "../../api/transcription";

// Number of columns at each breakpoint (matches Tailwind classes)
const getColumnsForWidth = (width: number): number => {
  if (width >= 1280) return 4; // xl:grid-cols-4
  if (width >= 768) return 3;  // md:grid-cols-3
  return 2;                     // grid-cols-2
};

type ExportFormat = "pdf" | "png";
type PageSize = "original" | "a4" | "letter";
type PngScale = 1 | 2 | 3 | 4;

const BTN =
  "rounded-md px-3 py-2 text-sm font-medium border border-transparent";
const BTN_ACTIVE = "bg-black text-white border-black";
const BTN_INACTIVE = "text-gray-800 border-gray-300 bg-white";
const BTN_DISABLED = "opacity-40 cursor-not-allowed";

const PAGE_SIZE_LABELS: Record<PageSize, string> = {
  original: "Original",
  a4: "A4",
  letter: "Letter",
};

const PNG_SCALE_LABELS: Record<PngScale, string> = {
  1: "1\u00d7",
  2: "2\u00d7",
  3: "3\u00d7",
  4: "4\u00d7",
};

export function OverviewView() {
  const pages = useNotebookPagesStore((s) => s.pages);
  const notebookId = useNotebookPagesStore((s) => s.notebookId);
  const setCurrentPageIndex = useNotebookPagesStore((s) => s.setCurrentPageIndex);
  const reorderPages = useNotebookPagesStore((s) => s.reorderPages);
  const removePages = useNotebookPagesStore((s) => s.removePages);
  const movePages = useNotebookPagesStore((s) => s.movePages);
  const updatePageTags = useNotebookPagesStore((s) => s.updatePageTags);
  const duplicatePage = useNotebookPagesStore((s) => s.duplicatePage);
  const setViewMode = useViewStore((s) => s.setViewMode);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [tagMode, setTagMode] = useState<"add" | "remove">("add");
  const [tagInput, setTagInput] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const selectedIds = useMemo(() => Array.from(selected), [selected]);
  const selectedCount = selectedIds.length;

  useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      const valid = new Set(pages.map((p) => p.id));
      const next = new Set(Array.from(prev).filter((id) => valid.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [pages]);

  useEffect(() => {
    setSelected(new Set());
  }, [notebookId]);

  // Reset focus when pages change
  useEffect(() => {
    if (focusedIndex >= pages.length) {
      setFocusedIndex(pages.length > 0 ? pages.length - 1 : -1);
    }
  }, [pages.length, focusedIndex]);

  // Keyboard navigation handler
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Skip if any dialog is open or if typing in an input
    if (tagDialogOpen || exportOpen || moveOpen || deleteConfirmOpen) return;
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") return;

    const gridEl = gridRef.current;
    if (!gridEl || pages.length === 0) return;

    const columns = getColumnsForWidth(gridEl.clientWidth);

    switch (e.key) {
      case "ArrowRight": {
        e.preventDefault();
        setFocusedIndex((prev) => Math.min(prev + 1, pages.length - 1));
        break;
      }
      case "ArrowLeft": {
        e.preventDefault();
        setFocusedIndex((prev) => Math.max(prev - 1, 0));
        break;
      }
      case "ArrowDown": {
        e.preventDefault();
        setFocusedIndex((prev) => Math.min(prev + columns, pages.length - 1));
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        setFocusedIndex((prev) => Math.max(prev - columns, 0));
        break;
      }
      case "Enter": {
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < pages.length) {
          handleOpenPage(pages[focusedIndex].id);
        }
        break;
      }
      case " ": {
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < pages.length) {
          toggleSelect(pages[focusedIndex].id);
        }
        break;
      }
      case "Home": {
        e.preventDefault();
        setFocusedIndex(0);
        break;
      }
      case "End": {
        e.preventDefault();
        setFocusedIndex(pages.length - 1);
        break;
      }
    }
  }, [pages, focusedIndex, tagDialogOpen, exportOpen, moveOpen, deleteConfirmOpen]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener("keydown", handleKeyDown);
    return () => container.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex < 0) return;
    const gridEl = gridRef.current;
    if (!gridEl) return;
    const focusedEl = gridEl.children[focusedIndex] as HTMLElement | undefined;
    // scrollIntoView may not be available in test environments
    if (focusedEl?.scrollIntoView) {
      focusedEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [focusedIndex]);

  const toggleSelect = (pageId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) next.delete(pageId);
      else next.add(pageId);
      return next;
    });
  };

  const handleSelectAll = () => setSelected(new Set(pages.map((p) => p.id)));
  const handleClearSelection = () => setSelected(new Set());

  const handleOpenPage = (pageId: string) => {
    const idx = pages.findIndex((p) => p.id === pageId);
    if (idx >= 0) {
      setCurrentPageIndex(idx);
      setViewMode("single");
    }
  };

  const handleDragStart = (pageId: string) => (e: React.DragEvent) => {
    setDraggingId(pageId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", pageId);
  };

  const handleDragOver = (pageId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverId(pageId);
  };

  const handleDrop = (pageId: string) => async (e: React.DragEvent) => {
    e.preventDefault();
    const sourceId = draggingId || e.dataTransfer.getData("text/plain");
    if (!sourceId || sourceId === pageId) {
      setDraggingId(null);
      setDragOverId(null);
      return;
    }

    const order = reorderById(pages.map((p) => p.id), sourceId, pageId);
    await reorderPages(order);
    setDraggingId(null);
    setDragOverId(null);
  };

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

  const handleDeleteClick = () => {
    if (selectedCount === 0) return;
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    setDeleteConfirmOpen(false);
    try {
      await removePages(selectedIds);
      showSuccess(
        `Deleted ${selectedCount} page${selectedCount > 1 ? "s" : ""}`,
      );
      setSelected(new Set());
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : "Failed to delete pages");
    }
  };

  const handleMove = async (targetNotebookId: string) => {
    if (!targetNotebookId || selectedCount === 0) return;
    try {
      await movePages(selectedIds, targetNotebookId);
      showSuccess(
        `Moved ${selectedCount} page${selectedCount > 1 ? "s" : ""} to new notebook`,
      );
      setSelected(new Set());
      setMoveOpen(false);
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : "Failed to move pages");
    }
  };

  const handleTranscribeSelected = async () => {
    if (selectedCount === 0) return;
    setTranscribing(true);
    showInfo(`Queuing ${selectedCount} page${selectedCount > 1 ? "s" : ""} for transcription...`);
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
      showSuccess(`Queued ${queued} page${queued > 1 ? "s" : ""} for transcription`);
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : "Failed to queue transcription");
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
      showSuccess(`Queued ${result.queued} of ${result.total} pages for transcription`);
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : "Failed to queue transcription");
    } finally {
      setTranscribing(false);
    }
  };

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
      showSuccess(`Duplicated ${duplicated} page${duplicated > 1 ? "s" : ""}`);
      setSelected(new Set());
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : "Failed to duplicate pages");
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
      onFocus={() => {
        // Set initial focus to first item if none selected
        if (focusedIndex < 0 && pages.length > 0) {
          setFocusedIndex(0);
        }
      }}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">
            Overview (read-only)
          </span>
          <span className="hidden text-xs text-gray-400 sm:inline" title="Arrow keys navigate, Enter opens, Space selects">
            ← → ↑ ↓ navigate · Enter open · Space select
          </span>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500">
            Selected: {selectedCount}
          </span>
          <button
            onClick={handleSelectAll}
            className={`${BTN} ${BTN_INACTIVE}`}
          >
            Select All
          </button>
          <button
            onClick={handleClearSelection}
            className={`${BTN} ${BTN_INACTIVE}`}
          >
            Clear
          </button>
          <button
            onClick={() => {
              setTagMode("add");
              setTagDialogOpen(true);
            }}
            className={`${BTN} ${selectedCount ? BTN_ACTIVE : `${BTN_INACTIVE} ${BTN_DISABLED}`}`}
            disabled={!selectedCount}
          >
            Add Tags
          </button>
          <button
            onClick={() => {
              setTagMode("remove");
              setTagDialogOpen(true);
            }}
            className={`${BTN} ${selectedCount ? BTN_INACTIVE : `${BTN_INACTIVE} ${BTN_DISABLED}`}`}
            disabled={!selectedCount}
          >
            Remove Tags
          </button>
          <button
            onClick={() => setExportOpen(true)}
            className={`${BTN} ${selectedCount ? BTN_INACTIVE : `${BTN_INACTIVE} ${BTN_DISABLED}`}`}
            disabled={!selectedCount}
          >
            Export
          </button>
          <button
            onClick={handleDuplicate}
            className={`${BTN} ${selectedCount && !duplicating ? BTN_INACTIVE : `${BTN_INACTIVE} ${BTN_DISABLED}`}`}
            disabled={!selectedCount || duplicating}
          >
            {duplicating ? "Duplicating..." : "Duplicate"}
          </button>
          <button
            onClick={() => setMoveOpen(true)}
            className={`${BTN} ${selectedCount ? BTN_INACTIVE : `${BTN_INACTIVE} ${BTN_DISABLED}`}`}
            disabled={!selectedCount}
          >
            Move
          </button>
          <button
            onClick={handleTranscribeSelected}
            className={`${BTN} ${selectedCount && !transcribing ? BTN_INACTIVE : `${BTN_INACTIVE} ${BTN_DISABLED}`}`}
            disabled={!selectedCount || transcribing}
          >
            {transcribing ? "Transcribing..." : "Transcribe"}
          </button>
          <button
            onClick={handleTranscribeAll}
            className={`${BTN} ${!transcribing ? BTN_INACTIVE : `${BTN_INACTIVE} ${BTN_DISABLED}`}`}
            disabled={transcribing}
            title="Transcribe all pages that haven't been transcribed yet"
          >
            Transcribe All
          </button>
          <button
            onClick={handleDeleteClick}
            className={`${BTN} ${selectedCount ? "bg-red-600 text-white" : `${BTN_INACTIVE} ${BTN_DISABLED}`}`}
            disabled={!selectedCount}
          >
            Delete
          </button>
        </div>
      </div>

      <div ref={gridRef} className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        {pages.map((page, index) => {
          const selectedCard = selected.has(page.id);
          const dragOver = dragOverId === page.id;
          const isFocused = focusedIndex === index;
          return (
            <div
              key={page.id}
              draggable
              onDragStart={handleDragStart(page.id)}
              onDragOver={handleDragOver(page.id)}
              onDrop={handleDrop(page.id)}
              onDragEnd={() => {
                setDraggingId(null);
                setDragOverId(null);
              }}
              onClick={() => setFocusedIndex(index)}
              className={`group relative rounded-lg border bg-white p-2 shadow-sm transition-all ${
                selectedCard ? "border-black" : "border-gray-200"
              } ${dragOver ? "ring-2 ring-black" : ""} ${
                isFocused ? "ring-2 ring-blue-500 ring-offset-1" : ""
              }`}
              data-testid={`overview-page-${index}`}
              data-focused={isFocused}
            >
              <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
                <span>Page {page.pageNumber}</span>
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={selectedCard}
                    onChange={() => toggleSelect(page.id)}
                  />
                  Select
                </label>
              </div>
              <button
                onClick={() => handleOpenPage(page.id)}
                className="block w-full overflow-hidden rounded-md border border-gray-200 bg-gray-100"
                aria-label={`Open page ${page.pageNumber}`}
              >
                <img
                  src={`/api/pages/${page.id}/thumbnail`}
                  alt={`Page ${page.pageNumber}`}
                  className="h-full w-full object-contain"
                />
              </button>
              <div className="mt-2 flex flex-wrap gap-1">
                {(page.tags ?? []).slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                  >
                    {tag}
                  </span>
                ))}
                {(page.tags ?? []).length > 3 && (
                  <span className="text-xs text-gray-400">
                    +{(page.tags ?? []).length - 3}
                  </span>
                )}
              </div>
            </div>
          );
        })}
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

      {exportOpen && (
        <MultiExportDialog
          open={exportOpen}
          pageIds={selectedIds}
          onClose={() => setExportOpen(false)}
        />
      )}

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

function TagDialog({
  mode,
  value,
  onChange,
  onClose,
  onApply,
}: {
  mode: "add" | "remove";
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onApply: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg">
        <h2 className="text-lg font-semibold">
          {mode === "add" ? "Add Tags" : "Remove Tags"}
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          Enter tags separated by spaces or commas.
        </p>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="meeting, project-x"
          className="mt-3 w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className={`${BTN} ${BTN_INACTIVE}`}>
            Cancel
          </button>
          <button onClick={onApply} className={`${BTN} ${BTN_ACTIVE}`}>
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

function MultiExportDialog({
  open,
  pageIds,
  onClose,
}: {
  open: boolean;
  pageIds: string[];
  onClose: () => void;
}) {
  const [format, setFormat] = useState<ExportFormat>("pdf");
  const [pageSize, setPageSize] = useState<PageSize>("original");
  const [includeTranscription, setIncludeTranscription] = useState(false);
  const [pngScale, setPngScale] = useState<PngScale>(2);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setFormat("pdf");
      setPageSize("original");
      setIncludeTranscription(false);
      setPngScale(2);
      setExporting(false);
      setExportProgress(0);
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const handleExport = async () => {
    setExporting(true);
    setExportProgress(0);
    setError(null);
    try {
      for (let i = 0; i < pageIds.length; i++) {
        const pageId = pageIds[i];
        if (format === "pdf") {
          await exportPagePdf(pageId, { includeTranscription, pageSize });
        } else {
          await exportPagePng(pageId, { scale: pngScale });
        }
        setExportProgress(i + 1);
      }
      showSuccess(`Exported ${pageIds.length} page${pageIds.length > 1 ? "s" : ""}`);
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Export failed";
      setError(message);
      showError(message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={(e) => {
        if (e.target === e.currentTarget && !exporting) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg">
        <h2 className="text-lg font-semibold">Export {pageIds.length} pages</h2>
        <p className="mt-1 text-xs text-gray-500">
          This will download one file per page.
        </p>
        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Format
            </label>
            <div className="flex gap-1">
              {(["pdf", "png"] as ExportFormat[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`${BTN} uppercase ${format === f ? BTN_ACTIVE : BTN_INACTIVE}`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {format === "pdf" && (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Page Size
                </label>
                <div className="flex gap-1">
                  {(["original", "a4", "letter"] as PageSize[]).map((ps) => (
                    <button
                      key={ps}
                      onClick={() => setPageSize(ps)}
                      className={`${BTN} ${pageSize === ps ? BTN_ACTIVE : BTN_INACTIVE}`}
                    >
                      {PAGE_SIZE_LABELS[ps]}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-800">
                <input
                  type="checkbox"
                  checked={includeTranscription}
                  onChange={(e) => setIncludeTranscription(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                Include transcription
              </label>
            </>
          )}

          {format === "png" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Scale
              </label>
              <div className="flex gap-1">
                {([1, 2, 3, 4] as PngScale[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setPngScale(s)}
                    className={`${BTN} ${pngScale === s ? BTN_ACTIVE : BTN_INACTIVE}`}
                  >
                    {PNG_SCALE_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className={`${BTN} ${BTN_INACTIVE}`}
              disabled={exporting}
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              className={`${BTN} ${BTN_ACTIVE}`}
              disabled={exporting}
              data-testid="export-submit"
            >
              {exporting
                ? `Exporting ${exportProgress}/${pageIds.length}...`
                : "Export"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MoveDialog({
  open,
  currentNotebookId,
  onClose,
  onMove,
}: {
  open: boolean;
  currentNotebookId: string;
  onClose: () => void;
  onMove: (targetNotebookId: string) => void;
}) {
  const [notebooks, setNotebooks] = useState<NotebookMeta[]>([]);
  const [targetId, setTargetId] = useState("");

  useEffect(() => {
    if (!open) return;
    listNotebooks().then((data) => {
      setNotebooks(data.filter((nb) => nb.id !== currentNotebookId));
    }).catch(() => {
      setNotebooks([]);
    });
  }, [open, currentNotebookId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg">
        <h2 className="text-lg font-semibold">Move pages</h2>
        <label className="mt-3 block text-xs font-medium text-gray-500">
          Target notebook
        </label>
        <select
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
        >
          <option value="">Select notebook…</option>
          {notebooks.map((nb) => (
            <option key={nb.id} value={nb.id}>
              {nb.title || nb.id}
            </option>
          ))}
        </select>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className={`${BTN} ${BTN_INACTIVE}`}>
            Cancel
          </button>
          <button
            onClick={() => onMove(targetId)}
            className={`${BTN} ${targetId ? BTN_ACTIVE : `${BTN_INACTIVE} ${BTN_DISABLED}`}`}
            disabled={!targetId}
          >
            Move
          </button>
        </div>
      </div>
    </div>
  );
}

function reorderById(order: string[], fromId: string, toId: string): string[] {
  const fromIndex = order.indexOf(fromId);
  const toIndex = order.indexOf(toId);
  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return order;
  const next = [...order];
  next.splice(fromIndex, 1);
  next.splice(toIndex, 0, fromId);
  return next;
}

function parseTags(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(/[,\s]+/g)
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

function mergeTags(existing: string[], incoming: string[]) {
  const set = new Set(existing.map((t) => t.toLowerCase()));
  for (const tag of incoming) set.add(tag);
  return Array.from(set);
}
