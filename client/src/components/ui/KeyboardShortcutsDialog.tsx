import { useEffect } from "react";

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
}

interface ShortcutGroup {
  title: string;
  shortcuts: { keys: string[]; description: string }[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "Global",
    shortcuts: [
      { keys: ["Cmd", "K"], description: "Open search" },
      { keys: ["?"], description: "Show keyboard shortcuts" },
      { keys: ["Esc"], description: "Close dialog / Cancel" },
    ],
  },
  {
    title: "Pages",
    shortcuts: [
      { keys: ["N"], description: "New page" },
      { keys: ["\u2190"], description: "Previous page" },
      { keys: ["\u2192"], description: "Next page" },
    ],
  },
  {
    title: "Drawing",
    shortcuts: [
      { keys: ["Cmd", "Z"], description: "Undo" },
      { keys: ["Cmd", "Shift", "Z"], description: "Redo" },
      { keys: ["2-finger tap"], description: "Undo (touch)" },
      { keys: ["3-finger tap"], description: "Redo (touch)" },
      { keys: ["2-finger double-tap"], description: "Reset zoom to 100%" },
    ],
  },
  {
    title: "Canvas View",
    shortcuts: [
      { keys: ["2-finger drag"], description: "Pan canvas" },
      { keys: ["Pinch"], description: "Zoom in/out" },
      { keys: ["Scroll wheel"], description: "Zoom in/out" },
    ],
  },
];

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[1.5rem] items-center justify-center rounded border border-gray-300 bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-700">
      {children}
    </kbd>
  );
}

export function KeyboardShortcutsDialog({
  open,
  onClose,
}: KeyboardShortcutsDialogProps) {
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      data-testid="shortcuts-dialog-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-lg rounded-lg bg-white p-6 shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-dialog-title"
        data-testid="shortcuts-dialog"
      >
        <div className="flex items-center justify-between">
          <h2
            id="shortcuts-dialog-title"
            className="text-lg font-semibold text-gray-900"
          >
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
            data-testid="shortcuts-dialog-close"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M5 5l10 10M15 5l-10 10" />
            </svg>
          </button>
        </div>

        <div className="mt-4 space-y-5">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                {group.title}
              </h3>
              <div className="space-y-2">
                {group.shortcuts.map((shortcut, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-gray-700">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, j) => (
                        <span key={j} className="flex items-center gap-1">
                          {j > 0 && (
                            <span className="text-xs text-gray-400">+</span>
                          )}
                          <Kbd>{key}</Kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-5 text-xs text-gray-400">
          Tip: On Mac, use Cmd. On Windows/Linux, use Ctrl.
        </p>
      </div>
    </div>
  );
}
