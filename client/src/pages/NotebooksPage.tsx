import { useEffect, useState, useMemo } from "react";
import { AppShell } from "../components/layout/AppShell";
import { NotebookList } from "../components/notebooks/NotebookList";
import { CreateNotebookDialog } from "../components/notebooks/CreateNotebookDialog";
import { RecentPagesMenu } from "../components/notebooks/RecentPagesMenu";
import { ExportDialog } from "../components/export/ExportDialog";
import { SettingsPanel } from "../components/settings/SettingsPanel";
import { SearchView } from "../components/search/SearchView";
import { useNotebookStore } from "../stores/notebook-store";
import type { NotebookMeta } from "../api/notebooks";

type SortField = "name" | "modified" | "pageCount";
type SortOrder = "asc" | "desc";
type TagMatchMode = "any" | "all";

const SORT_OPTIONS: { field: SortField; label: string; defaultOrder: SortOrder }[] = [
  { field: "modified", label: "Last Modified", defaultOrder: "desc" },
  { field: "name", label: "Name", defaultOrder: "asc" },
  { field: "pageCount", label: "Page Count", defaultOrder: "desc" },
];

export function NotebooksPage() {
  const {
    notebooks,
    loading,
    fetchNotebooks,
    createNotebook,
    renameNotebook,
    updateNotebookTags,
    duplicateNotebook,
    deleteNotebook,
  } =
    useNotebookStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [exportNotebook, setExportNotebook] = useState<NotebookMeta | null>(null);
  const [sortField, setSortField] = useState<SortField>("modified");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [filterQuery, setFilterQuery] = useState("");
  const [includedTags, setIncludedTags] = useState<string[]>([]);
  const [excludedTags, setExcludedTags] = useState<string[]>([]);
  const [tagMatchMode, setTagMatchMode] = useState<TagMatchMode>("any");

  const allTags = useMemo(() => {
    const byKey = new Map<string, { label: string; count: number }>();
    for (const notebook of notebooks) {
      for (const tag of notebook.tags ?? []) {
        const trimmed = tag.trim();
        if (!trimmed) continue;
        const key = trimmed.toLowerCase();
        const existing = byKey.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          byKey.set(key, { label: trimmed, count: 1 });
        }
      }
    }
    return Array.from(byKey.entries())
      .map(([key, value]) => ({
        key,
        label: value.label,
        count: value.count,
        testIdKey: key.replace(/[^a-z0-9_-]/g, "-"),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
  }, [notebooks]);

  const hasTagFilters = includedTags.length > 0 || excludedTags.length > 0;
  const hasActiveFilters = Boolean(filterQuery.trim()) || hasTagFilters;
  const noResultsMessage = filterQuery.trim() && !hasTagFilters
    ? `No notebooks match "${filterQuery}"`
    : "No notebooks match current filters";

  const filteredAndSortedNotebooks = useMemo(() => {
    const query = filterQuery.trim().toLowerCase();
    const filtered = notebooks.filter((nb) => {
      if (query && !nb.title.toLowerCase().includes(query)) return false;

      const tagSet = new Set((nb.tags ?? []).map((tag) => tag.toLowerCase()));
      if (excludedTags.some((tag) => tagSet.has(tag))) return false;

      if (includedTags.length > 0) {
        if (tagMatchMode === "all") {
          if (!includedTags.every((tag) => tagSet.has(tag))) return false;
        } else if (!includedTags.some((tag) => tagSet.has(tag))) {
          return false;
        }
      }

      return true;
    });

    return [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "name":
          comparison = a.title.localeCompare(b.title);
          break;
        case "modified":
          comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
        case "pageCount":
          comparison = (a.pageCount ?? 0) - (b.pageCount ?? 0);
          break;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });
  }, [notebooks, sortField, sortOrder, filterQuery, includedTags, excludedTags, tagMatchMode]);

  const handleSortChange = (field: SortField) => {
    if (field === sortField) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      const option = SORT_OPTIONS.find((o) => o.field === field);
      setSortField(field);
      setSortOrder(option?.defaultOrder ?? "desc");
    }
  };

  const cycleTagFilterState = (tagKey: string) => {
    const isIncluded = includedTags.includes(tagKey);
    const isExcluded = excludedTags.includes(tagKey);

    if (!isIncluded && !isExcluded) {
      setIncludedTags((prev) => [...prev, tagKey]);
      return;
    }

    if (isIncluded) {
      setIncludedTags((prev) => prev.filter((tag) => tag !== tagKey));
      setExcludedTags((prev) => [...prev, tagKey]);
      return;
    }

    setExcludedTags((prev) => prev.filter((tag) => tag !== tagKey));
  };

  const tagStateFor = (tagKey: string): "off" | "include" | "exclude" => {
    if (includedTags.includes(tagKey)) return "include";
    if (excludedTags.includes(tagKey)) return "exclude";
    return "off";
  };

  useEffect(() => {
    fetchNotebooks();
  }, [fetchNotebooks]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold">Notebooks</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filter notebooks..."
              className="w-40 rounded border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-gray-400 focus:outline-none sm:w-48"
              data-testid="notebook-filter"
            />
            {filterQuery && (
              <button
                onClick={() => setFilterQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label="Clear filter"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <div
            className="flex items-center gap-1 rounded border border-gray-200 bg-gray-50 p-1"
            data-testid="sort-controls"
          >
            <span className="px-2 text-xs text-gray-500">Sort:</span>
            {SORT_OPTIONS.map((option) => (
              <button
                key={option.field}
                onClick={() => handleSortChange(option.field)}
                className={`flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${
                  sortField === option.field
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
                data-testid={`sort-${option.field}`}
                aria-pressed={sortField === option.field}
              >
                {option.label}
                {sortField === option.field && (
                  <span className="text-gray-400" aria-label={sortOrder === "asc" ? "ascending" : "descending"}>
                    {sortOrder === "asc" ? "↑" : "↓"}
                  </span>
                )}
              </button>
            ))}
          </div>
          <RecentPagesMenu />
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 rounded border border-gray-300 px-4 py-2 text-sm text-gray-800 hover:bg-gray-100"
            data-testid="search-button"
            title="Search (⌘K)"
          >
            <span>Search</span>
            <kbd className="hidden rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500 sm:inline">⌘K</kbd>
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-800 hover:bg-gray-100"
          >
            Settings
          </button>
          <button
            onClick={() => setDialogOpen(true)}
            className="rounded bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800"
          >
            New Notebook
          </button>
        </div>
      </div>
      {allTags.length > 0 && (
        <div
          className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3"
          data-testid="tag-filter-controls"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Tag filters</span>
            <button
              onClick={() => setTagMatchMode("any")}
              className={`rounded px-2 py-1 text-xs ${
                tagMatchMode === "any"
                  ? "bg-gray-900 text-white"
                  : "border border-gray-300 text-gray-600 hover:bg-gray-100"
              }`}
              data-testid="tag-match-any"
            >
              Match any
            </button>
            <button
              onClick={() => setTagMatchMode("all")}
              className={`rounded px-2 py-1 text-xs ${
                tagMatchMode === "all"
                  ? "bg-gray-900 text-white"
                  : "border border-gray-300 text-gray-600 hover:bg-gray-100"
              }`}
              data-testid="tag-match-all"
            >
              Match all
            </button>
            {hasTagFilters && (
              <button
                onClick={() => {
                  setIncludedTags([]);
                  setExcludedTags([]);
                }}
                className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
                data-testid="clear-tag-filters"
              >
                Clear tags
              </button>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {allTags.map((tag) => {
              const state = tagStateFor(tag.key);
              const style =
                state === "include"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                  : state === "exclude"
                    ? "border-rose-300 bg-rose-50 text-rose-800"
                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-100";

              return (
                <button
                  key={tag.key}
                  onClick={() => cycleTagFilterState(tag.key)}
                  className={`rounded-full border px-2 py-1 text-xs ${style}`}
                  data-testid={`tag-filter-chip-${tag.testIdKey}`}
                  data-state={state}
                  aria-label={`${tag.label} (${state})`}
                >
                  {tag.label}
                  <span className="ml-1 text-[10px] opacity-70">{tag.count}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Click a tag to include it, click again to exclude it, click a third time to clear.
          </p>
        </div>
      )}
      {loading ? (
        <p className="text-center text-gray-500">Loading...</p>
      ) : filteredAndSortedNotebooks.length === 0 && hasActiveFilters ? (
        <p className="text-center text-gray-500" data-testid="no-filter-results">
          {noResultsMessage}
        </p>
      ) : (
        <NotebookList
          notebooks={filteredAndSortedNotebooks}
          onDelete={deleteNotebook}
          onDuplicate={duplicateNotebook}
          onRename={renameNotebook}
          onUpdateTags={updateNotebookTags}
          onExport={(nb) => setExportNotebook(nb)}
        />
      )}
      <CreateNotebookDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreate={createNotebook}
      />
      <ExportDialog
        open={!!exportNotebook}
        onClose={() => setExportNotebook(null)}
        notebookId={exportNotebook?.id}
        notebookTitle={exportNotebook?.title}
      />
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
      <SearchView
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
      />
    </AppShell>
  );
}
