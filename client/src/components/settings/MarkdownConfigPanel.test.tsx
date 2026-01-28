import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MarkdownConfigPanel } from "./MarkdownConfigPanel";
import { useMarkdownConfigStore } from "../../stores/markdown-config-store";
import type { MarkdownConfig, SyncStatus } from "../../api/markdown";

vi.mock("../../api/markdown", () => ({
  getMarkdownConfig: vi.fn().mockResolvedValue({
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
  }),
  updateMarkdownConfig: vi.fn(),
  getSyncStatus: vi.fn().mockResolvedValue({
    enabled: false,
    destination: "",
    lastSync: null,
    totalSynced: 0,
  }),
}));

const DEFAULT_CONFIG: MarkdownConfig = {
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

const DEFAULT_SYNC_STATUS: SyncStatus = {
  enabled: false,
  destination: "",
  lastSync: null,
  totalSynced: 0,
};

beforeEach(() => {
  useMarkdownConfigStore.setState({
    config: DEFAULT_CONFIG,
    syncStatus: DEFAULT_SYNC_STATUS,
    loading: false,
    error: null,
    // Stub async functions to prevent unhandled state updates
    fetchConfig: vi.fn(),
    fetchSyncStatus: vi.fn(),
  });
  vi.clearAllMocks();
});

describe("MarkdownConfigPanel", () => {
  it("renders the panel", () => {
    render(<MarkdownConfigPanel />);
    expect(screen.getByTestId("markdown-config-panel")).toBeInTheDocument();
  });

  it("shows loading state when loading and no config", () => {
    // Override fetchConfig/fetchSyncStatus to prevent the useEffect from resolving
    useMarkdownConfigStore.setState({
      config: null,
      loading: true,
      fetchConfig: vi.fn(),
      fetchSyncStatus: vi.fn(),
    });
    render(<MarkdownConfigPanel />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows error when config fails to load", () => {
    useMarkdownConfigStore.setState({
      config: null,
      loading: false,
      error: "Network error",
      fetchConfig: vi.fn(),
      fetchSyncStatus: vi.fn(),
    });
    render(<MarkdownConfigPanel />);
    expect(screen.getByText("Network error")).toBeInTheDocument();
  });

  it("shows fallback error when config is null and no error message", () => {
    useMarkdownConfigStore.setState({
      config: null,
      loading: false,
      error: null,
      fetchConfig: vi.fn(),
      fetchSyncStatus: vi.fn(),
    });
    render(<MarkdownConfigPanel />);
    expect(
      screen.getByText("Failed to load markdown config"),
    ).toBeInTheDocument();
  });
});

describe("MarkdownConfigPanel - Frontmatter", () => {
  it("shows the Frontmatter section heading", () => {
    render(<MarkdownConfigPanel />);
    expect(screen.getByText("Frontmatter")).toBeInTheDocument();
  });

  it("shows On/Off toggle for frontmatter", () => {
    render(<MarkdownConfigPanel />);
    expect(screen.getByTestId("frontmatter-toggle-on")).toBeInTheDocument();
    expect(screen.getByTestId("frontmatter-toggle-off")).toBeInTheDocument();
  });

  it("shows template fields when frontmatter is enabled", () => {
    render(<MarkdownConfigPanel />);
    expect(screen.getByTestId("frontmatter-fields")).toBeInTheDocument();
    expect(
      screen.getByTestId("frontmatter-field-title"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("frontmatter-field-date"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("frontmatter-field-tags"),
    ).toBeInTheDocument();
  });

  it("hides template fields when frontmatter is disabled", () => {
    useMarkdownConfigStore.setState({
      config: {
        ...DEFAULT_CONFIG,
        frontmatter: { ...DEFAULT_CONFIG.frontmatter, enabled: false },
      },
    });
    render(<MarkdownConfigPanel />);
    expect(
      screen.queryByTestId("frontmatter-fields"),
    ).not.toBeInTheDocument();
  });

  it("displays field values in inputs", () => {
    render(<MarkdownConfigPanel />);
    const titleInput = screen.getByTestId(
      "frontmatter-field-title",
    ) as HTMLInputElement;
    expect(titleInput.value).toBe("{{transcription.firstLine}}");
  });

  it("calls updateFrontmatter when toggling frontmatter off", async () => {
    const user = userEvent.setup();
    const { updateMarkdownConfig } = await import("../../api/markdown");
    vi.mocked(updateMarkdownConfig).mockResolvedValue({
      ...DEFAULT_CONFIG,
      frontmatter: { ...DEFAULT_CONFIG.frontmatter, enabled: false },
    });

    render(<MarkdownConfigPanel />);
    await user.click(screen.getByTestId("frontmatter-toggle-off"));

    // Store should have been called via updateFrontmatter
    const state = useMarkdownConfigStore.getState();
    expect(state.config?.frontmatter.enabled).toBe(false);
  });

  it("calls updateFrontmatter when changing a field value", async () => {
    const user = userEvent.setup();
    const { updateMarkdownConfig } = await import("../../api/markdown");
    vi.mocked(updateMarkdownConfig).mockResolvedValue({
      ...DEFAULT_CONFIG,
      frontmatter: {
        ...DEFAULT_CONFIG.frontmatter,
        template: {
          ...DEFAULT_CONFIG.frontmatter.template,
          title: "new value",
        },
      },
    });

    render(<MarkdownConfigPanel />);
    const titleInput = screen.getByTestId("frontmatter-field-title");
    await user.clear(titleInput);
    await user.type(titleInput, "new value");

    // Optimistic update should reflect in store
    const state = useMarkdownConfigStore.getState();
    expect(state.config?.frontmatter.template.title).toBe("new value");
  });

  it("removes a template field when remove button is clicked", async () => {
    const user = userEvent.setup();
    const { updateMarkdownConfig } = await import("../../api/markdown");
    vi.mocked(updateMarkdownConfig).mockResolvedValue({
      ...DEFAULT_CONFIG,
      frontmatter: {
        enabled: true,
        template: {
          title: "{{transcription.firstLine}}",
          tags: "{{page.tags}}",
        },
      },
    });

    render(<MarkdownConfigPanel />);
    await user.click(screen.getByTestId("frontmatter-remove-date"));

    const state = useMarkdownConfigStore.getState();
    expect(state.config?.frontmatter.template.date).toBeUndefined();
  });

  it("adds a new template field", async () => {
    const user = userEvent.setup();
    const { updateMarkdownConfig } = await import("../../api/markdown");
    vi.mocked(updateMarkdownConfig).mockResolvedValue({
      ...DEFAULT_CONFIG,
      frontmatter: {
        ...DEFAULT_CONFIG.frontmatter,
        template: {
          ...DEFAULT_CONFIG.frontmatter.template,
          notebook: "{{notebook.name}}",
        },
      },
    });

    render(<MarkdownConfigPanel />);
    await user.type(screen.getByTestId("frontmatter-new-key"), "notebook");
    await user.type(
      screen.getByTestId("frontmatter-new-value"),
      "{{notebook.name}}",
    );
    await user.click(screen.getByTestId("frontmatter-add"));

    const state = useMarkdownConfigStore.getState();
    expect(state.config?.frontmatter.template.notebook).toBe(
      "{{notebook.name}}",
    );
  });

  it("disables Add button when key is empty", () => {
    render(<MarkdownConfigPanel />);
    expect(screen.getByTestId("frontmatter-add")).toBeDisabled();
  });

  it("does not add field when key already exists", async () => {
    const user = userEvent.setup();
    const { updateMarkdownConfig } = await import("../../api/markdown");
    vi.mocked(updateMarkdownConfig).mockClear();

    render(<MarkdownConfigPanel />);
    await user.type(screen.getByTestId("frontmatter-new-key"), "title");
    await user.type(
      screen.getByTestId("frontmatter-new-value"),
      "duplicate",
    );
    await user.click(screen.getByTestId("frontmatter-add"));

    // Should not have called updateMarkdownConfig because "title" already exists
    expect(updateMarkdownConfig).not.toHaveBeenCalled();
  });

  it("clears new field inputs after adding", async () => {
    const user = userEvent.setup();
    const { updateMarkdownConfig } = await import("../../api/markdown");
    vi.mocked(updateMarkdownConfig).mockResolvedValue({
      ...DEFAULT_CONFIG,
      frontmatter: {
        ...DEFAULT_CONFIG.frontmatter,
        template: {
          ...DEFAULT_CONFIG.frontmatter.template,
          custom: "value",
        },
      },
    });

    render(<MarkdownConfigPanel />);
    await user.type(screen.getByTestId("frontmatter-new-key"), "custom");
    await user.type(screen.getByTestId("frontmatter-new-value"), "value");
    await user.click(screen.getByTestId("frontmatter-add"));

    expect(screen.getByTestId("frontmatter-new-key")).toHaveValue("");
    expect(screen.getByTestId("frontmatter-new-value")).toHaveValue("");
  });

  it("shows template variable reference in a details element", () => {
    render(<MarkdownConfigPanel />);
    expect(screen.getByText("Template variables")).toBeInTheDocument();
  });
});

describe("MarkdownConfigPanel - Sync", () => {
  it("shows the Markdown Sync section heading", () => {
    render(<MarkdownConfigPanel />);
    expect(screen.getByText("Markdown Sync")).toBeInTheDocument();
  });

  it("shows On/Off toggle for sync", () => {
    render(<MarkdownConfigPanel />);
    expect(screen.getByTestId("sync-toggle-on")).toBeInTheDocument();
    expect(screen.getByTestId("sync-toggle-off")).toBeInTheDocument();
  });

  it("hides sync fields when sync is disabled", () => {
    render(<MarkdownConfigPanel />);
    // Sync is disabled by default
    expect(screen.queryByTestId("sync-destination")).not.toBeInTheDocument();
  });

  it("shows sync fields when sync is enabled", () => {
    useMarkdownConfigStore.setState({
      config: {
        ...DEFAULT_CONFIG,
        sync: { ...DEFAULT_CONFIG.sync, enabled: true },
      },
    });
    render(<MarkdownConfigPanel />);
    expect(screen.getByTestId("sync-destination")).toBeInTheDocument();
    expect(screen.getByTestId("sync-filename-template")).toBeInTheDocument();
    expect(screen.getByTestId("sync-on-transcription")).toBeInTheDocument();
    expect(screen.getByTestId("sync-on-manual")).toBeInTheDocument();
  });

  it("enables sync when On is clicked", async () => {
    const user = userEvent.setup();
    const { updateMarkdownConfig } = await import("../../api/markdown");
    vi.mocked(updateMarkdownConfig).mockResolvedValue({
      ...DEFAULT_CONFIG,
      sync: { ...DEFAULT_CONFIG.sync, enabled: true },
    });

    render(<MarkdownConfigPanel />);
    await user.click(screen.getByTestId("sync-toggle-on"));

    const state = useMarkdownConfigStore.getState();
    expect(state.config?.sync.enabled).toBe(true);
  });

  it("updates destination path", async () => {
    useMarkdownConfigStore.setState({
      config: {
        ...DEFAULT_CONFIG,
        sync: { ...DEFAULT_CONFIG.sync, enabled: true },
      },
    });
    const user = userEvent.setup();
    const { updateMarkdownConfig } = await import("../../api/markdown");
    vi.mocked(updateMarkdownConfig).mockResolvedValue({
      ...DEFAULT_CONFIG,
      sync: {
        ...DEFAULT_CONFIG.sync,
        enabled: true,
        destination: "/vault",
      },
    });

    render(<MarkdownConfigPanel />);
    const input = screen.getByTestId("sync-destination");
    await user.type(input, "/vault");

    const state = useMarkdownConfigStore.getState();
    expect(state.config?.sync.destination).toContain("/vault");
  });

  it("updates filename template", async () => {
    useMarkdownConfigStore.setState({
      config: {
        ...DEFAULT_CONFIG,
        sync: { ...DEFAULT_CONFIG.sync, enabled: true },
      },
    });
    const user = userEvent.setup();
    const { updateMarkdownConfig } = await import("../../api/markdown");
    vi.mocked(updateMarkdownConfig).mockResolvedValue({
      ...DEFAULT_CONFIG,
      sync: {
        ...DEFAULT_CONFIG.sync,
        enabled: true,
        filenameTemplate: "{{page.id}}.md",
      },
    });

    render(<MarkdownConfigPanel />);
    const input = screen.getByTestId("sync-filename-template");
    await user.clear(input);
    await user.type(input, "{{page.id}}.md");

    const state = useMarkdownConfigStore.getState();
    expect(state.config?.sync.filenameTemplate).toBe("{{page.id}}.md");
  });

  it("toggles syncOnTranscription checkbox", async () => {
    useMarkdownConfigStore.setState({
      config: {
        ...DEFAULT_CONFIG,
        sync: { ...DEFAULT_CONFIG.sync, enabled: true },
      },
    });
    const user = userEvent.setup();
    const { updateMarkdownConfig } = await import("../../api/markdown");
    vi.mocked(updateMarkdownConfig).mockResolvedValue({
      ...DEFAULT_CONFIG,
      sync: {
        ...DEFAULT_CONFIG.sync,
        enabled: true,
        syncOnTranscription: false,
      },
    });

    render(<MarkdownConfigPanel />);
    const checkbox = screen.getByTestId("sync-on-transcription");
    expect(checkbox).toBeChecked();

    await user.click(checkbox);

    const state = useMarkdownConfigStore.getState();
    expect(state.config?.sync.syncOnTranscription).toBe(false);
  });

  it("toggles syncOnManual checkbox", async () => {
    useMarkdownConfigStore.setState({
      config: {
        ...DEFAULT_CONFIG,
        sync: { ...DEFAULT_CONFIG.sync, enabled: true },
      },
    });
    const user = userEvent.setup();
    const { updateMarkdownConfig } = await import("../../api/markdown");
    vi.mocked(updateMarkdownConfig).mockResolvedValue({
      ...DEFAULT_CONFIG,
      sync: {
        ...DEFAULT_CONFIG.sync,
        enabled: true,
        syncOnManual: false,
      },
    });

    render(<MarkdownConfigPanel />);
    const checkbox = screen.getByTestId("sync-on-manual");
    expect(checkbox).toBeChecked();

    await user.click(checkbox);

    const state = useMarkdownConfigStore.getState();
    expect(state.config?.sync.syncOnManual).toBe(false);
  });

  it("shows sync status when available", () => {
    useMarkdownConfigStore.setState({
      config: {
        ...DEFAULT_CONFIG,
        sync: { ...DEFAULT_CONFIG.sync, enabled: true },
      },
      syncStatus: {
        enabled: true,
        destination: "/vault",
        lastSync: "2025-06-15T10:30:00Z",
        totalSynced: 42,
      },
    });
    render(<MarkdownConfigPanel />);
    expect(screen.getByTestId("sync-status")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("shows sync status without last sync when null", () => {
    useMarkdownConfigStore.setState({
      config: {
        ...DEFAULT_CONFIG,
        sync: { ...DEFAULT_CONFIG.sync, enabled: true },
      },
      syncStatus: {
        enabled: true,
        destination: "/vault",
        lastSync: null,
        totalSynced: 0,
      },
    });
    render(<MarkdownConfigPanel />);
    expect(screen.getByTestId("sync-status")).toBeInTheDocument();
    expect(screen.queryByText(/Last sync:/)).not.toBeInTheDocument();
  });
});

describe("MarkdownConfigPanel - Error display", () => {
  it("shows error message when error is set", () => {
    useMarkdownConfigStore.setState({
      config: DEFAULT_CONFIG,
      error: "Failed to save",
    });
    render(<MarkdownConfigPanel />);
    expect(screen.getByTestId("markdown-config-error")).toHaveTextContent(
      "Failed to save",
    );
  });

  it("does not show error element when no error", () => {
    render(<MarkdownConfigPanel />);
    expect(
      screen.queryByTestId("markdown-config-error"),
    ).not.toBeInTheDocument();
  });
});
