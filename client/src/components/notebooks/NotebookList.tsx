import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { NotebookMeta } from "../../api/notebooks";
import { NotebookCard } from "./NotebookCard";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import * as pagesApi from "../../api/pages";

interface NotebookListProps {
  notebooks: NotebookMeta[];
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onExport: (notebook: NotebookMeta) => void;
}

export function NotebookList({ notebooks, onDelete, onDuplicate, onRename, onExport }: NotebookListProps) {
  const navigate = useNavigate();
  const [deleteTarget, setDeleteTarget] = useState<NotebookMeta | null>(null);

  const handleOpen = async (notebook: NotebookMeta) => {
    const pages = await pagesApi.listPages(notebook.id);
    let pageId: string;
    if (pages.length > 0) {
      pageId = pages[0].id;
    } else {
      const page = await pagesApi.createPage(notebook.id);
      pageId = page.id;
    }
    navigate(`/notebook/${notebook.id}/page/${pageId}`);
  };

  const handleDeleteConfirm = () => {
    if (deleteTarget) {
      onDelete(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  if (notebooks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16" data-testid="empty-notebooks">
        {/* Notebook illustration */}
        <div className="mb-6 flex h-32 w-32 items-center justify-center rounded-2xl bg-gray-100">
          <svg
            width="64"
            height="64"
            viewBox="0 0 64 64"
            fill="none"
            stroke="currentColor"
            className="text-gray-400"
          >
            {/* Notebook body */}
            <rect x="12" y="8" width="40" height="48" rx="2" strokeWidth="2" />
            {/* Binding rings */}
            <circle cx="12" cy="16" r="3" strokeWidth="1.5" />
            <circle cx="12" cy="32" r="3" strokeWidth="1.5" />
            <circle cx="12" cy="48" r="3" strokeWidth="1.5" />
            {/* Lines on page */}
            <line x1="20" y1="20" x2="44" y2="20" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="20" y1="28" x2="40" y2="28" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="20" y1="36" x2="42" y2="36" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="20" y1="44" x2="36" y2="44" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <h3 className="mb-2 text-lg font-medium text-gray-900">No notebooks yet</h3>
        <p className="mb-6 max-w-sm text-center text-sm text-gray-500">
          Create your first notebook to start capturing handwritten notes with automatic transcription.
        </p>
        <div className="flex flex-col items-center gap-2 text-xs text-gray-400">
          <p>Click &ldquo;New Notebook&rdquo; to get started</p>
          <p>or press <kbd className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-gray-600">Cmd+K</kbd> to search existing notes</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {notebooks.map((nb) => (
          <NotebookCard
            key={nb.id}
            notebook={nb}
            onClick={() => handleOpen(nb)}
            onDelete={() => setDeleteTarget(nb)}
            onDuplicate={() => onDuplicate(nb.id)}
            onRename={(title) => onRename(nb.id, title)}
            onExport={() => onExport(nb)}
          />
        ))}
      </div>
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Notebook"
        message={`Are you sure you want to delete "${deleteTarget?.title}"? This will permanently delete all ${deleteTarget?.pageCount ?? 0} pages in this notebook.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
