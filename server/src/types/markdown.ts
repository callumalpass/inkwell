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

export const DEFAULT_MARKDOWN_CONFIG: MarkdownConfig = {
  frontmatter: {
    enabled: true,
    template: {
      title: "{{transcription.firstLine}}",
      date: "{{page.created}}",
      modified: "{{page.modified}}",
      tags: "{{page.tags}}",
      links: "{{page.links}}",
      notebook: "{{notebook.name}}",
      page_id: "{{page.id}}",
    },
  },
  sync: {
    enabled: false,
    destination: "",
    filenameTemplate: "{{notebook.name}}/{{page.seq}}-{{page.id}}.md",
    syncOnTranscription: true,
    syncOnManual: true,
  },
};
