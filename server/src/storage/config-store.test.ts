import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { config } from "../config.js";
import {
  getMarkdownConfig,
  updateMarkdownConfig,
  getSyncStatus,
  recordSync,
} from "./config-store.js";
import { DEFAULT_MARKDOWN_CONFIG } from "../types/index.js";

// Use a unique prefix per describe block to avoid stale tmpdir refs
let savedDataDir: string;

beforeEach(async () => {
  savedDataDir = config.dataDir;
  config.dataDir = await mkdtemp(join(tmpdir(), "inkwell-config-test-"));
});

afterEach(async () => {
  const dir = config.dataDir;
  config.dataDir = savedDataDir;
  await rm(dir, { recursive: true, force: true });
});

describe("getMarkdownConfig", () => {
  it("returns defaults when no config file exists", async () => {
    const mdConfig = await getMarkdownConfig();
    expect(mdConfig.frontmatter.enabled).toBe(
      DEFAULT_MARKDOWN_CONFIG.frontmatter.enabled,
    );
    expect(mdConfig.sync.enabled).toBe(DEFAULT_MARKDOWN_CONFIG.sync.enabled);
    expect(mdConfig.sync.destination).toBe(
      DEFAULT_MARKDOWN_CONFIG.sync.destination,
    );
  });
});

describe("updateMarkdownConfig", () => {
  it("updates frontmatter settings", async () => {
    const updated = await updateMarkdownConfig({
      frontmatter: { enabled: false },
    });
    expect(updated.frontmatter.enabled).toBe(false);
    // Template should be preserved from default
    expect(updated.frontmatter.template).toEqual(
      DEFAULT_MARKDOWN_CONFIG.frontmatter.template,
    );
  });

  it("updates sync settings", async () => {
    const updated = await updateMarkdownConfig({
      sync: {
        enabled: true,
        destination: "/tmp/obsidian",
      },
    });
    expect(updated.sync.enabled).toBe(true);
    expect(updated.sync.destination).toBe("/tmp/obsidian");
    // Other sync fields preserved
    expect(updated.sync.syncOnTranscription).toBe(true);
  });

  it("updates frontmatter template", async () => {
    const updated = await updateMarkdownConfig({
      frontmatter: {
        template: { title: "{{page.id}}", custom: "value" },
      },
    });
    expect(updated.frontmatter.template.title).toBe("{{page.id}}");
    expect(updated.frontmatter.template.custom).toBe("value");
  });

  it("persists across reads", async () => {
    await updateMarkdownConfig({
      sync: { enabled: true, destination: "/data/vault" },
    });

    const read = await getMarkdownConfig();
    expect(read.sync.enabled).toBe(true);
    expect(read.sync.destination).toBe("/data/vault");
  });

  it("merges partial updates without clobbering other fields", async () => {
    await updateMarkdownConfig({
      frontmatter: { enabled: false },
    });
    await updateMarkdownConfig({
      sync: { enabled: true },
    });

    const read = await getMarkdownConfig();
    expect(read.frontmatter.enabled).toBe(false);
    expect(read.sync.enabled).toBe(true);
  });
});

describe("getSyncStatus", () => {
  it("returns default status when no syncs have occurred", async () => {
    const status = await getSyncStatus();
    expect(status.enabled).toBe(false);
    expect(status.lastSync).toBeNull();
    expect(status.totalSynced).toBe(0);
  });

  it("reflects config changes", async () => {
    await updateMarkdownConfig({
      sync: { enabled: true, destination: "/tmp/vault" },
    });

    const status = await getSyncStatus();
    expect(status.enabled).toBe(true);
    expect(status.destination).toBe("/tmp/vault");
  });
});

describe("recordSync", () => {
  it("updates lastSync and totalSynced", async () => {
    await recordSync(5);

    const status = await getSyncStatus();
    expect(status.lastSync).not.toBeNull();
    expect(status.totalSynced).toBe(5);
  });

  it("accumulates totalSynced across calls", async () => {
    await recordSync(3);
    await recordSync(2);

    const status = await getSyncStatus();
    expect(status.totalSynced).toBe(5);
  });
});
