import type { NotebookMeta } from "../../api/notebooks";

interface NotebookCardProps {
  notebook: NotebookMeta;
  onClick: () => void;
  onDelete: () => void;
}

export function NotebookCard({ notebook, onClick, onDelete }: NotebookCardProps) {
  return (
    <div
      className="group cursor-pointer rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-400"
      onClick={onClick}
    >
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
        {new Date(notebook.updatedAt).toLocaleDateString()}
      </p>
    </div>
  );
}
