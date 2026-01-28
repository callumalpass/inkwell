import { useMarkdownConfigStore } from "./markdown-config-store";
import type { MarkdownConfig, SyncStatus } from "../api/markdown";

vi.mock("../api/markdown", () => ({
  getMarkdownConfig: vi.fn(),
  updateMarkdownConfig: vi.fn(),
  getSyncStatus: vi.fn(),
}));

const defaultConfig: MarkdownConfig = {
  frontmatter: {
    enabled: true,
    template: {
      title: "{{transcription.firstLine}}",
      date: "{{page.created}}",
      tags: "{{page.tags}}",
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

const defaultSyncStatus: SyncStatus = {
  enabled: false,
  destination: "",
  lastSync: null,
  totalSynced: 0,
};

beforeEach(() => {
  useMarkdownConfigStore.setState({
    config: null,
    syncStatus: null,
    loading: false,
    error: null,
  });
  vi.clearAllMocks();
});

describe("markdown-config-store", () => {
  it("starts with null config and no loading", () => {
    const state = useMarkdownConfigStore.getState();
    expect(state.config).toBeNull();
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it("fetches config from API", async () => {
    const { getMarkdownConfig } = await import("../api/markdown");
    vi.mocked(getMarkdownConfig).mockResolvedValue(defaultConfig);

    await useMarkdownConfigStore.getState().fetchConfig();

    const state = useMarkdownConfigStore.getState();
    expect(state.config).toEqual(defaultConfig);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it("sets error on fetch failure", async () => {
    const { getMarkdownConfig } = await import("../api/markdown");
    vi.mocked(getMarkdownConfig).mockRejectedValue(new Error("Network error"));

    await useMarkdownConfigStore.getState().fetchConfig();

    const state = useMarkdownConfigStore.getState();
    expect(state.config).toBeNull();
    expect(state.error).toBe("Network error");
  });

  it("fetches sync status", async () => {
    const { getSyncStatus } = await import("../api/markdown");
    vi.mocked(getSyncStatus).mockResolvedValue(defaultSyncStatus);

    await useMarkdownConfigStore.getState().fetchSyncStatus();

    expect(useMarkdownConfigStore.getState().syncStatus).toEqual(defaultSyncStatus);
  });

  it("updates frontmatter optimistically", async () => {
    useMarkdownConfigStore.setState({ config: defaultConfig });
    const { updateMarkdownConfig } = await import("../api/markdown");
    const updated = {
      ...defaultConfig,
      frontmatter: { ...defaultConfig.frontmatter, enabled: false },
    };
    vi.mocked(updateMarkdownConfig).mockResolvedValue(updated);

    const promise = useMarkdownConfigStore.getState().updateFrontmatter({ enabled: false });

    // Optimistic update happens immediately
    expect(useMarkdownConfigStore.getState().config?.frontmatter.enabled).toBe(false);

    await promise;
    expect(updateMarkdownConfig).toHaveBeenCalledWith({ frontmatter: { enabled: false } });
    expect(useMarkdownConfigStore.getState().config).toEqual(updated);
  });

  it("reverts frontmatter on update failure", async () => {
    useMarkdownConfigStore.setState({ config: defaultConfig });
    const { updateMarkdownConfig } = await import("../api/markdown");
    vi.mocked(updateMarkdownConfig).mockRejectedValue(new Error("Save failed"));

    await useMarkdownConfigStore.getState().updateFrontmatter({ enabled: false });

    // Should revert to original config
    expect(useMarkdownConfigStore.getState().config).toEqual(defaultConfig);
    expect(useMarkdownConfigStore.getState().error).toBe("Save failed");
  });

  it("updates sync config optimistically", async () => {
    useMarkdownConfigStore.setState({ config: defaultConfig });
    const { updateMarkdownConfig } = await import("../api/markdown");
    const updated = {
      ...defaultConfig,
      sync: { ...defaultConfig.sync, enabled: true, destination: "/vault" },
    };
    vi.mocked(updateMarkdownConfig).mockResolvedValue(updated);

    await useMarkdownConfigStore
      .getState()
      .updateSync({ enabled: true, destination: "/vault" });

    expect(updateMarkdownConfig).toHaveBeenCalledWith({
      sync: { enabled: true, destination: "/vault" },
    });
    expect(useMarkdownConfigStore.getState().config).toEqual(updated);
  });

  it("does nothing when config is null", async () => {
    const { updateMarkdownConfig } = await import("../api/markdown");

    await useMarkdownConfigStore.getState().updateFrontmatter({ enabled: false });
    await useMarkdownConfigStore.getState().updateSync({ enabled: true });

    expect(updateMarkdownConfig).not.toHaveBeenCalled();
  });
});
