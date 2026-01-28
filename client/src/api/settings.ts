import { apiFetch } from "./client";

export interface AppSettings {
  defaultPenStyle?: "pressure" | "uniform" | "ballpoint";
  defaultColor?: string;
  defaultStrokeWidth?: number;
  defaultGridType?: "none" | "lined" | "grid" | "dotgrid";
  defaultViewMode?: "single" | "scroll" | "canvas";
  autoTranscribe?: boolean;
}

export function getSettings() {
  return apiFetch<AppSettings>("/settings");
}

export function saveSettings(settings: Partial<AppSettings>) {
  return apiFetch<AppSettings>("/settings", {
    method: "PUT",
    body: JSON.stringify(settings),
  });
}
