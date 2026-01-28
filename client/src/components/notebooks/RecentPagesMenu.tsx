import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useRecentPagesStore } from "../../stores/recent-pages-store";

export function RecentPagesMenu() {
  const navigate = useNavigate();
  const { recentPages, removeRecentPage, clearRecentPages } = useRecentPagesStore();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  if (recentPages.length === 0) return null;

  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded border border-gray-300 px-4 py-2 text-sm text-gray-800 hover:bg-gray-100"
        aria-expanded={open}
        aria-haspopup="menu"
        data-testid="recent-pages-button"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="8" cy="8" r="6" />
          <path d="M8 5v3l2 2" />
        </svg>
        Recent
        <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
          {recentPages.length}
        </span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-1 w-80 rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
          role="menu"
          data-testid="recent-pages-menu"
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
            <span className="text-xs font-medium text-gray-500">Recent Pages</span>
            <button
              onClick={() => {
                clearRecentPages();
                setOpen(false);
              }}
              className="text-xs text-gray-400 hover:text-gray-600"
              data-testid="clear-recent-pages"
            >
              Clear all
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {recentPages.map((page) => (
              <div
                key={page.pageId}
                className="group flex items-center gap-3 px-3 py-2 hover:bg-gray-50"
                role="menuitem"
              >
                <button
                  onClick={() => {
                    navigate(`/notebook/${page.notebookId}/page/${page.pageId}`);
                    setOpen(false);
                  }}
                  className="flex flex-1 items-center gap-3 text-left"
                  data-testid="recent-page-item"
                >
                  <div className="flex h-10 w-8 shrink-0 items-center justify-center overflow-hidden rounded bg-gray-100">
                    <img
                      src={page.thumbnailUrl}
                      alt=""
                      className="h-full w-full object-contain"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {page.notebookTitle}
                    </p>
                    <p className="text-xs text-gray-500">
                      Page {page.pageNumber} · {formatTime(page.visitedAt)}
                    </p>
                  </div>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeRecentPage(page.pageId);
                  }}
                  className="rounded p-1 text-gray-300 opacity-0 hover:text-gray-500 group-hover:opacity-100"
                  aria-label="Remove from recent"
                  data-testid="remove-recent-page"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  >
                    <path d="M3 3l8 8M11 3l-8 8" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
