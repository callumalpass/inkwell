import { useEffect, useState } from "react";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";
import { useSyncStore } from "../../stores/sync-store";
import { pendingCount } from "../../lib/offline-queue";

export function OfflineIndicator() {
  const online = useNetworkStatus();
  const wsStatus = useSyncStore((s) => s.wsStatus);
  const [queued, setQueued] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const count = await pendingCount();
        if (!cancelled) setQueued(count);
      } catch {
        // IndexedDB may not be available in tests
      }
    }

    poll();
    const id = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [online]);

  // Show indicator if offline, syncing, or WebSocket is reconnecting
  const showWsReconnecting = online && wsStatus === "reconnecting";
  if (online && queued === 0 && !showWsReconnecting) return null;

  return (
    <div
      className="flex items-center gap-1.5 rounded px-2 py-1 text-xs"
      data-testid="offline-indicator"
    >
      <span
        className={`inline-block h-2 w-2 rounded-full ${
          !online
            ? "bg-red-500"
            : showWsReconnecting
            ? "animate-pulse bg-orange-500"
            : "bg-yellow-500"
        }`}
      />
      {!online && <span className="text-red-700">Offline</span>}
      {online && showWsReconnecting && queued === 0 && (
        <span className="text-orange-700">Reconnecting...</span>
      )}
      {online && queued > 0 && (
        <span className="text-yellow-700">
          Syncing {queued} {queued === 1 ? "batch" : "batches"}...
        </span>
      )}
    </div>
  );
}
