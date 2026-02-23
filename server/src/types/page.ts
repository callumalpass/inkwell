export type TranscriptionStatus = "none" | "pending" | "processing" | "complete" | "failed";

export interface TranscriptionMeta {
  status: TranscriptionStatus;
  lastAttempt: string | null;
  error: string | null;
}

export interface InlineLinkRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface InlinePageLinkTarget {
  type: "page";
  pageId: string;
  notebookId: string;
  label?: string;
}

export interface InlineUrlLinkTarget {
  type: "url";
  url: string;
  label?: string;
}

export type InlineLinkTarget = InlinePageLinkTarget | InlineUrlLinkTarget;

export interface InlineLink {
  id: string;
  rect: InlineLinkRect;
  target: InlineLinkTarget;
  createdAt: string;
  updatedAt: string;
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
  inlineLinks?: InlineLink[];
  tags?: string[];
  transcription?: TranscriptionMeta;
}

export interface PageIndex {
  [pageId: string]: string; // pageId -> notebookId
}
