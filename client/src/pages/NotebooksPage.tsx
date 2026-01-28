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

const SORT_OPTIONS: { field: SortField; label: string; defaultOrder: SortOrder }[] = [
  { field: "modified", label: "Last Modified", defaultOrder: "desc" },
  { field: "name", label: "Name", defaultOrder: "asc" },
  { field: "pageCount", label: "Page Count", defaultOrder: "desc" },
];

export function NotebooksPage() {
  const { notebooks, loading, fetchNotebooks, createNotebook, renameNotebook, duplicateNotebook, deleteNotebook } =
    useNotebookStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [exportNotebook, setExportNotebook] = useState<NotebookMeta | null>(null);
  const [sortField, setSortField] = useState<SortField>("modified");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [filterQuery, setFilterQuery] = useState("");

  const filteredAndSortedNotebooks = useMemo(() => {
    // First filter by name
    const filtered = filterQuery.trim()
      ? notebooks.filter((nb) =>
          nb.title.toLowerCase().includes(filterQuery.toLowerCase())
        )
      : notebooks;

    // Then sort
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
  }, [notebooks, sortField, sortOrder, filterQuery]);

  const handleSortChange = (field: SortField) => {
    if (field === sortField) {
      // Toggle order if same field
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      // Use default order for new field
      const option = SORT_OPTIONS.find((o) => o.field === field);
      setSortField(field);
      setSortOrder(option?.defaultOrder ?? "desc");
    }
  };

  useEffect(() => {
    fetchNotebooks();
  }, [fetchNotebooks]);

  // Global keyboard shortcut: Ctrl+K or Cmd+K to open search
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
          {/* Filter input */}
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
          {/* Sort controls */}
          <div className="flex items-center gap-1 rounded border border-gray-200 bg-gray-50 p-1" data-testid="sort-controls">
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
      {loading ? (
        <p className="text-center text-gray-500">Loading...</p>
      ) : filteredAndSortedNotebooks.length === 0 && filterQuery ? (
        <p className="text-center text-gray-500" data-testid="no-filter-results">
          No notebooks match "{filterQuery}"
        </p>
      ) : (
        <NotebookList
          notebooks={filteredAndSortedNotebooks}
          onDelete={deleteNotebook}
          onDuplicate={duplicateNotebook}
          onRename={renameNotebook}
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
