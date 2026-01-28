export interface AppSettings {
  defaultPenStyle?: "pressure" | "uniform" | "ballpoint";
  defaultColor?: string;
  defaultStrokeWidth?: number;
  defaultGridType?: "none" | "lined" | "grid" | "dotgrid";
  defaultBackgroundLineSpacing?: number;
  defaultViewMode?: "single" | "canvas" | "overview";
  autoTranscribe?: boolean;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {};
