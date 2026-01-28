import type { MarkdownConfig, SyncStatus, AppSettings } from "../types/index.js";
import { DEFAULT_MARKDOWN_CONFIG, DEFAULT_APP_SETTINGS } from "../types/index.js";
import { paths } from "./paths.js";
import { ensureDir, readJson, writeJson } from "./fs-utils.js";
import { join } from "node:path";

interface GlobalConfig {
  version: number;
  markdown: MarkdownConfig;
  syncStatus: {
    lastSync: string | null;
    totalSynced: number;
  };
  appSettings: AppSettings;
}

const DEFAULT_GLOBAL_CONFIG: GlobalConfig = {
  version: 1,
  markdown: DEFAULT_MARKDOWN_CONFIG,
  syncStatus: {
    lastSync: null,
    totalSynced: 0,
  },
  appSettings: DEFAULT_APP_SETTINGS,
};

function configPath(): string {
  return join(paths.data(), "config.json");
}

function cloneDefaults(): GlobalConfig {
  return structuredClone(DEFAULT_GLOBAL_CONFIG);
}

async function readGlobalConfig(): Promise<GlobalConfig> {
  const data = await readJson<GlobalConfig>(configPath());
  const defaults = cloneDefaults();
  if (!data) return defaults;
  // Merge with defaults to handle missing fields from older configs
  return {
    ...defaults,
    ...data,
    markdown: {
      ...defaults.markdown,
      ...data.markdown,
      frontmatter: {
        ...defaults.markdown.frontmatter,
        ...data.markdown?.frontmatter,
      },
      sync: {
        ...defaults.markdown.sync,
        ...data.markdown?.sync,
      },
    },
    syncStatus: {
      ...defaults.syncStatus,
      ...data.syncStatus,
    },
    appSettings: {
      ...defaults.appSettings,
      ...data.appSettings,
    },
  };
}

async function writeGlobalConfig(cfg: GlobalConfig): Promise<void> {
  await ensureDir(paths.data());
  await writeJson(configPath(), cfg);
}

export async function getMarkdownConfig(): Promise<MarkdownConfig> {
  const cfg = await readGlobalConfig();
  return cfg.markdown;
}

export async function updateMarkdownConfig(
  updates: Partial<{
    frontmatter: Partial<MarkdownConfig["frontmatter"]>;
    sync: Partial<MarkdownConfig["sync"]>;
  }>,
): Promise<MarkdownConfig> {
  const cfg = await readGlobalConfig();

  if (updates.frontmatter) {
    cfg.markdown.frontmatter = {
      ...cfg.markdown.frontmatter,
      ...updates.frontmatter,
    };
  }

  if (updates.sync) {
    cfg.markdown.sync = {
      ...cfg.markdown.sync,
      ...updates.sync,
    };
  }

  await writeGlobalConfig(cfg);
  return cfg.markdown;
}

export async function getSyncStatus(): Promise<SyncStatus> {
  const cfg = await readGlobalConfig();
  return {
    enabled: cfg.markdown.sync.enabled,
    destination: cfg.markdown.sync.destination,
    lastSync: cfg.syncStatus.lastSync,
    totalSynced: cfg.syncStatus.totalSynced,
  };
}

export async function recordSync(count: number): Promise<void> {
  const cfg = await readGlobalConfig();
  cfg.syncStatus.lastSync = new Date().toISOString();
  cfg.syncStatus.totalSynced += count;
  await writeGlobalConfig(cfg);
}

export async function getAppSettings(): Promise<AppSettings> {
  const cfg = await readGlobalConfig();
  return cfg.appSettings;
}

export async function updateAppSettings(
  updates: Partial<AppSettings>,
): Promise<AppSettings> {
  const cfg = await readGlobalConfig();
  cfg.appSettings = {
    ...cfg.appSettings,
    ...updates,
  };
  await writeGlobalConfig(cfg);
  return cfg.appSettings;
}
