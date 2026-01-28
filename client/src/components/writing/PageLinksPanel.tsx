import { useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLinksPanelStore } from "../../stores/links-panel-store";
import { useNotebookPagesStore } from "../../stores/notebook-pages-store";

export function PageLinksPanel() {
  const panelOpen = useLinksPanelStore((s) => s.panelOpen);
  const panelPageId = useLinksPanelStore((s) => s.panelPageId);
  const closePanel = useLinksPanelStore((s) => s.closePanel);

  const pages = useNotebookPagesStore((s) => s.pages);
  const updatePageLinks = useNotebookPagesStore((s) => s.updatePageLinks);
  const notebookId = useNotebookPagesStore((s) => s.notebookId);
  const setCurrentPageIndex = useNotebookPagesStore(
    (s) => s.setCurrentPageIndex,
  );

  const navigate = useNavigate();
  const params = useParams<{ notebookId: string }>();

  const [addMenuOpen, setAddMenuOpen] = useState(false);

  const currentPage = useMemo(
    () => pages.find((p) => p.id === panelPageId),
    [pages, panelPageId],
  );

  const links = currentPage?.links ?? [];

  // Pages that this page links to
  const linkedPages = useMemo(
    () =>
      links
        .map((linkId) => pages.find((p) => p.id === linkId))
        .filter(Boolean) as typeof pages,
    [links, pages],
  );

  // Pages that link to this page (backlinks)
  const backlinks = useMemo(
    () =>
      panelPageId
        ? pages.filter(
            (p) => p.id !== panelPageId && p.links?.includes(panelPageId),
          )
        : [],
    [pages, panelPageId],
  );

  // Pages available to link (not already linked, not self)
  const availablePages = useMemo(
    () =>
      pages.filter((p) => p.id !== panelPageId && !links.includes(p.id)),
    [pages, panelPageId, links],
  );

  if (!panelOpen || !panelPageId) return null;

  const handleRemoveLink = async (linkId: string) => {
    const newLinks = links.filter((id) => id !== linkId);
    await updatePageLinks(panelPageId, newLinks);
  };

  const handleAddLink = async (targetPageId: string) => {
    const newLinks = [...links, targetPageId];
    await updatePageLinks(panelPageId, newLinks);
    setAddMenuOpen(false);
  };

  const navigateToPage = (pageId: string) => {
    const nbId = params.notebookId ?? notebookId;
    if (!nbId) return;
    const pageIndex = pages.findIndex((p) => p.id === pageId);
    if (pageIndex >= 0) {
      setCurrentPageIndex(pageIndex);
    }
    navigate(`/notebook/${nbId}/page/${pageId}`, { replace: true });
  };

  const pageLabel = (page: { id: string; pageNumber: number }) =>
    `Page ${page.pageNumber}`;

  return (
    <div
      className="fixed inset-y-0 right-0 z-50 flex w-80 flex-col border-l border-gray-200 bg-white shadow-lg"
      data-testid="links-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h2 className="text-sm font-medium text-gray-900">Page Links</h2>
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
        {/* Outgoing links */}
        <div className="border-b border-gray-100 px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Links ({linkedPages.length})
            </h3>
            <div className="relative">
              <button
                onClick={() => setAddMenuOpen(!addMenuOpen)}
                className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
                data-testid="add-link-button"
                disabled={availablePages.length === 0}
              >
                + Add
              </button>
              {addMenuOpen && availablePages.length > 0 && (
                <div
                  className="absolute right-0 top-full z-10 mt-1 max-h-48 w-48 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg"
                  data-testid="add-link-menu"
                >
                  {availablePages.map((page) => (
                    <button
                      key={page.id}
                      onClick={() => handleAddLink(page.id)}
                      className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                      data-testid={`add-link-option-${page.id}`}
                    >
                      {pageLabel(page)}
                      <span className="ml-1 text-xs text-gray-400">
                        {page.id}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {linkedPages.length === 0 ? (
            <p className="text-sm text-gray-400">
              No links yet. Link to other pages in this notebook.
            </p>
          ) : (
            <ul className="space-y-1" data-testid="links-list">
              {linkedPages.map((page) => (
                <li
                  key={page.id}
                  className="flex items-center justify-between rounded px-2 py-1.5 hover:bg-gray-50"
                >
                  <button
                    onClick={() => navigateToPage(page.id)}
                    className="text-sm text-gray-800 hover:text-black"
                    data-testid={`link-navigate-${page.id}`}
                  >
                    {pageLabel(page)}
                  </button>
                  <button
                    onClick={() => handleRemoveLink(page.id)}
                    className="rounded p-0.5 text-gray-300 hover:bg-gray-100 hover:text-gray-600"
                    aria-label={`Remove link to ${pageLabel(page)}`}
                    data-testid={`remove-link-${page.id}`}
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
    </div>
  );
}
