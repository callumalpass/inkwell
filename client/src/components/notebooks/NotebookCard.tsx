import { useState, useRef, useEffect } from "react";
import type { NotebookMeta } from "../../api/notebooks";

interface NotebookCardProps {
  notebook: NotebookMeta;
  onClick: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onExport: () => void;
  onRename: (newTitle: string) => void;
}

export function NotebookCard({ notebook, onClick, onDelete, onDuplicate, onExport, onRename }: NotebookCardProps) {
  const thumbnailUrl = notebook.coverPageId
    ? `/api/pages/${notebook.coverPageId}/thumbnail`
    : null;

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(notebook.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditValue(notebook.title);
    setIsEditing(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitRename();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setEditValue(notebook.title);
    }
  };

  const submitRename = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== notebook.title) {
      onRename(trimmed);
    }
    setIsEditing(false);
  };

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
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={submitRename}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm font-medium text-gray-900 focus:border-gray-500 focus:outline-none"
              data-testid="notebook-rename-input"
            />
          ) : (
            <h3
              className="font-medium text-gray-900"
              onDoubleClick={handleDoubleClick}
              title="Double-click to rename"
            >
              {notebook.title}
            </h3>
          )}
          <div className="flex gap-1">
            <button
              className="ml-2 text-gray-400 opacity-0 hover:text-gray-700 group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                setEditValue(notebook.title);
                setIsEditing(true);
              }}
              aria-label="Rename notebook"
              title="Rename"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11.5 2.5l2 2M2 14l1-4 9-9 2 2-9 9-3 1z" />
              </svg>
            </button>
            <button
              className="text-gray-400 opacity-0 hover:text-gray-700 group-hover:opacity-100"
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
