export interface NotebookSettings {
  defaultTool?: "pen" | "highlighter" | "eraser";
  defaultColor?: string;
  defaultStrokeWidth?: number;
  gridType?: "none" | "lined" | "grid" | "dotgrid";
  backgroundLineSpacing?: number;
}

export interface NotebookMeta {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  settings?: NotebookSettings;
}
