import { useBulkOperationStore } from "../../stores/bulk-operation-store";

const OPERATION_ICONS: Record<string, JSX.Element> = {
  transcribe: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12h10M3 8h7M3 4h10" />
    </svg>
  ),
  export: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 10V2M5 5l3-3 3 3M3 14h10" />
    </svg>
  ),
  delete: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 4h10M6 4V2h4v2M5 4v9h6V4" />
    </svg>
  ),
  move: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 8h12M10 4l4 4-4 4" />
    </svg>
  ),
  duplicate: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="5" y="5" width="8" height="8" rx="1" />
      <path d="M3 11V4a1 1 0 0 1 1-1h7" />
    </svg>
  ),
  tags: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 3v4l7 7 4-4-7-7H2z" />
      <circle cx="5" cy="5" r="1" />
    </svg>
  ),
};

export function BulkProgressIndicator() {
  const operation = useBulkOperationStore((s) => s.operation);
  const cancelOperation = useBulkOperationStore((s) => s.cancelOperation);

  if (!operation) return null;

  const progress = operation.total > 0
    ? Math.round((operation.completed / operation.total) * 100)
    : 0;
  const icon = OPERATION_ICONS[operation.type] || OPERATION_ICONS.export;

  return (
    <div
      className="fixed bottom-4 left-1/2 z-[90] flex -translate-x-1/2 items-center gap-3 rounded-lg border-2 border-blue-500 bg-white px-4 py-3 shadow-lg"
      role="status"
      aria-live="polite"
      data-testid="bulk-progress-indicator"
    >
      {/* Icon with spinner animation */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
        <div className="animate-spin-slow">
          {icon}
        </div>
      </div>

      {/* Progress info */}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900">
            {operation.label}
          </span>
          <span className="text-xs text-gray-500">
            {operation.completed} / {operation.total}
          </span>
        </div>

        {/* Progress bar */}
        <div className="mt-1.5 h-1.5 w-48 overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Failed count if any */}
        {operation.failed > 0 && (
          <p className="mt-1 text-xs text-red-600">
            {operation.failed} failed
          </p>
        )}
      </div>

      {/* Cancel button */}
      <button
        onClick={cancelOperation}
        className="ml-2 shrink-0 rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        aria-label="Cancel operation"
        data-testid="bulk-progress-cancel"
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
  );
}
