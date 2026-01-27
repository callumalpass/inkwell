import { useState } from "react";

interface CreateNotebookDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (title: string) => void;
}

export function CreateNotebookDialog({
  open,
  onClose,
  onCreate,
}: CreateNotebookDialogProps) {
  const [title, setTitle] = useState("");

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onCreate(trimmed);
    setTitle("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg">
        <h2 className="text-lg font-semibold">New Notebook</h2>
        <form onSubmit={handleSubmit} className="mt-4">
          <input
            autoFocus
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Notebook title"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-800"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
