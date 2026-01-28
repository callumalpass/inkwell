import { apiFetch } from "./client";

export interface FrontmatterTemplate {
  [key: string]: string;
}

export interface FrontmatterConfig {
  enabled: boolean;
  template: FrontmatterTemplate;
}

export interface SyncConfig {
  enabled: boolean;
  destination: string;
  filenameTemplate: string;
  syncOnTranscription: boolean;
  syncOnManual: boolean;
}

export interface MarkdownConfig {
  frontmatter: FrontmatterConfig;
  sync: SyncConfig;
}

export interface SyncStatus {
  enabled: boolean;
  destination: string;
  lastSync: string | null;
  totalSynced: number;
}

export function getMarkdownConfig() {
  return apiFetch<MarkdownConfig>("/config/markdown");
}

export function updateMarkdownConfig(
  updates: {
    frontmatter?: Partial<FrontmatterConfig>;
    sync?: Partial<SyncConfig>;
  },
) {
  return apiFetch<MarkdownConfig>("/config/markdown", {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export function getSyncStatus() {
  return apiFetch<SyncStatus>("/sync/status");
}
