import { useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  const handleStatusEvent = () => callback();
  window.addEventListener("online", handleStatusEvent);
  window.addEventListener("offline", handleStatusEvent);

  // Playwright's context.setOffline may not always dispatch browser online/offline
  // events consistently, so poll navigator.onLine and notify on transitions.
  let last = navigator.onLine;
  const id = window.setInterval(() => {
    const next = navigator.onLine;
    if (next !== last) {
      last = next;
      callback();
    }
  }, 500);

  return () => {
    window.removeEventListener("online", handleStatusEvent);
    window.removeEventListener("offline", handleStatusEvent);
    window.clearInterval(id);
  };
}

function getSnapshot() {
  return navigator.onLine;
}

function getServerSnapshot() {
  return true;
}

/** Returns true if the browser reports network connectivity. */
export function useNetworkStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
