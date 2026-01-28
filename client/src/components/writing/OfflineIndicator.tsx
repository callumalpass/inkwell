import { useEffect, useState } from "react";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";
import { pendingCount } from "../../lib/offline-queue";

export function OfflineIndicator() {
  const online = useNetworkStatus();
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

  if (online && queued === 0) return null;

  return (
    <div
      className="flex items-center gap-1.5 rounded px-2 py-1 text-xs"
      data-testid="offline-indicator"
    >
      <span
        className={`inline-block h-2 w-2 rounded-full ${
          online ? "bg-yellow-500" : "bg-red-500"
        }`}
      />
      {!online && <span className="text-red-700">Offline</span>}
      {online && queued > 0 && (
        <span className="text-yellow-700">
          Syncing {queued} {queued === 1 ? "batch" : "batches"}...
        </span>
      )}
    </div>
  );
}
