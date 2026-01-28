import { useNavigate } from "react-router-dom";
import type { NotebookMeta } from "../../api/notebooks";
import { NotebookCard } from "./NotebookCard";
import * as pagesApi from "../../api/pages";

interface NotebookListProps {
  notebooks: NotebookMeta[];
  onDelete: (id: string) => void;
  onExport: (notebook: NotebookMeta) => void;
}

export function NotebookList({ notebooks, onDelete, onExport }: NotebookListProps) {
  const navigate = useNavigate();

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

  if (notebooks.length === 0) {
    return (
      <p className="text-center text-gray-500">
        No notebooks yet. Create one to get started.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {notebooks.map((nb) => (
        <NotebookCard
          key={nb.id}
          notebook={nb}
          onClick={() => handleOpen(nb)}
          onDelete={() => onDelete(nb.id)}
          onExport={() => onExport(nb)}
        />
      ))}
    </div>
  );
}
