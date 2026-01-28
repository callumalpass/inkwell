import { useEffect, useState } from "react";
import { listNotebooks } from "../../../api/notebooks";
import type { NotebookMeta } from "../../../api/notebooks";
import { BTN, BTN_ACTIVE, BTN_INACTIVE, BTN_DISABLED } from "./styles";

export interface MoveDialogProps {
  open: boolean;
  currentNotebookId: string;
  onClose: () => void;
  onMove: (targetNotebookId: string) => void;
}

export function MoveDialog({
  open,
  currentNotebookId,
  onClose,
  onMove,
}: MoveDialogProps) {
  const [notebooks, setNotebooks] = useState<NotebookMeta[]>([]);
  const [targetId, setTargetId] = useState("");

  useEffect(() => {
    if (!open) return;
    listNotebooks()
      .then((data) => {
        setNotebooks(data.filter((nb) => nb.id !== currentNotebookId));
      })
      .catch(() => {
        setNotebooks([]);
      });
  }, [open, currentNotebookId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg">
        <h2 className="text-lg font-semibold">Move pages</h2>
        <label className="mt-3 block text-xs font-medium text-gray-500">
          Target notebook
        </label>
        <select
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
        >
          <option value="">Select notebook...</option>
          {notebooks.map((nb) => (
            <option key={nb.id} value={nb.id}>
              {nb.title || nb.id}
            </option>
          ))}
        </select>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className={`${BTN} ${BTN_INACTIVE}`}>
            Cancel
          </button>
          <button
            onClick={() => onMove(targetId)}
            className={`${BTN} ${targetId ? BTN_ACTIVE : `${BTN_INACTIVE} ${BTN_DISABLED}`}`}
            disabled={!targetId}
          >
            Move
          </button>
        </div>
      </div>
    </div>
  );
}
