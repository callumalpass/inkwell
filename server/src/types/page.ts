export interface PageMeta {
  id: string;
  notebookId: string;
  pageNumber: number;
  canvasX: number;
  canvasY: number;
  createdAt: string;
  updatedAt: string;
}

export interface PageIndex {
  [pageId: string]: string; // pageId -> notebookId
}
