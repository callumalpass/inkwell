import type { SearchResult } from "../../api/search";

interface SearchResultCardProps {
  result: SearchResult;
  query: string;
  selected?: boolean;
  onClick: () => void;
  onMouseEnter?: () => void;
}

/**
 * Highlight matching query text within the excerpt.
 * Splits on the query (case-insensitive) and wraps matches in <mark>.
 */
function HighlightedExcerpt({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;

  const regex = new RegExp(
    `(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
    "gi",
  );
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-yellow-200 text-gray-900">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

export function SearchResultCard({
  result,
  query,
  selected = false,
  onClick,
  onMouseEnter,
}: SearchResultCardProps) {
  return (
    <div
      className={`group cursor-pointer rounded-lg border bg-white p-4 transition-colors ${
        selected
          ? "border-blue-500 ring-1 ring-blue-500"
          : "border-gray-200 hover:border-gray-400"
      }`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      data-testid="search-result"
      data-selected={selected}
    >
      <div className="flex gap-4">
        {/* Thumbnail */}
        <div className="flex h-20 w-16 shrink-0 items-center justify-center overflow-hidden rounded bg-gray-50">
          <img
            src={result.thumbnailUrl}
            alt=""
            className="h-full w-full object-contain"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-medium text-gray-500">
              {result.notebookName}
            </span>
            <span className="shrink-0 text-xs text-gray-400">
              {new Date(result.modified).toLocaleDateString()}
            </span>
          </div>
          <p
            className="mt-1 text-sm leading-relaxed text-gray-700"
            data-testid="search-excerpt"
          >
            <HighlightedExcerpt text={result.excerpt} query={query} />
          </p>
        </div>
      </div>
    </div>
  );
}
