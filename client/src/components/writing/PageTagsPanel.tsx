import { useState, useMemo, useRef, useEffect } from "react";
import { useTagsPanelStore } from "../../stores/tags-panel-store";
import { useNotebookPagesStore } from "../../stores/notebook-pages-store";

export function PageTagsPanel() {
  const panelOpen = useTagsPanelStore((s) => s.panelOpen);
  const panelPageId = useTagsPanelStore((s) => s.panelPageId);
  const closePanel = useTagsPanelStore((s) => s.closePanel);

  const pages = useNotebookPagesStore((s) => s.pages);
  const updatePageTags = useNotebookPagesStore((s) => s.updatePageTags);

  const [newTag, setNewTag] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentPage = useMemo(
    () => pages.find((p) => p.id === panelPageId),
    [pages, panelPageId],
  );

  const tags = currentPage?.tags ?? [];

  // All unique tags across the notebook for suggestions
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const page of pages) {
      for (const tag of page.tags ?? []) {
        tagSet.add(tag);
      }
    }
    return Array.from(tagSet).sort();
  }, [pages]);

  // Tags not already on this page, filtered by current input
  const suggestions = useMemo(() => {
    if (!newTag.trim()) return [];
    const lower = newTag.toLowerCase();
    return allTags.filter(
      (t) => t.toLowerCase().includes(lower) && !tags.includes(t),
    );
  }, [allTags, tags, newTag]);

  // Focus input when panel opens
  useEffect(() => {
    if (panelOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [panelOpen]);

  if (!panelOpen || !panelPageId) return null;

  const handleAddTag = async (tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed || tags.includes(trimmed)) return;
    setSaving(true);
    setError(null);
    try {
      await updatePageTags(panelPageId, [...tags, trimmed]);
      setNewTag("");
    } catch (err: any) {
      setError(err.message || "Failed to add tag");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveTag = async (tag: string) => {
    setSaving(true);
    setError(null);
    try {
      await updatePageTags(
        panelPageId,
        tags.filter((t) => t !== tag),
      );
    } catch (err: any) {
      setError(err.message || "Failed to remove tag");
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && newTag.trim()) {
      e.preventDefault();
      handleAddTag(newTag);
    }
  };

  return (
    <div
      className="fixed inset-y-0 right-0 z-50 flex w-80 flex-col border-l border-gray-200 bg-white shadow-lg"
      data-testid="tags-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h2 className="text-sm font-medium text-gray-900">Page Tags</h2>
        <button
          onClick={closePanel}
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          data-testid="tags-panel-close"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M4 4L12 12M12 4L4 12"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Current tags */}
        <div className="border-b border-gray-100 px-4 py-3">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
            Tags ({tags.length})
          </h3>
          {tags.length === 0 ? (
            <p className="text-sm text-gray-400" data-testid="tags-empty">
              No tags yet. Add tags to organise your pages.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5" data-testid="tags-list">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-sm text-gray-700"
                  data-testid={`tag-${tag}`}
                >
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    disabled={saving}
                    className="rounded-full p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600 disabled:opacity-50"
                    aria-label={`Remove tag ${tag}`}
                    data-testid={`remove-tag-${tag}`}
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                    >
                      <path
                        d="M3 3L9 9M9 3L3 9"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Add tag */}
        <div className="px-4 py-3">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
            Add Tag
          </h3>
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a tag and press Enter"
              disabled={saving}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-gray-500 focus:outline-none disabled:opacity-50"
              data-testid="tag-input"
              maxLength={100}
            />
            {suggestions.length > 0 && (
              <div
                className="absolute left-0 right-0 top-full z-10 mt-1 max-h-32 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg"
                data-testid="tag-suggestions"
              >
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleAddTag(s)}
                    disabled={saving}
                    className="block w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    data-testid={`tag-suggestion-${s}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
          {error && (
            <p
              className="mt-1 text-sm text-red-600"
              data-testid="tags-error"
            >
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
