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

const MATCH_TYPE_STYLES = {
  transcription: "bg-blue-100 text-blue-700",
  tag: "bg-green-100 text-green-700",
  notebook: "bg-purple-100 text-purple-700",
} as const;

const MATCH_TYPE_LABELS = {
  transcription: "Content",
  tag: "Tag",
  notebook: "Notebook",
} as const;

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
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500">
                {result.notebookName}
              </span>
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${MATCH_TYPE_STYLES[result.matchType]}`}
                data-testid="match-type-badge"
              >
                {MATCH_TYPE_LABELS[result.matchType]}
              </span>
            </div>
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
          {result.tags && result.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1" data-testid="result-tags">
              {result.tags.slice(0, 5).map((tag) => (
                <span
                  key={tag}
                  className={`rounded px-1.5 py-0.5 text-[10px] ${
                    tag.toLowerCase().includes(query.toLowerCase())
                      ? "bg-yellow-100 text-yellow-800 font-medium"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  #{tag}
                </span>
              ))}
              {result.tags.length > 5 && (
                <span className="text-[10px] text-gray-400">
                  +{result.tags.length - 5} more
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
