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
  onExport: (notebook: NotebookMeta) => void;
}

export function NotebookList({ notebooks, onDelete, onDuplicate, onExport }: NotebookListProps) {
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
      <p className="text-center text-gray-500">
        No notebooks yet. Create one to get started.
      </p>
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
