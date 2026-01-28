import type { NotebookMeta } from "../../api/notebooks";

interface NotebookCardProps {
  notebook: NotebookMeta;
  onClick: () => void;
  onDelete: () => void;
}

export function NotebookCard({ notebook, onClick, onDelete }: NotebookCardProps) {
  const thumbnailUrl = notebook.coverPageId
    ? `/api/pages/${notebook.coverPageId}/thumbnail`
    : null;

  return (
    <div
      className="group cursor-pointer overflow-hidden rounded-lg border border-gray-200 bg-white hover:border-gray-400"
      onClick={onClick}
    >
      {/* Thumbnail preview */}
      <div className="flex h-40 items-center justify-center bg-gray-50">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt=""
            className="h-full w-full object-contain"
            loading="lazy"
          />
        ) : (
          <span className="text-sm text-gray-300">No pages</span>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between">
          <h3 className="font-medium text-gray-900">{notebook.title}</h3>
          <button
            className="ml-2 text-gray-400 opacity-0 hover:text-red-500 group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            aria-label="Delete notebook"
          >
            &times;
          </button>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          {notebook.pageCount ?? 0} {notebook.pageCount === 1 ? "page" : "pages"}
          {" \u00b7 "}
          {new Date(notebook.updatedAt).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}
