import { create } from "zustand";

interface SyncStore {
  /** Number of saves currently in flight */
  pendingSaves: number;
  /** Whether we're currently syncing (pendingSaves > 0) */
  isSyncing: boolean;

  /** Increment pending save count */
  startSave: () => void;
  /** Decrement pending save count */
  endSave: () => void;
}

export const useSyncStore = create<SyncStore>((set) => ({
  pendingSaves: 0,
  isSyncing: false,

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
}));
