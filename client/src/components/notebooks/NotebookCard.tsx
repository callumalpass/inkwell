import { useState, useRef, useEffect } from "react";
import type { NotebookMeta } from "../../api/notebooks";

interface NotebookCardProps {
  notebook: NotebookMeta;
  onClick: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onExport: () => void;
  onRename: (newTitle: string) => void;
  onUpdateTags: (tags: string[]) => void;
  availableTags?: string[];
}

function parseTags(input: string): string[] {
  const seen = new Set<string>();
  const parsed: string[] = [];
  for (const raw of input.split(",")) {
    const tag = raw.trim();
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    parsed.push(tag);
  }
  return parsed;
}

function tagsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function NotebookCard({
  notebook,
  onClick,
  onDelete,
  onDuplicate,
  onExport,
  onRename,
  onUpdateTags,
  availableTags = [],
}: NotebookCardProps) {
  const thumbnailUrl = notebook.coverPageId
    ? `/api/pages/${notebook.coverPageId}/thumbnail`
    : null;

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(notebook.title);
  const [isTagEditing, setIsTagEditing] = useState(false);
  const [tagValue, setTagValue] = useState((notebook.tags ?? []).join(", "));
  const inputRef = useRef<HTMLInputElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    if (isTagEditing && tagInputRef.current) {
      tagInputRef.current.focus();
      tagInputRef.current.select();
    }
  }, [isTagEditing]);

  useEffect(() => {
    if (!isTagEditing) {
      setTagValue((notebook.tags ?? []).join(", "));
    }
  }, [notebook.tags, isTagEditing]);

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

  const submitTags = () => {
    const parsed = parseTags(tagValue);
    const current = notebook.tags ?? [];
    if (!tagsEqual(parsed, current)) {
      onUpdateTags(parsed);
    }
    setIsTagEditing(false);
  };

  const selectedTags = parseTags(tagValue);
  const selectedTagKeys = new Set(selectedTags.map((tag) => tag.toLowerCase()));
  const suggestedTags = availableTags.filter((tag) => !selectedTagKeys.has(tag.toLowerCase()));

  const addSuggestedTag = (tag: string) => {
    setTagValue([...selectedTags, tag].join(", "));
    tagInputRef.current?.focus();
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
            alt={`Preview of ${notebook.title}`}
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
              aria-label="Notebook name. Press Enter to save, Escape to cancel"
            />
          ) : (
            <h3
              className="font-medium text-gray-900"
              onDoubleClick={handleDoubleClick}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "F2") {
                  e.preventDefault();
                  e.stopPropagation();
                  setEditValue(notebook.title);
                  setIsEditing(true);
                }
              }}
              tabIndex={0}
              aria-label={notebook.title}
              title="Double-click or press Enter to rename"
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
                setTagValue((notebook.tags ?? []).join(", "));
                setIsTagEditing(true);
              }}
              aria-label="Edit notebook tags"
              title="Edit tags"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 8l6-6h6v6l-6 6H2V8z" />
                <circle cx="11.5" cy="4.5" r="1.2" />
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
        {(notebook.tags?.length ?? 0) > 0 && (
          <div className="mt-2 flex flex-wrap gap-1" data-testid="notebook-tags">
            {(notebook.tags ?? []).map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-600"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        <p className="mt-1 text-sm text-gray-500">
          {notebook.pageCount ?? 0} {notebook.pageCount === 1 ? "page" : "pages"}
          {" \u00b7 "}
          {new Date(notebook.updatedAt).toLocaleDateString()}
        </p>
        {isTagEditing && (
          <div
            className="mt-3 rounded border border-gray-200 bg-gray-50 p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              ref={tagInputRef}
              value={tagValue}
              onChange={(e) => setTagValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitTags();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setIsTagEditing(false);
                  setTagValue((notebook.tags ?? []).join(", "));
                }
              }}
              placeholder="comma-separated tags"
              className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-gray-500 focus:outline-none"
              aria-label="Notebook tags"
              data-testid="notebook-tags-input"
            />
            {suggestedTags.length > 0 && (
              <div className="mt-3">
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-gray-500">
                  Existing tags
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestedTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className="rounded-full border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        addSuggestedTag(tag);
                      }}
                      data-testid={`notebook-tag-suggestion-${tag}`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-200"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsTagEditing(false);
                  setTagValue((notebook.tags ?? []).join(", "));
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded bg-gray-900 px-2 py-1 text-xs text-white hover:bg-gray-800"
                onClick={(e) => {
                  e.stopPropagation();
                  submitTags();
                }}
              >
                Save
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
