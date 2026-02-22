import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useBookmarkPanelStore } from "../../stores/bookmark-panel-store";
import { useNotebookPagesStore } from "../../stores/notebook-pages-store";
import type { NotebookBookmark } from "../../api/notebooks";

export function PageBookmarksPanel() {
  const panelOpen = useBookmarkPanelStore((s) => s.panelOpen);
  const panelPageId = useBookmarkPanelStore((s) => s.panelPageId);
  const closePanel = useBookmarkPanelStore((s) => s.closePanel);

  const pages = useNotebookPagesStore((s) => s.pages);
  const currentPageIndex = useNotebookPagesStore((s) => s.currentPageIndex);
  const settings = useNotebookPagesStore((s) => s.settings);
  const notebookId = useNotebookPagesStore((s) => s.notebookId);
  const setCurrentPageIndex = useNotebookPagesStore((s) => s.setCurrentPageIndex);
  const addBookmark = useNotebookPagesStore((s) => s.addBookmark);
  const removeBookmark = useNotebookPagesStore((s) => s.removeBookmark);
  const updateBookmark = useNotebookPagesStore((s) => s.updateBookmark);

  const [labelInput, setLabelInput] = useState("");
  const [parentSelection, setParentSelection] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const params = useParams<{ notebookId: string }>();

  const pageById = useMemo(
    () => new Map(pages.map((p) => [p.id, p] as const)),
    [pages],
  );
  const activePageId = pages[currentPageIndex]?.id ?? panelPageId;

  const bookmarks = useMemo(() => {
    const list = settings.bookmarks ?? [];
    return list
      .filter((bookmark) => pageById.has(bookmark.pageId))
      .slice()
      .sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order;
        return a.createdAt.localeCompare(b.createdAt);
      });
  }, [settings.bookmarks, pageById]);

  const currentBookmark = useMemo(
    () => bookmarks.find((b) => b.pageId === activePageId) ?? null,
    [bookmarks, activePageId],
  );

  useEffect(() => {
    if (!panelOpen) return;
    if (currentBookmark) {
      setLabelInput(currentBookmark.label ?? "");
      setParentSelection(currentBookmark.parentId ?? "");
      return;
    }
    setLabelInput("");
    setParentSelection("");
  }, [panelOpen, currentBookmark?.id]);

  const rootBookmarks = useMemo(() => {
    const ids = new Set(bookmarks.map((b) => b.id));
    return bookmarks.filter((b) => !b.parentId || !ids.has(b.parentId));
  }, [bookmarks]);

  const childrenByParent = useMemo(() => {
    const map = new Map<string, NotebookBookmark[]>();
    for (const bookmark of bookmarks) {
      if (!bookmark.parentId) continue;
      const children = map.get(bookmark.parentId) ?? [];
      children.push(bookmark);
      map.set(bookmark.parentId, children);
    }
    for (const children of map.values()) {
      children.sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order;
        return a.createdAt.localeCompare(b.createdAt);
      });
    }
    return map;
  }, [bookmarks]);

  const blockedParentIds = useMemo(() => {
    if (!currentBookmark) return new Set<string>();
    const blocked = new Set<string>([currentBookmark.id]);
    const stack = [currentBookmark.id];
    while (stack.length > 0) {
      const id = stack.pop() as string;
      const children = childrenByParent.get(id) ?? [];
      for (const child of children) {
        if (!blocked.has(child.id)) {
          blocked.add(child.id);
          stack.push(child.id);
        }
      }
    }
    return blocked;
  }, [childrenByParent, currentBookmark]);

  const parentOptions = useMemo(
    () => bookmarks.filter((b) => !blockedParentIds.has(b.id)),
    [bookmarks, blockedParentIds],
  );

  if (!panelOpen || !activePageId) return null;

  const panelPage = pageById.get(activePageId) ?? null;

  const navigateToPage = (pageId: string) => {
    const nbId = params.notebookId ?? notebookId;
    if (!nbId) return;
    const pageIndex = pages.findIndex((p) => p.id === pageId);
    if (pageIndex >= 0) {
      setCurrentPageIndex(pageIndex);
    }
    navigate(`/notebook/${nbId}/page/${pageId}`, { replace: true });
  };

  const pageLabel = (pageId: string) => {
    const page = pageById.get(pageId);
    return page ? `Page ${page.pageNumber}` : pageId;
  };

  const bookmarkLabel = (bookmark: NotebookBookmark) =>
    bookmark.label?.trim() || pageLabel(bookmark.pageId);

  const handleAddCurrent = async () => {
    if (!panelPage) return;
    setSaving(true);
    setError(null);
    try {
      await addBookmark(panelPage.id, {
        label: labelInput,
        parentId: parentSelection || null,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add bookmark");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveCurrent = async () => {
    if (!currentBookmark) return;
    setSaving(true);
    setError(null);
    try {
      await removeBookmark(currentBookmark.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to remove bookmark");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCurrent = async () => {
    if (!currentBookmark) return;
    setSaving(true);
    setError(null);
    try {
      await updateBookmark(currentBookmark.id, {
        label: labelInput,
        parentId: parentSelection || null,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update bookmark");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveBookmark = async (bookmarkId: string) => {
    setSaving(true);
    setError(null);
    try {
      await removeBookmark(bookmarkId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to remove bookmark");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-y-0 right-0 z-50 flex w-80 flex-col border-l border-gray-200 bg-white shadow-lg"
      data-testid="bookmarks-panel"
    >
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h2 className="text-sm font-medium text-gray-900">Bookmarks</h2>
        <button
          onClick={closePanel}
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          data-testid="bookmarks-panel-close"
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

      <div className="flex-1 overflow-y-auto">
        <div className="border-b border-gray-100 px-4 py-3">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
            Current Page
          </h3>
          <p className="mb-2 text-sm text-gray-700">
            {panelPage ? `Page ${panelPage.pageNumber}` : activePageId}
          </p>

          <label className="mb-1 block text-xs font-medium text-gray-500">
            Label
          </label>
          <input
            type="text"
            value={labelInput}
            onChange={(e) => setLabelInput(e.target.value)}
            placeholder={panelPage ? `Page ${panelPage.pageNumber}` : "Bookmark label"}
            className="mb-2 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm placeholder:text-gray-400 focus:border-gray-500 focus:outline-none"
            data-testid="bookmark-label-input"
            maxLength={120}
            disabled={saving}
          />

          <label className="mb-1 block text-xs font-medium text-gray-500">
            Parent (nest under)
          </label>
          <select
            value={parentSelection}
            onChange={(e) => setParentSelection(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm text-gray-700 focus:border-gray-500 focus:outline-none"
            data-testid="bookmark-parent-select"
            disabled={saving}
          >
            <option value="">Top level</option>
            {parentOptions.map((bookmark) => (
              <option key={bookmark.id} value={bookmark.id}>
                {bookmarkLabel(bookmark)}
              </option>
            ))}
          </select>

          <div className="mt-2 flex items-center gap-2">
            {currentBookmark ? (
              <>
                <button
                  onClick={handleSaveCurrent}
                  disabled={saving}
                  className="rounded border border-gray-300 bg-white px-2.5 py-1 text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                  data-testid="bookmark-save-current"
                >
                  Save
                </button>
                <button
                  onClick={handleRemoveCurrent}
                  disabled={saving}
                  className="rounded border border-red-300 bg-white px-2.5 py-1 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                  data-testid="bookmark-toggle-current"
                >
                  Remove bookmark
                </button>
              </>
            ) : (
              <button
                onClick={handleAddCurrent}
                disabled={saving || !panelPage}
                className="rounded border border-gray-300 bg-white px-2.5 py-1 text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                data-testid="bookmark-toggle-current"
              >
                Add bookmark
              </button>
            )}
          </div>
          {error && (
            <p className="mt-2 text-sm text-red-600" data-testid="bookmarks-error">
              {error}
            </p>
          )}
        </div>

        <div className="px-4 py-3">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
            All Bookmarks ({bookmarks.length})
          </h3>
          {bookmarks.length === 0 ? (
            <p className="text-sm text-gray-400">No bookmarks yet.</p>
          ) : (
            <ul className="space-y-1" data-testid="bookmarks-list">
              {rootBookmarks.map((bookmark) => (
                <BookmarkListItem
                  key={bookmark.id}
                  bookmark={bookmark}
                  pageLabel={pageLabel}
                  bookmarkLabel={bookmarkLabel}
                  childrenByParent={childrenByParent}
                  depth={0}
                  onNavigate={navigateToPage}
                  onRemove={handleRemoveBookmark}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function BookmarkListItem({
  bookmark,
  pageLabel,
  bookmarkLabel,
  childrenByParent,
  depth,
  onNavigate,
  onRemove,
}: {
  bookmark: NotebookBookmark;
  pageLabel: (pageId: string) => string;
  bookmarkLabel: (bookmark: NotebookBookmark) => string;
  childrenByParent: Map<string, NotebookBookmark[]>;
  depth: number;
  onNavigate: (pageId: string) => void;
  onRemove: (bookmarkId: string) => void;
}) {
  const children = childrenByParent.get(bookmark.id) ?? [];
  return (
    <li data-testid={`bookmark-item-${bookmark.id}`}>
      <div
        className="flex items-center justify-between rounded px-2 py-1.5 hover:bg-gray-50"
        style={{ paddingLeft: 8 + depth * 14 }}
      >
        <button
          onClick={() => onNavigate(bookmark.pageId)}
          className="text-left text-sm text-gray-800 hover:text-black"
          data-testid={`bookmark-navigate-${bookmark.id}`}
        >
          {bookmarkLabel(bookmark)}
          <span className="ml-1 text-xs text-gray-400">{pageLabel(bookmark.pageId)}</span>
        </button>
        <button
          onClick={() => onRemove(bookmark.id)}
          className="rounded px-1.5 py-0.5 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-800"
          data-testid={`bookmark-remove-${bookmark.id}`}
        >
          Remove
        </button>
      </div>
      {children.length > 0 && (
        <ul className="space-y-1">
          {children.map((child) => (
            <BookmarkListItem
              key={child.id}
              bookmark={child}
              pageLabel={pageLabel}
              bookmarkLabel={bookmarkLabel}
              childrenByParent={childrenByParent}
              depth={depth + 1}
              onNavigate={onNavigate}
              onRemove={onRemove}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
