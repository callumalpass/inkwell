import { useToastStore, type ToastType } from "../../stores/toast-store";

const ICONS: Record<ToastType, JSX.Element> = {
  success: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="10" cy="10" r="8" />
      <path d="M7 10l2 2 4-4" />
    </svg>
  ),
  error: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="10" cy="10" r="8" />
      <path d="M10 6v5M10 14v.01" />
    </svg>
  ),
  info: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="10" cy="10" r="8" />
      <path d="M10 9v5M10 6v.01" />
    </svg>
  ),
};

const STYLES: Record<ToastType, string> = {
  success: "border-green-600 text-green-800 bg-green-50",
  error: "border-red-600 text-red-800 bg-red-50",
  info: "border-gray-600 text-gray-800 bg-gray-50",
};

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 flex-col gap-2"
      role="region"
      aria-label="Notifications"
      data-testid="toaster"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-center gap-2 rounded-lg border-2 px-4 py-3 shadow-md ${STYLES[toast.type]}`}
          role="alert"
          data-testid={`toast-${toast.type}`}
        >
          <span className="shrink-0">{ICONS[toast.type]}</span>
          <span className="text-sm font-medium">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="ml-2 shrink-0 rounded p-1 hover:bg-black/5"
            aria-label="Dismiss"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
