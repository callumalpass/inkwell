import { create } from "zustand";

export type ToastType = "success" | "error" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => string;
  removeToast: (id: string) => void;
  clearAll: () => void;
}

let toastId = 0;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],

  addToast: (toast) => {
    const id = `toast-${++toastId}`;
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }));

    const duration = toast.duration ?? (toast.type === "error" ? 5000 : 3000);
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, duration);
    }

    return id;
  },

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  clearAll: () => set({ toasts: [] }),
}));

export function showToast(
  type: ToastType,
  message: string,
  duration?: number,
): string {
  return useToastStore.getState().addToast({ type, message, duration });
}

export function showError(message: string, duration?: number): string {
  return showToast("error", message, duration);
}

export function showSuccess(message: string, duration?: number): string {
  return showToast("success", message, duration);
}

export function showInfo(message: string, duration?: number): string {
  return showToast("info", message, duration);
}
