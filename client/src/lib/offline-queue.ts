import type { Stroke } from "../api/strokes";

const DB_NAME = "inkwell-offline";
const DB_VERSION = 1;
const STORE_NAME = "pending-strokes";

/** Max age for stale entries (24 hours). */
const STALE_ENTRY_AGE_MS = 24 * 60 * 60 * 1000;

export interface PendingEntry {
  /** Auto-incremented key */
  id?: number;
  pageId: string;
  strokes: Stroke[];
  createdAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("pageId", "pageId", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Enqueue strokes for later sync. Falls back gracefully on quota errors. */
export async function enqueueStrokes(
  pageId: string,
  strokes: Stroke[],
): Promise<void> {
  let db: IDBDatabase;
  try {
    db = await openDB();
  } catch (err) {
    console.error("Failed to open offline DB:", err);
    return;
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.add({ pageId, strokes, createdAt: Date.now() } as PendingEntry);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      const error = tx.error;
      // QuotaExceededError — storage is full; log but don't crash
      if (error?.name === "QuotaExceededError") {
        console.warn("Offline queue storage quota exceeded; stroke not queued");
        resolve();
        return;
      }
      reject(error);
    };
  });
}

/** Read all pending entries without removing them. */
export async function peekAllPending(): Promise<PendingEntry[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      db.close();
      resolve(req.result);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

/** Remove a single entry by id after successful sync. */
export async function removePendingEntry(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

/** Get count of pending entries. */
export async function pendingCount(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.count();
    req.onsuccess = () => {
      db.close();
      resolve(req.result);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

/**
 * Remove entries older than the stale threshold.
 * Returns the number of entries purged.
 */
export async function purgeStaleEntries(
  maxAgeMs: number = STALE_ENTRY_AGE_MS,
): Promise<number> {
  const db = await openDB();
  const cutoff = Date.now() - maxAgeMs;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.openCursor();
    let purged = 0;

    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return; // transaction will complete
      const entry = cursor.value as PendingEntry;
      if (entry.createdAt < cutoff) {
        cursor.delete();
        purged++;
      }
      cursor.continue();
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
    tx.oncomplete = () => {
      db.close();
      resolve(purged);
    };
  });
}
