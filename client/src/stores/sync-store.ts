import { create } from "zustand";

type WebSocketStatus = "connected" | "disconnected" | "reconnecting";

interface SyncStore {
  /** Number of saves currently in flight */
  pendingSaves: number;
  /** Whether we're currently syncing (pendingSaves > 0) */
  isSyncing: boolean;
  /** WebSocket connection status */
  wsStatus: WebSocketStatus;
  /** Number of active WebSocket connections */
  wsConnections: number;
  /** Number of WebSocket connections attempting to reconnect */
  wsReconnecting: number;

  /** Increment pending save count */
  startSave: () => void;
  /** Decrement pending save count */
  endSave: () => void;
  /** Update WebSocket status */
  setWsConnected: (connected: boolean) => void;
  /** Track a WebSocket starting to reconnect */
  startWsReconnect: () => void;
  /** Track a WebSocket finishing reconnection */
  endWsReconnect: () => void;
}

export const useSyncStore = create<SyncStore>((set) => ({
  pendingSaves: 0,
  isSyncing: false,
  wsStatus: "disconnected",
  wsConnections: 0,
  wsReconnecting: 0,

  startSave: () =>
    set((state) => ({
      pendingSaves: state.pendingSaves + 1,
      isSyncing: true,
    })),

  endSave: () =>
    set((state) => {
      const next = Math.max(0, state.pendingSaves - 1);
      return {
        pendingSaves: next,
        isSyncing: next > 0,
      };
    }),

  setWsConnected: (connected) =>
    set((state) => {
      const nextConnections = connected
        ? state.wsConnections + 1
        : Math.max(0, state.wsConnections - 1);

      let wsStatus: WebSocketStatus;
      if (nextConnections > 0) {
        wsStatus = "connected";
      } else if (state.wsReconnecting > 0) {
        wsStatus = "reconnecting";
      } else {
        wsStatus = "disconnected";
      }

      return {
        wsConnections: nextConnections,
        wsStatus,
      };
    }),

  startWsReconnect: () =>
    set((state) => ({
      wsReconnecting: state.wsReconnecting + 1,
      wsStatus: state.wsConnections === 0 ? "reconnecting" : state.wsStatus,
    })),

  endWsReconnect: () =>
    set((state) => ({
      wsReconnecting: Math.max(0, state.wsReconnecting - 1),
    })),
}));
