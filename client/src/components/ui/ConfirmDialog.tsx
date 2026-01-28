import { useEffect, useRef } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}

const BTN = "rounded-md px-4 py-2 text-sm font-medium";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      cancelRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  const confirmStyles =
    variant === "danger"
      ? "bg-red-600 text-white hover:bg-red-700"
      : "bg-black text-white hover:bg-gray-800";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      data-testid="confirm-dialog-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        data-testid="confirm-dialog"
      >
        <h2
          id="confirm-dialog-title"
          className="text-lg font-semibold text-gray-900"
        >
          {title}
        </h2>
        <p
          id="confirm-dialog-description"
          className="mt-2 text-sm text-gray-600"
        >
          {message}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className={`${BTN} border border-gray-300 bg-white text-gray-800 hover:bg-gray-50`}
            data-testid="confirm-dialog-cancel"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`${BTN} ${confirmStyles}`}
            data-testid="confirm-dialog-confirm"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
