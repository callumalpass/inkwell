import { useMemo } from "react";
import { useMultiPageWebSocket } from "./useMultiPageWebSocket";

export function useWebSocket(pageId: string | undefined) {
  const pageIds = useMemo(
    () => (pageId ? [pageId] : []),
    [pageId],
  );
  useMultiPageWebSocket(pageIds);
}
