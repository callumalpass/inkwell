import { useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useSearchStore } from "../../stores/search-store";
import { SearchResultCard } from "./SearchResultCard";

interface SearchViewProps {
  open: boolean;
  onClose: () => void;
}

export function SearchView({ open, onClose }: SearchViewProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const { query, results, total, loading, error, searched, setQuery, search, clear } =
    useSearchStore();

  // Focus the input when the dialog opens
  useEffect(() => {
    if (open) {
      // Small delay to ensure the element is rendered
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Clear search state when dialog closes
  useEffect(() => {
    if (!open) clear();
  }, [open, clear]);

  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, handleKeyDown]);

  const handleInputChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      search(value);
    }, 300);
  };

  const handleResultClick = (result: { notebookId: string; pageId: string }) => {
    onClose();
    navigate(`/notebook/${result.notebookId}/page/${result.pageId}`);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[10vh]"
      data-testid="search-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex w-full max-w-2xl flex-col rounded-lg bg-white shadow-lg"
        style={{ maxHeight: "70vh" }}
        data-testid="search-dialog"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3">
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 text-gray-400"
          >
            <circle cx="8.5" cy="8.5" r="5.5" />
            <path d="M13 13l4 4" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="Search transcriptions..."
            className="flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
            data-testid="search-input"
          />
          {query && (
            <button
              onClick={() => {
                setQuery("");
                search("");
                inputRef.current?.focus();
              }}
              className="rounded p-1 text-gray-400 hover:text-gray-600"
              aria-label="Clear search"
              data-testid="search-clear"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          )}
        </div>

        {/* Results area */}
        <div className="overflow-y-auto px-4 py-3">
          {loading && (
            <p className="py-8 text-center text-sm text-gray-500" data-testid="search-loading">
              Searching...
            </p>
          )}

          {error && (
            <p className="py-8 text-center text-sm text-red-500" data-testid="search-error">
              {error}
            </p>
          )}

          {!loading && !error && searched && results.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-500" data-testid="search-empty">
              No results found for &ldquo;{query}&rdquo;
            </p>
          )}

          {!loading && !error && results.length > 0 && (
            <>
              <p className="mb-3 text-xs text-gray-500" data-testid="search-count">
                {total} {total === 1 ? "result" : "results"}
              </p>
              <div className="space-y-2">
                {results.map((result) => (
                  <SearchResultCard
                    key={result.pageId}
                    result={result}
                    query={query}
                    onClick={() => handleResultClick(result)}
                  />
                ))}
              </div>
            </>
          )}

          {!loading && !error && !searched && (
            <p className="py-8 text-center text-sm text-gray-400" data-testid="search-hint">
              Search across all your transcribed notes
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
