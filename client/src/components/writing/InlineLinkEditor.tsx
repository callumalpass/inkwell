import { useEffect, useMemo, useState } from "react";
import * as notebooksApi from "../../api/notebooks";
import * as pagesApi from "../../api/pages";
import type { InlineLink, InlineLinkTarget, PageMeta } from "../../api/pages";
import { useNotebookPagesStore } from "../../stores/notebook-pages-store";

interface InlineLinkEditorProps {
  open: boolean;
  mode: "create" | "edit";
  currentNotebookId: string;
  initialLink: InlineLink | null;
  allowedTargetTypes?: InlineLinkTarget["type"][];
  excludedPageIds?: string[];
  onClose: () => void;
  onSave: (target: InlineLinkTarget) => Promise<void>;
  onDelete?: () => Promise<void>;
}

interface NotebookOption {
  id: string;
  title: string;
}

const URL_PROTOCOLS = new Set(["http:", "https:"]);
const DEFAULT_ALLOWED_TYPES: InlineLinkTarget["type"][] = ["page", "url"];

export function InlineLinkEditor({
  open,
  mode,
  currentNotebookId,
  initialLink,
  allowedTargetTypes,
  excludedPageIds,
  onClose,
  onSave,
  onDelete,
}: InlineLinkEditorProps) {
  const allowedTypes =
    allowedTargetTypes && allowedTargetTypes.length > 0
      ? allowedTargetTypes
      : DEFAULT_ALLOWED_TYPES;
  const allowedTypesKey = allowedTypes.join(",");
  const excludedSet = useMemo(
    () => new Set(excludedPageIds ?? []),
    [excludedPageIds],
  );
  const activeNotebookId = useNotebookPagesStore((s) => s.notebookId);
  const addNewPage = useNotebookPagesStore((s) => s.addNewPage);

  const [targetType, setTargetType] = useState<InlineLinkTarget["type"]>("page");
  const [notebooks, setNotebooks] = useState<NotebookOption[]>([]);
  const [selectedNotebookId, setSelectedNotebookId] = useState(currentNotebookId);
  const [pagesByNotebook, setPagesByNotebook] = useState<Record<string, PageMeta[]>>({});
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [filterText, setFilterText] = useState("");
  const [urlValue, setUrlValue] = useState("");
  const [labelValue, setLabelValue] = useState("");
  const [newNotebookTitle, setNewNotebookTitle] = useState("");
  const [loadingNotebooks, setLoadingNotebooks] = useState(false);
  const [loadingPages, setLoadingPages] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creatingPage, setCreatingPage] = useState(false);
  const [creatingNotebook, setCreatingNotebook] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    const initialType = initialLink?.target.type ?? "page";
    const nextType = allowedTypes.includes(initialType)
      ? initialType
      : allowedTypes[0];
    setTargetType(nextType);
    setFilterText("");
    setError(null);

    if (nextType === "page" && initialLink?.target.type === "page") {
      setSelectedNotebookId(initialLink.target.notebookId);
      setSelectedPageId(initialLink.target.pageId);
      setLabelValue(initialLink.target.label ?? "");
      setUrlValue("");
    } else if (nextType === "url" && initialLink?.target.type === "url") {
      setSelectedNotebookId(currentNotebookId);
      setSelectedPageId(null);
      setLabelValue(initialLink.target.label ?? "");
      setUrlValue(initialLink.target.url);
    } else {
      setSelectedNotebookId(currentNotebookId);
      setSelectedPageId(null);
      setLabelValue("");
      setUrlValue("");
    }
  }, [open, initialLink, currentNotebookId, allowedTypesKey]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoadingNotebooks(true);
    setError(null);

    notebooksApi
      .listNotebooks()
      .then((items) => {
        if (cancelled) return;
        const mapped = items
          .map((nb) => ({ id: nb.id, title: nb.title }))
          .sort((a, b) => a.title.localeCompare(b.title));
        setNotebooks(mapped);

        const hasSelected = mapped.some((nb) => nb.id === selectedNotebookId);
        if (!hasSelected) {
          setSelectedNotebookId(mapped[0]?.id ?? currentNotebookId);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to load notebooks";
        setError(message);
      })
      .finally(() => {
        if (!cancelled) setLoadingNotebooks(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, currentNotebookId]);

  useEffect(() => {
    if (!open || targetType !== "page") return;
    if (!selectedNotebookId) return;
    if (pagesByNotebook[selectedNotebookId]) return;

    let cancelled = false;
    setLoadingPages(true);
    setError(null);

    pagesApi
      .listPages(selectedNotebookId)
      .then((pages) => {
        if (cancelled) return;
        setPagesByNotebook((prev) => ({ ...prev, [selectedNotebookId]: pages }));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to load pages";
        setError(message);
      })
      .finally(() => {
        if (!cancelled) setLoadingPages(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, targetType, selectedNotebookId, pagesByNotebook]);

  const pages = pagesByNotebook[selectedNotebookId] ?? [];

  const filteredPages = useMemo(() => {
    const query = filterText.trim().toLowerCase();
    const candidates = pages.filter((page) => !excludedSet.has(page.id));
    if (!query) return candidates;

    return candidates.filter((page) => {
      const pageLabel = `page ${page.pageNumber}`;
      return (
        pageLabel.includes(query) ||
        String(page.pageNumber).includes(query) ||
        page.id.toLowerCase().includes(query)
      );
    });
  }, [pages, filterText, excludedSet]);

  if (!open) return null;

  const notebookTitleById = new Map(notebooks.map((nb) => [nb.id, nb.title] as const));

  const selectedPage = selectedPageId
    ? pages.find((page) => page.id === selectedPageId) ?? null
    : null;

  const handleCreatePage = async () => {
    if (!selectedNotebookId || creatingPage) return;
    setCreatingPage(true);
    setError(null);
    try {
      const page =
        activeNotebookId && selectedNotebookId === activeNotebookId
          ? await addNewPage()
          : await pagesApi.createPage(selectedNotebookId);
      setPagesByNotebook((prev) => {
        const existing = prev[selectedNotebookId] ?? [];
        return {
          ...prev,
          [selectedNotebookId]: [...existing, page].sort(
            (a, b) => a.pageNumber - b.pageNumber,
          ),
        };
      });
      setSelectedPageId(page.id);
      setTargetType("page");
      setLabelValue(
        `${notebookTitleById.get(selectedNotebookId) ?? "Notebook"} - Page ${page.pageNumber}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create page";
      setError(message);
    } finally {
      setCreatingPage(false);
    }
  };

  const handleCreateNotebookAndPage = async () => {
    const title = newNotebookTitle.trim();
    if (!title || creatingNotebook) return;

    setCreatingNotebook(true);
    setError(null);
    try {
      const notebook = await notebooksApi.createNotebook(title);
      const page = await pagesApi.createPage(notebook.id);

      setNotebooks((prev) =>
        [...prev, { id: notebook.id, title: notebook.title }].sort((a, b) =>
          a.title.localeCompare(b.title),
        ),
      );
      setPagesByNotebook((prev) => ({ ...prev, [notebook.id]: [page] }));
      setSelectedNotebookId(notebook.id);
      setSelectedPageId(page.id);
      setTargetType("page");
      setLabelValue(`${notebook.title} - Page ${page.pageNumber}`);
      setNewNotebookTitle("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create notebook";
      setError(message);
    } finally {
      setCreatingNotebook(false);
    }
  };

  const handleSave = async () => {
    if (saving) return;
    setError(null);

    let target: InlineLinkTarget;

    if (targetType === "page") {
      if (!selectedNotebookId || !selectedPage) {
        setError("Choose a target page first.");
        return;
      }

      target = {
        type: "page",
        notebookId: selectedNotebookId,
        pageId: selectedPage.id,
        label:
          labelValue.trim() ||
          `${notebookTitleById.get(selectedNotebookId) ?? "Notebook"} - Page ${selectedPage.pageNumber}`,
      };
    } else {
      const raw = urlValue.trim();
      if (!raw) {
        setError("Enter a URL.");
        return;
      }

      let parsed: URL;
      try {
        parsed = new URL(raw);
      } catch {
        setError("Enter a valid URL.");
        return;
      }

      if (!URL_PROTOCOLS.has(parsed.protocol)) {
        setError("Only http and https links are supported.");
        return;
      }

      target = {
        type: "url",
        url: parsed.toString(),
        label: labelValue.trim() || parsed.hostname,
      };
    }

    setSaving(true);
    try {
      await onSave(target);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save link";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onDelete();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to remove link";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4" data-testid="inline-link-editor-backdrop">
      <div className="w-full max-w-2xl rounded-lg border border-gray-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">
            {mode === "create" ? "Create Inline Link" : "Edit Inline Link"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            Close
          </button>
        </div>

        <div className="space-y-3 p-4">
          {allowedTypes.length > 1 && (
            <div className="flex gap-2">
              {allowedTypes.includes("page") && (
                <button
                  type="button"
                  onClick={() => setTargetType("page")}
                  className={`rounded px-2.5 py-1 text-xs font-medium ${
                    targetType === "page"
                      ? "bg-gray-900 text-white"
                      : "border border-gray-300 bg-white text-gray-700"
                  }`}
                  data-testid="inline-link-tab-page"
                >
                  Page
                </button>
              )}
              {allowedTypes.includes("url") && (
                <button
                  type="button"
                  onClick={() => setTargetType("url")}
                  className={`rounded px-2.5 py-1 text-xs font-medium ${
                    targetType === "url"
                      ? "bg-gray-900 text-white"
                      : "border border-gray-300 bg-white text-gray-700"
                  }`}
                  data-testid="inline-link-tab-url"
                >
                  URL
                </button>
              )}
            </div>
          )}

          {targetType === "page" ? (
            <div className="space-y-3" data-testid="inline-link-page-tab">
              <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
                    Notebook
                  </label>
                  <select
                    value={selectedNotebookId}
                    onChange={(e) => {
                      setSelectedNotebookId(e.target.value);
                      setSelectedPageId(null);
                    }}
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    data-testid="inline-link-notebook-select"
                    disabled={loadingNotebooks || notebooks.length === 0}
                  >
                    {notebooks.map((nb) => (
                      <option key={nb.id} value={nb.id}>
                        {nb.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
                    Filter
                  </label>
                  <input
                    type="text"
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    placeholder="Search by page number or id"
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    data-testid="inline-link-filter"
                  />
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <button
                  type="button"
                  onClick={handleCreatePage}
                  className="rounded border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  disabled={!selectedNotebookId || creatingPage}
                  data-testid="inline-link-create-page"
                >
                  {creatingPage ? "Creating page..." : "Create new page in selected notebook"}
                </button>

                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={newNotebookTitle}
                    onChange={(e) => setNewNotebookTitle(e.target.value)}
                    placeholder="New notebook title"
                    className="w-40 rounded border border-gray-300 px-2 py-1.5 text-xs"
                    data-testid="inline-link-new-notebook-title"
                  />
                  <button
                    type="button"
                    onClick={handleCreateNotebookAndPage}
                    className="rounded border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    disabled={!newNotebookTitle.trim() || creatingNotebook}
                    data-testid="inline-link-create-notebook-page"
                  >
                    {creatingNotebook ? "Creating..." : "New notebook + page"}
                  </button>
                </div>
              </div>

              <div
                className="max-h-56 overflow-y-auto rounded border border-gray-200"
                data-testid="inline-link-page-list"
              >
                {loadingPages ? (
                  <p className="px-3 py-2 text-sm text-gray-500">Loading pages...</p>
                ) : filteredPages.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-gray-500">
                    No pages found. Create one to link it.
                  </p>
                ) : (
                  <ul>
                    {filteredPages.map((page) => {
                      const selected = page.id === selectedPageId;
                      return (
                        <li key={page.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPageId(page.id);
                              setLabelValue(
                                `${notebookTitleById.get(page.notebookId) ?? "Notebook"} - Page ${page.pageNumber}`,
                              );
                            }}
                            className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                              selected
                                ? "bg-gray-900 text-white"
                                : "text-gray-700 hover:bg-gray-50"
                            }`}
                            data-testid={`inline-link-page-option-${page.id}`}
                          >
                            <span>{`Page ${page.pageNumber}`}</span>
                            <span className={`text-xs ${selected ? "text-gray-200" : "text-gray-400"}`}>
                              {page.id}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3" data-testid="inline-link-url-tab">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
                  URL
                </label>
                <input
                  type="url"
                  value={urlValue}
                  onChange={(e) => setUrlValue(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  data-testid="inline-link-url-input"
                />
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
              Label (optional)
            </label>
            <input
              type="text"
              value={labelValue}
              onChange={(e) => setLabelValue(e.target.value)}
              placeholder={targetType === "page" ? "Notebook - Page 1" : "Link label"}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              data-testid="inline-link-label-input"
            />
          </div>

          {error && (
            <p className="rounded border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700" data-testid="inline-link-error">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
          <div>
            {mode === "edit" && onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="rounded border border-red-300 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                data-testid="inline-link-delete"
              >
                Remove link
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded bg-gray-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              data-testid="inline-link-save"
            >
              {saving ? "Saving..." : mode === "create" ? "Create link" : "Save link"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
