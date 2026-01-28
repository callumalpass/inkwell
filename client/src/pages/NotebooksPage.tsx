import { useEffect, useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { NotebookList } from "../components/notebooks/NotebookList";
import { CreateNotebookDialog } from "../components/notebooks/CreateNotebookDialog";
import { ExportDialog } from "../components/export/ExportDialog";
import { SettingsPanel } from "../components/settings/SettingsPanel";
import { SearchView } from "../components/search/SearchView";
import { useNotebookStore } from "../stores/notebook-store";
import type { NotebookMeta } from "../api/notebooks";

export function NotebooksPage() {
  const { notebooks, loading, fetchNotebooks, createNotebook, deleteNotebook } =
    useNotebookStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [exportNotebook, setExportNotebook] = useState<NotebookMeta | null>(null);

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
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Notebooks</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setSearchOpen(true)}
            className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-800 hover:bg-gray-100"
            data-testid="search-button"
          >
            Search
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
      ) : (
        <NotebookList
          notebooks={notebooks}
          onDelete={deleteNotebook}
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
