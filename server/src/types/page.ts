export interface PageMeta {
  id: string;
  notebookId: string;
  pageNumber: number;
  createdAt: string;
  updatedAt: string;
}

export interface PageIndex {
  [pageId: string]: string; // pageId -> notebookId
}
