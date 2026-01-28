import type { NotebookMeta } from "../../api/notebooks";

interface NotebookCardProps {
  notebook: NotebookMeta;
  onClick: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onExport: () => void;
}

export function NotebookCard({ notebook, onClick, onDelete, onDuplicate, onExport }: NotebookCardProps) {
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
          <div className="flex gap-1">
            <button
              className="ml-2 text-gray-400 opacity-0 hover:text-gray-700 group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate();
              }}
              aria-label="Duplicate notebook"
              title="Duplicate"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="5" width="9" height="9" rx="1" />
                <path d="M2 11V3a1 1 0 011-1h8" />
              </svg>
            </button>
            <button
              className="text-gray-400 opacity-0 hover:text-gray-700 group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onExport();
              }}
              aria-label="Export notebook"
              title="Export"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 2v8M5 7l3 3 3-3M3 12v1.5h10V12" />
              </svg>
            </button>
            <button
              className="text-gray-400 opacity-0 hover:text-red-500 group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              aria-label="Delete notebook"
              title="Delete"
            >
              &times;
            </button>
          </div>
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
