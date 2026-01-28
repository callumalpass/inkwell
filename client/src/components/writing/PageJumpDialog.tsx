import { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useNotebookPagesStore } from "../../stores/notebook-pages-store";

interface PageJumpDialogProps {
  open: boolean;
  onClose: () => void;
}

export function PageJumpDialog({ open, onClose }: PageJumpDialogProps) {
  const pages = useNotebookPagesStore((s) => s.pages);
  const currentPageIndex = useNotebookPagesStore((s) => s.currentPageIndex);
  const setCurrentPageIndex = useNotebookPagesStore((s) => s.setCurrentPageIndex);
  const navigate = useNavigate();
  const { notebookId } = useParams<{ notebookId: string }>();

  const [jumpValue, setJumpValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when dialog opens
  useEffect(() => {
    if (open) {
      setJumpValue(String(currentPageIndex + 1));
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [open, currentPageIndex]);

  // Handle escape key
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const handleJumpToPage = () => {
    const pageNum = parseInt(jumpValue, 10);
    if (isNaN(pageNum) || pageNum < 1 || pageNum > pages.length) {
      onClose();
      return;
    }
    const targetIndex = pageNum - 1;
    const targetPage = pages[targetIndex];
    if (targetPage && notebookId) {
      setCurrentPageIndex(targetIndex);
      navigate(`/notebook/${notebookId}/page/${targetPage.id}`, { replace: true });
    }
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleJumpToPage();
    }
  };

  if (!open || pages.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      data-testid="page-jump-dialog"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xs rounded-lg bg-white p-4 shadow-lg">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">
          Jump to page
        </h3>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="number"
            min={1}
            max={pages.length}
            value={jumpValue}
            onChange={(e) => setJumpValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-20 rounded border border-gray-300 px-2 py-1.5 text-center text-sm"
            data-testid="page-jump-input"
          />
          <span className="text-sm text-gray-500">of {pages.length}</span>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleJumpToPage}
            className="rounded bg-black px-3 py-1.5 text-sm font-medium text-white"
            data-testid="page-jump-go"
          >
            Go
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          Press Enter to jump, Escape to cancel
        </p>
      </div>
    </div>
  );
}
