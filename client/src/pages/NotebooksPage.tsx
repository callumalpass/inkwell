import { useEffect, useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { NotebookList } from "../components/notebooks/NotebookList";
import { CreateNotebookDialog } from "../components/notebooks/CreateNotebookDialog";
import { SettingsPanel } from "../components/settings/SettingsPanel";
import { useNotebookStore } from "../stores/notebook-store";

export function NotebooksPage() {
  const { notebooks, loading, fetchNotebooks, createNotebook, deleteNotebook } =
    useNotebookStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    fetchNotebooks();
  }, [fetchNotebooks]);

  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Notebooks</h2>
        <div className="flex gap-2">
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
        <NotebookList notebooks={notebooks} onDelete={deleteNotebook} />
      )}
      <CreateNotebookDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreate={createNotebook}
      />
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </AppShell>
  );
}
