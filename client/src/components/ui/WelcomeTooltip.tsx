import { useState, useEffect } from "react";

const STORAGE_KEY = "inkwell-welcome-dismissed";

interface WelcomeTooltipProps {
  show?: boolean;
}

/**
 * A welcome tooltip that appears for first-time users.
 * Shows helpful tips about keyboard shortcuts and gestures.
 * Dismisses permanently when closed.
 */
export function WelcomeTooltip({ show }: WelcomeTooltipProps) {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Check localStorage after mount to avoid SSR issues
    setMounted(true);
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (!dismissed) {
      // Small delay to let the UI settle before showing
      const timer = setTimeout(() => setVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, "true");
  };

  // Allow external control to force show (e.g., from help menu)
  useEffect(() => {
    if (show) setVisible(true);
  }, [show]);

  if (!mounted || !visible) return null;

  return (
    <div
      className="fixed bottom-20 left-1/2 z-[80] -translate-x-1/2"
      role="dialog"
      aria-labelledby="welcome-title"
      data-testid="welcome-tooltip"
    >
      <div className="w-80 rounded-lg border border-blue-200 bg-blue-50 p-4 shadow-lg">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100">
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-blue-600"
              >
                <circle cx="8" cy="8" r="6" />
                <path d="M8 5v4M8 11v.01" />
              </svg>
            </div>
            <h3 id="welcome-title" className="text-sm font-semibold text-blue-900">
              Quick Tips
            </h3>
          </div>
          <button
            onClick={handleDismiss}
            className="rounded p-1 text-blue-400 hover:bg-blue-100 hover:text-blue-600"
            aria-label="Dismiss"
            data-testid="welcome-dismiss"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M3 3l8 8M11 3l-8 8" />
            </svg>
          </button>
        </div>

        <ul className="mt-3 space-y-2 text-xs text-blue-800">
          <li className="flex items-start gap-2">
            <kbd className="shrink-0 rounded border border-blue-300 bg-white px-1.5 py-0.5 text-[10px] font-medium">
              ?
            </kbd>
            <span>Show all keyboard shortcuts</span>
          </li>
          <li className="flex items-start gap-2">
            <kbd className="shrink-0 rounded border border-blue-300 bg-white px-1.5 py-0.5 text-[10px] font-medium">
              1 2 3
            </kbd>
            <span>Switch between views (single, canvas, overview)</span>
          </li>
          <li className="flex items-start gap-2">
            <kbd className="shrink-0 rounded border border-blue-300 bg-white px-1.5 py-0.5 text-[10px] font-medium">
              Cmd+K
            </kbd>
            <span>Search your notes</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="shrink-0 rounded border border-blue-300 bg-white px-1.5 py-0.5 text-[10px] font-medium">
              2 fingers
            </span>
            <span>Tap to undo, double-tap to reset zoom</span>
          </li>
        </ul>

        <button
          onClick={handleDismiss}
          className="mt-3 w-full rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

/**
 * Reset the welcome tooltip so it shows again.
 * Useful for testing or if user wants to see it again.
 */
export function resetWelcomeTooltip(): void {
  localStorage.removeItem(STORAGE_KEY);
}
