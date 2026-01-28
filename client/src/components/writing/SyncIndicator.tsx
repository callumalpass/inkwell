import { useSyncStore } from "../../stores/sync-store";

export function SyncIndicator() {
  const isSyncing = useSyncStore((s) => s.isSyncing);

  if (!isSyncing) return null;

  return (
    <div
      className="flex items-center gap-1.5 text-xs text-gray-500"
      data-testid="sync-indicator"
      title="Saving strokes..."
    >
      <svg
        className="h-3.5 w-3.5 animate-spin"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          cx="8"
          cy="8"
          r="6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="28"
          strokeDashoffset="8"
        />
      </svg>
      <span className="hidden sm:inline">Saving...</span>
    </div>
  );
}
