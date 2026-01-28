import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsPanel } from "./SettingsPanel";
import { useSettingsStore } from "../../stores/settings-store";
import { useMarkdownConfigStore } from "../../stores/markdown-config-store";

vi.mock("../../api/settings", () => ({
  getSettings: vi.fn().mockResolvedValue({}),
  saveSettings: vi.fn().mockImplementation((s) => Promise.resolve(s)),
}));

vi.mock("../../api/markdown", () => ({
  getMarkdownConfig: vi.fn().mockResolvedValue({
    frontmatter: { enabled: true, template: {} },
    sync: {
      enabled: false,
      destination: "",
      filenameTemplate: "",
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

beforeEach(() => {
  useSettingsStore.setState({
    settings: {
      defaultPenStyle: "pressure",
      defaultColor: "#000000",
      defaultStrokeWidth: 3,
      defaultGridType: "none",
      defaultViewMode: "single",
      autoTranscribe: true,
    },
    loaded: true,
  });
  useMarkdownConfigStore.setState({
    config: {
      frontmatter: { enabled: true, template: {} },
      sync: {
        enabled: false,
        destination: "",
        filenameTemplate: "",
        syncOnTranscription: true,
        syncOnManual: true,
      },
    },
    syncStatus: {
      enabled: false,
      destination: "",
      lastSync: null,
      totalSynced: 0,
    },
    loading: false,
    error: null,
  });
  vi.clearAllMocks();
});

describe("SettingsPanel", () => {
  it("does not render when closed", () => {
    render(<SettingsPanel open={false} onClose={() => {}} />);
    expect(screen.queryByText("Settings")).not.toBeInTheDocument();
  });

  it("renders when open", () => {
    render(<SettingsPanel open={true} onClose={() => {}} />);
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("shows Close button", () => {
    render(<SettingsPanel open={true} onClose={() => {}} />);
    expect(screen.getByText("Close")).toBeInTheDocument();
  });

  it("calls onClose when Close button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<SettingsPanel open={true} onClose={onClose} />);
    await user.click(screen.getByText("Close"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows subtitle about global defaults", () => {
    render(<SettingsPanel open={true} onClose={() => {}} />);
    expect(
      screen.getByText(
        /Global defaults for new notebooks/,
      ),
    ).toBeInTheDocument();
  });
});

describe("SettingsPanel - Pen Style", () => {
  it("shows pen style options", () => {
    render(<SettingsPanel open={true} onClose={() => {}} />);
    expect(screen.getByText("Pressure")).toBeInTheDocument();
    expect(screen.getByText("Uniform")).toBeInTheDocument();
    expect(screen.getByText("Ballpoint")).toBeInTheDocument();
  });

  it("updates pen style when button is clicked", async () => {
    const user = userEvent.setup();
    const { saveSettings } = await import("../../api/settings");
    vi.mocked(saveSettings).mockImplementation((s) =>
      Promise.resolve(s as any),
    );

    render(<SettingsPanel open={true} onClose={() => {}} />);
    await user.click(screen.getByText("Uniform"));

    const state = useSettingsStore.getState();
    expect(state.settings.defaultPenStyle).toBe("uniform");
  });
});

describe("SettingsPanel - Color", () => {
  it("shows color preset buttons", () => {
    render(<SettingsPanel open={true} onClose={() => {}} />);
    expect(screen.getByLabelText("Black")).toBeInTheDocument();
    expect(screen.getByLabelText("Blue")).toBeInTheDocument();
    expect(screen.getByLabelText("Red")).toBeInTheDocument();
  });

  it("updates color when preset is clicked", async () => {
    const user = userEvent.setup();
    const { saveSettings } = await import("../../api/settings");
    vi.mocked(saveSettings).mockImplementation((s) =>
      Promise.resolve(s as any),
    );

    render(<SettingsPanel open={true} onClose={() => {}} />);
    await user.click(screen.getByLabelText("Blue"));

    const state = useSettingsStore.getState();
    expect(state.settings.defaultColor).toBe("#1e40af");
  });
});

describe("SettingsPanel - Stroke Width", () => {
  it("shows width option buttons", () => {
    render(<SettingsPanel open={true} onClose={() => {}} />);
    expect(screen.getByText("Width")).toBeInTheDocument();
  });

  it("updates width when button is clicked", async () => {
    const user = userEvent.setup();
    const { saveSettings } = await import("../../api/settings");
    vi.mocked(saveSettings).mockImplementation((s) =>
      Promise.resolve(s as any),
    );

    render(<SettingsPanel open={true} onClose={() => {}} />);
    // Find the width=5 button by its dot size (visual indicator)
    const widthButtons = screen.getByText("Width").parentElement!;
    const buttons = widthButtons.querySelectorAll("button");
    // Width buttons are in order: 2, 3, 5, 8 -> index 2 is width 5
    await user.click(buttons[2]);

    const state = useSettingsStore.getState();
    expect(state.settings.defaultStrokeWidth).toBe(5);
  });
});

describe("SettingsPanel - Grid Type", () => {
  it("shows grid type buttons", () => {
    render(<SettingsPanel open={true} onClose={() => {}} />);
    expect(screen.getByText("Plain")).toBeInTheDocument();
    expect(screen.getByText("Lined")).toBeInTheDocument();
    // "Grid" appears both as label and as button; check at least 2 elements
    expect(screen.getAllByText("Grid").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Dots")).toBeInTheDocument();
  });

  it("updates grid type when button is clicked", async () => {
    const user = userEvent.setup();
    const { saveSettings } = await import("../../api/settings");
    vi.mocked(saveSettings).mockImplementation((s) =>
      Promise.resolve(s as any),
    );

    render(<SettingsPanel open={true} onClose={() => {}} />);
    await user.click(screen.getByText("Lined"));

    const state = useSettingsStore.getState();
    expect(state.settings.defaultGridType).toBe("lined");
  });
});

describe("SettingsPanel - Line Spacing", () => {
  it("updates line spacing when button is clicked", async () => {
    const user = userEvent.setup();
    const { saveSettings } = await import("../../api/settings");
    vi.mocked(saveSettings).mockImplementation((s) =>
      Promise.resolve(s as any),
    );

    render(<SettingsPanel open={true} onClose={() => {}} />);
    await user.click(screen.getByText("Large"));

    const state = useSettingsStore.getState();
    expect(state.settings.defaultBackgroundLineSpacing).toBe(56);
  });
});

describe("SettingsPanel - View Mode", () => {
  it("shows view mode buttons", () => {
    render(<SettingsPanel open={true} onClose={() => {}} />);
    expect(screen.getByText("Single")).toBeInTheDocument();
    expect(screen.getByText("Scroll")).toBeInTheDocument();
    expect(screen.getByText("Canvas")).toBeInTheDocument();
  });

  it("updates view mode when button is clicked", async () => {
    const user = userEvent.setup();
    const { saveSettings } = await import("../../api/settings");
    vi.mocked(saveSettings).mockImplementation((s) =>
      Promise.resolve(s as any),
    );

    render(<SettingsPanel open={true} onClose={() => {}} />);
    await user.click(screen.getByText("Canvas"));

    const state = useSettingsStore.getState();
    expect(state.settings.defaultViewMode).toBe("canvas");
  });
});

describe("SettingsPanel - Auto-Transcribe", () => {
  it("shows auto-transcribe toggle", () => {
    render(<SettingsPanel open={true} onClose={() => {}} />);
    expect(screen.getByText("Auto-Transcribe")).toBeInTheDocument();
  });

  it("updates auto-transcribe when Off is clicked", async () => {
    const user = userEvent.setup();
    const { saveSettings } = await import("../../api/settings");
    vi.mocked(saveSettings).mockImplementation((s) =>
      Promise.resolve(s as any),
    );

    render(<SettingsPanel open={true} onClose={() => {}} />);
    // Find the Auto-Transcribe label, then get the Off button from its parent
    const label = screen.getByText("Auto-Transcribe");
    const section = label.closest("div")!;
    const offButton = section.querySelector("button:last-child")!;
    await user.click(offButton);

    const state = useSettingsStore.getState();
    expect(state.settings.autoTranscribe).toBe(false);
  });
});

describe("SettingsPanel - Markdown Config", () => {
  it("includes MarkdownConfigPanel", () => {
    render(<SettingsPanel open={true} onClose={() => {}} />);
    // MarkdownConfigPanel renders with data-testid="markdown-config-panel"
    expect(
      screen.getByTestId("markdown-config-panel"),
    ).toBeInTheDocument();
  });
});
