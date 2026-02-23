import { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { PageMeta } from "../../api/pages";
import { getPage } from "../../api/pages";
import { useLinksPanelStore } from "../../stores/links-panel-store";
import { useNotebookPagesStore } from "../../stores/notebook-pages-store";
import { InlineLinkEditor } from "./InlineLinkEditor";
import { showError, showInfo } from "../../stores/toast-store";

export function PageLinksPanel() {
  const panelOpen = useLinksPanelStore((s) => s.panelOpen);
  const panelPageId = useLinksPanelStore((s) => s.panelPageId);
  const closePanel = useLinksPanelStore((s) => s.closePanel);

  const pages = useNotebookPagesStore((s) => s.pages);
  const updatePageLinks = useNotebookPagesStore((s) => s.updatePageLinks);
  const updatePageInlineLinks = useNotebookPagesStore((s) => s.updatePageInlineLinks);
  const updatePageTags = useNotebookPagesStore((s) => s.updatePageTags);
  const notebookId = useNotebookPagesStore((s) => s.notebookId);
  const setCurrentPageIndex = useNotebookPagesStore(
    (s) => s.setCurrentPageIndex,
  );

  const navigate = useNavigate();
  const params = useParams<{ notebookId: string }>();

  const [addLinkModalOpen, setAddLinkModalOpen] = useState(false);
  const [resolvedLinkedPages, setResolvedLinkedPages] = useState<
    Record<string, PageMeta | null>
  >({});
  const [tagInput, setTagInput] = useState("");
  const tagInputRef = useRef<HTMLInputElement>(null);

  const currentPage = useMemo(
    () => pages.find((p) => p.id === panelPageId),
    [pages, panelPageId],
  );

  const links = currentPage?.links ?? [];
  const inlineLinks = currentPage?.inlineLinks ?? [];
  const tags = currentPage?.tags ?? [];

  useEffect(() => {
    if (!panelOpen || links.length === 0) return;

    const localPageIds = new Set(pages.map((page) => page.id));
    const unresolvedIds = links.filter(
      (linkId) => !localPageIds.has(linkId) && !(linkId in resolvedLinkedPages),
    );
    if (unresolvedIds.length === 0) return;

    let cancelled = false;

    void Promise.all(
      unresolvedIds.map(async (linkId) => {
        try {
          const linkedPage = await getPage(linkId);
          return [linkId, linkedPage] as const;
        } catch {
          return [linkId, null] as const;
        }
      }),
    ).then((results) => {
      if (cancelled) return;
      setResolvedLinkedPages((prev) => {
        const next = { ...prev };
        for (const [linkId, page] of results) {
          next[linkId] = page;
        }
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [panelOpen, links, pages, resolvedLinkedPages]);

  // Pages that link to this page (backlinks)
  const backlinks = useMemo(
    () =>
      panelPageId
        ? pages.filter(
            (p) =>
              p.id !== panelPageId &&
              (p.links?.includes(panelPageId) ||
                p.inlineLinks?.some(
                  (link) =>
                    link.target.type === "page" &&
                    link.target.pageId === panelPageId,
                )),
          )
        : [],
    [pages, panelPageId],
  );

  if (!panelOpen || !panelPageId) return null;

  const handleRemoveLink = async (linkId: string) => {
    const newLinks = links.filter((id) => id !== linkId);
    await updatePageLinks(panelPageId, newLinks);
  };

  const handleRemoveInlineLink = async (linkId: string) => {
    const newInlineLinks = inlineLinks.filter((link) => link.id !== linkId);
    await updatePageInlineLinks(panelPageId, newInlineLinks);
  };

  const handleAddTag = async () => {
    const trimmed = tagInput.trim().toLowerCase();
    if (!trimmed || tags.includes(trimmed)) {
      setTagInput("");
      return;
    }
    const newTags = [...tags, trimmed];
    await updatePageTags(panelPageId, newTags);
    setTagInput("");
    tagInputRef.current?.focus();
  };

  const handleRemoveTag = async (tag: string) => {
    const newTags = tags.filter((t) => t !== tag);
    await updatePageTags(panelPageId, newTags);
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    }
  };

  const navigateToPage = (pageId: string, targetNotebookId?: string | null) => {
    const nbId = targetNotebookId ?? params.notebookId ?? notebookId;
    if (!nbId) return;
    if (nbId === (params.notebookId ?? notebookId)) {
      const pageIndex = pages.findIndex((p) => p.id === pageId);
      if (pageIndex >= 0) {
        setCurrentPageIndex(pageIndex);
      }
    }
    navigate(`/notebook/${nbId}/page/${pageId}`, { replace: true });
  };

  const navigateToInlineLink = (link: (typeof inlineLinks)[number]) => {
    if (link.target.type === "url") {
      window.open(link.target.url, "_blank", "noopener,noreferrer");
      return;
    }
    const nbId = link.target.notebookId;
    if (!nbId) return;
    if (nbId === (params.notebookId ?? notebookId)) {
      const pageIndex = pages.findIndex((p) => p.id === link.target.pageId);
      if (pageIndex >= 0) {
        setCurrentPageIndex(pageIndex);
      }
    }
    navigate(`/notebook/${nbId}/page/${link.target.pageId}`, { replace: true });
  };

  const pageLabel = (page: { id: string; pageNumber: number; notebookId: string }) => {
    const base = `Page ${page.pageNumber}`;
    if (page.notebookId !== (params.notebookId ?? notebookId)) {
      return `${base} (${page.notebookId})`;
    }
    return base;
  };

  return (
    <div
      className="fixed inset-y-0 right-0 z-50 flex w-80 flex-col border-l border-gray-200 bg-white shadow-lg"
      data-testid="links-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h2 className="text-sm font-medium text-gray-900">Page Info</h2>
        <button
          onClick={closePanel}
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          data-testid="links-panel-close"
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
        {/* Tags */}
        <div className="border-b border-gray-100 px-4 py-3">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
            Tags ({tags.length})
          </h3>
          {tags.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5" data-testid="tags-list">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700"
                  data-testid={`tag-${tag}`}
                >
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-0.5 rounded-full p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                    aria-label={`Remove tag ${tag}`}
                    data-testid={`remove-tag-${tag}`}
                  >
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 10 10"
                      fill="none"
                    >
                      <path
                        d="M3 3L7 7M7 3L3 7"
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
          <div className="flex gap-1.5">
            <input
              ref={tagInputRef}
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              placeholder="Add tag..."
              className="flex-1 rounded border border-gray-200 px-2 py-1 text-sm text-gray-700 placeholder-gray-400 focus:border-gray-400 focus:outline-none"
              data-testid="tag-input"
            />
            <button
              onClick={handleAddTag}
              disabled={!tagInput.trim()}
              className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              data-testid="add-tag-button"
            >
              Add
            </button>
          </div>
        </div>

        {/* Outgoing links */}
        <div className="border-b border-gray-100 px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Links ({links.length})
            </h3>
            <button
              onClick={() => setAddLinkModalOpen(true)}
              className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
              data-testid="add-link-button"
            >
              + Add
            </button>
          </div>
          {links.length === 0 ? (
            <p className="text-sm text-gray-400">
              No links yet. Link to pages in this or other notebooks.
            </p>
          ) : (
            <ul className="space-y-1" data-testid="links-list">
              {links.map((linkId) => {
                const linkedPage =
                  pages.find((page) => page.id === linkId) ??
                  resolvedLinkedPages[linkId] ??
                  null;
                const label = linkedPage
                  ? pageLabel(linkedPage)
                  : `Page ${linkId}`;
                const targetNotebookId = linkedPage?.notebookId ?? null;

                return (
                  <li
                    key={linkId}
                    className="flex items-center justify-between rounded px-2 py-1.5 hover:bg-gray-50"
                  >
                    <button
                      onClick={() => navigateToPage(linkId, targetNotebookId)}
                      className="text-sm text-gray-800 hover:text-black"
                      data-testid={`link-navigate-${linkId}`}
                    >
                      {label}
                    </button>
                    <button
                      onClick={() => handleRemoveLink(linkId)}
                      className="rounded p-0.5 text-gray-300 hover:bg-gray-100 hover:text-gray-600"
                      aria-label={`Remove link to ${label}`}
                      data-testid={`remove-link-${linkId}`}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 14 14"
                        fill="none"
                      >
                        <path
                          d="M4 4L10 10M10 4L4 10"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Backlinks */}
        <div className="border-b border-gray-100 px-4 py-3">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
            Inline links ({inlineLinks.length})
          </h3>
          {inlineLinks.length === 0 ? (
            <p className="text-sm text-gray-400">
              No inline links yet.
            </p>
          ) : (
            <ul className="space-y-1" data-testid="inline-links-list">
              {inlineLinks.map((link) => (
                <li
                  key={link.id}
                  className="flex items-center justify-between rounded px-2 py-1.5 hover:bg-gray-50"
                >
                  <button
                    onClick={() => navigateToInlineLink(link)}
                    className="truncate text-left text-sm text-gray-800 hover:text-black"
                    data-testid={`inline-link-navigate-${link.id}`}
                  >
                    {link.target.label?.trim() ||
                      (link.target.type === "page"
                        ? `Page ${link.target.pageId}`
                        : link.target.url)}
                  </button>
                  <button
                    onClick={() => handleRemoveInlineLink(link.id)}
                    className="rounded p-0.5 text-gray-300 hover:bg-gray-100 hover:text-gray-600"
                    aria-label="Remove inline link"
                    data-testid={`remove-inline-link-${link.id}`}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="none"
                    >
                      <path
                        d="M4 4L10 10M10 4L4 10"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Backlinks */}
        <div className="px-4 py-3">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
            Backlinks ({backlinks.length})
          </h3>
          {backlinks.length === 0 ? (
            <p className="text-sm text-gray-400">
              No other pages link to this page.
            </p>
          ) : (
            <ul className="space-y-1" data-testid="backlinks-list">
              {backlinks.map((page) => (
                <li
                  key={page.id}
                  className="rounded px-2 py-1.5 hover:bg-gray-50"
                >
                  <button
                    onClick={() => navigateToPage(page.id)}
                    className="text-sm text-gray-800 hover:text-black"
                    data-testid={`backlink-navigate-${page.id}`}
                  >
                    {pageLabel(page)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <InlineLinkEditor
        open={addLinkModalOpen}
        mode="create"
        currentNotebookId={params.notebookId ?? notebookId ?? ""}
        initialLink={null}
        allowedTargetTypes={["page"]}
        excludedPageIds={[panelPageId, ...links]}
        onClose={() => setAddLinkModalOpen(false)}
        onSave={async (target) => {
          if (target.type !== "page") {
            throw new Error("Page links only");
          }

          if (links.includes(target.pageId)) {
            showInfo("This page is already linked");
            return;
          }

          await updatePageLinks(panelPageId, [...links, target.pageId]);
        }}
      />
    </div>
  );
}
