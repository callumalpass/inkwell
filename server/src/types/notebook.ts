export interface NotebookBookmark {
  id: string;
  pageId: string;
  label?: string;
  parentId?: string | null;
  createdAt: string;
  order: number;
}

export interface NotebookSettings {
  defaultTool?: "pen" | "highlighter" | "eraser";
  defaultColor?: string;
  defaultStrokeWidth?: number;
  gridType?: "none" | "lined" | "grid" | "dotgrid";
  backgroundLineSpacing?: number;
  bookmarks?: NotebookBookmark[];
}

export interface NotebookMeta {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  settings?: NotebookSettings;
}
