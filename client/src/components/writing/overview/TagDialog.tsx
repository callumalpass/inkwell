import { BTN, BTN_ACTIVE, BTN_INACTIVE } from "./styles";

export interface TagDialogProps {
  mode: "add" | "remove";
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onApply: () => void;
}

export function TagDialog({
  mode,
  value,
  onChange,
  onClose,
  onApply,
}: TagDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg">
        <h2 className="text-lg font-semibold">
          {mode === "add" ? "Add Tags" : "Remove Tags"}
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          Enter tags separated by spaces or commas.
        </p>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="meeting, project-x"
          className="mt-3 w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className={`${BTN} ${BTN_INACTIVE}`}>
            Cancel
          </button>
          <button onClick={onApply} className={`${BTN} ${BTN_ACTIVE}`}>
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
