export type TranscriptionStatus = "none" | "pending" | "processing" | "complete" | "failed";

export interface TranscriptionMeta {
  status: TranscriptionStatus;
  lastAttempt: string | null;
  error: string | null;
}

export interface PageMeta {
  id: string;
  notebookId: string;
  pageNumber: number;
  canvasX: number;
  canvasY: number;
  createdAt: string;
  updatedAt: string;
  links?: string[];
  tags?: string[];
  transcription?: TranscriptionMeta;
}

export interface PageIndex {
  [pageId: string]: string; // pageId -> notebookId
}
