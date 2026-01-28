import { useSettingsStore } from "./settings-store";
import type { AppSettings } from "../api/settings";

vi.mock("../api/settings", () => ({
  getSettings: vi.fn(),
  saveSettings: vi.fn(),
}));

const makeSettings = (overrides: Partial<AppSettings> = {}): AppSettings => ({
  defaultPenStyle: "pressure",
  defaultColor: "#000000",
  defaultStrokeWidth: 2,
  defaultGridType: "lined",
  defaultBackgroundLineSpacing: 32,
  defaultViewMode: "canvas",
  autoTranscribe: false,
  ...overrides,
});

beforeEach(() => {
  useSettingsStore.setState({
    settings: {},
    loaded: false,
  });
  vi.clearAllMocks();
});

describe("initial state", () => {
  it("starts with empty settings and not loaded", () => {
    const state = useSettingsStore.getState();
    expect(state.settings).toEqual({});
    expect(state.loaded).toBe(false);
  });
});

describe("fetchSettings", () => {
  it("fetches settings and stores them", async () => {
    const { getSettings } = await import("../api/settings");
    const settings = makeSettings();
    vi.mocked(getSettings).mockResolvedValue(settings);

    await useSettingsStore.getState().fetchSettings();

    const state = useSettingsStore.getState();
    expect(state.settings).toEqual(settings);
    expect(state.loaded).toBe(true);
    expect(getSettings).toHaveBeenCalledOnce();
  });

  it("sets loaded to true on success", async () => {
    const { getSettings } = await import("../api/settings");
    vi.mocked(getSettings).mockResolvedValue(makeSettings());

    expect(useSettingsStore.getState().loaded).toBe(false);
    await useSettingsStore.getState().fetchSettings();
    expect(useSettingsStore.getState().loaded).toBe(true);
  });

  it("sets loaded to true even on failure (graceful degradation)", async () => {
    const { getSettings } = await import("../api/settings");
    vi.mocked(getSettings).mockRejectedValue(new Error("Network error"));

    await useSettingsStore.getState().fetchSettings();

    const state = useSettingsStore.getState();
    expect(state.loaded).toBe(true);
    expect(state.settings).toEqual({});
  });

  it("keeps empty settings on failure", async () => {
    const { getSettings } = await import("../api/settings");
    vi.mocked(getSettings).mockRejectedValue(new Error("Server down"));

    await useSettingsStore.getState().fetchSettings();

    expect(useSettingsStore.getState().settings).toEqual({});
  });

  it("replaces previous settings on re-fetch", async () => {
    const { getSettings } = await import("../api/settings");
    useSettingsStore.setState({
      settings: makeSettings({ defaultColor: "#ff0000" }),
      loaded: true,
    });

    const newSettings = makeSettings({ defaultColor: "#00ff00" });
    vi.mocked(getSettings).mockResolvedValue(newSettings);

    await useSettingsStore.getState().fetchSettings();

    expect(useSettingsStore.getState().settings.defaultColor).toBe("#00ff00");
  });

  it("handles empty settings object from API", async () => {
    const { getSettings } = await import("../api/settings");
    vi.mocked(getSettings).mockResolvedValue({});

    await useSettingsStore.getState().fetchSettings();

    expect(useSettingsStore.getState().settings).toEqual({});
    expect(useSettingsStore.getState().loaded).toBe(true);
  });

  it("handles partial settings from API", async () => {
    const { getSettings } = await import("../api/settings");
    vi.mocked(getSettings).mockResolvedValue({
      defaultPenStyle: "ballpoint",
    });

    await useSettingsStore.getState().fetchSettings();

    const state = useSettingsStore.getState();
    expect(state.settings.defaultPenStyle).toBe("ballpoint");
    expect(state.settings.defaultColor).toBeUndefined();
  });
});

describe("updateSettings", () => {
  it("merges updates with existing settings", async () => {
    const { saveSettings } = await import("../api/settings");
    const initial = makeSettings({ defaultColor: "#000000" });
    useSettingsStore.setState({ settings: initial, loaded: true });

    const savedResult = { ...initial, defaultColor: "#ff0000" };
    vi.mocked(saveSettings).mockResolvedValue(savedResult);

    await useSettingsStore.getState().updateSettings({ defaultColor: "#ff0000" });

    expect(useSettingsStore.getState().settings.defaultColor).toBe("#ff0000");
    expect(useSettingsStore.getState().settings.defaultPenStyle).toBe("pressure");
  });

  it("calls saveSettings with merged settings", async () => {
    const { saveSettings } = await import("../api/settings");
    const initial = makeSettings();
    useSettingsStore.setState({ settings: initial, loaded: true });

    vi.mocked(saveSettings).mockResolvedValue({ ...initial, autoTranscribe: true });

    await useSettingsStore.getState().updateSettings({ autoTranscribe: true });

    expect(saveSettings).toHaveBeenCalledWith({
      ...initial,
      autoTranscribe: true,
    });
  });

  it("applies optimistic update immediately", async () => {
    const { saveSettings } = await import("../api/settings");
    const initial = makeSettings({ defaultStrokeWidth: 2 });
    useSettingsStore.setState({ settings: initial, loaded: true });

    let resolvePromise: (value: AppSettings) => void;
    vi.mocked(saveSettings).mockImplementation(
      () => new Promise((resolve) => { resolvePromise = resolve; }),
    );

    const updatePromise = useSettingsStore.getState().updateSettings({ defaultStrokeWidth: 5 });

    // Should be updated optimistically before API returns
    expect(useSettingsStore.getState().settings.defaultStrokeWidth).toBe(5);

    resolvePromise!({ ...initial, defaultStrokeWidth: 5 });
    await updatePromise;

    expect(useSettingsStore.getState().settings.defaultStrokeWidth).toBe(5);
  });

  it("uses server response as final state", async () => {
    const { saveSettings } = await import("../api/settings");
    const initial = makeSettings({ defaultStrokeWidth: 2 });
    useSettingsStore.setState({ settings: initial, loaded: true });

    // Server returns different value (e.g., clamped value)
    vi.mocked(saveSettings).mockResolvedValue({ ...initial, defaultStrokeWidth: 10 });

    await useSettingsStore.getState().updateSettings({ defaultStrokeWidth: 100 });

    // Final state should be what server returned
    expect(useSettingsStore.getState().settings.defaultStrokeWidth).toBe(10);
  });

  it("handles updating from empty settings", async () => {
    const { saveSettings } = await import("../api/settings");
    useSettingsStore.setState({ settings: {}, loaded: true });

    const serverResponse = { defaultPenStyle: "uniform" as const };
    vi.mocked(saveSettings).mockResolvedValue(serverResponse);

    await useSettingsStore.getState().updateSettings({ defaultPenStyle: "uniform" });

    expect(saveSettings).toHaveBeenCalledWith({ defaultPenStyle: "uniform" });
    expect(useSettingsStore.getState().settings.defaultPenStyle).toBe("uniform");
  });

  it("handles multiple simultaneous updates", async () => {
    const { saveSettings } = await import("../api/settings");
    const initial = makeSettings();
    useSettingsStore.setState({ settings: initial, loaded: true });

    vi.mocked(saveSettings)
      .mockResolvedValueOnce({ ...initial, defaultColor: "#ff0000" })
      .mockResolvedValueOnce({ ...initial, defaultColor: "#ff0000", defaultStrokeWidth: 5 });

    await Promise.all([
      useSettingsStore.getState().updateSettings({ defaultColor: "#ff0000" }),
      useSettingsStore.getState().updateSettings({ defaultStrokeWidth: 5 }),
    ]);

    // Last response wins
    const state = useSettingsStore.getState();
    expect(state.settings.defaultStrokeWidth).toBe(5);
  });

  it("propagates API errors to the caller", async () => {
    const { saveSettings } = await import("../api/settings");
    useSettingsStore.setState({ settings: makeSettings(), loaded: true });

    vi.mocked(saveSettings).mockRejectedValue(new Error("Server error"));

    await expect(
      useSettingsStore.getState().updateSettings({ defaultColor: "#ff0000" }),
    ).rejects.toThrow("Server error");
  });

  it("retains optimistic update after API error", async () => {
    const { saveSettings } = await import("../api/settings");
    const initial = makeSettings({ defaultColor: "#000000" });
    useSettingsStore.setState({ settings: initial, loaded: true });

    vi.mocked(saveSettings).mockRejectedValue(new Error("Network error"));

    try {
      await useSettingsStore.getState().updateSettings({ defaultColor: "#ff0000" });
    } catch {
      // expected
    }

    // Note: Current implementation doesn't rollback on error
    // This test documents the current behavior
    expect(useSettingsStore.getState().settings.defaultColor).toBe("#ff0000");
  });
});

describe("edge cases", () => {
  it("handles undefined values in updates", async () => {
    const { saveSettings } = await import("../api/settings");
    const initial = makeSettings({ autoTranscribe: true });
    useSettingsStore.setState({ settings: initial, loaded: true });

    vi.mocked(saveSettings).mockResolvedValue({ ...initial, autoTranscribe: undefined });

    await useSettingsStore.getState().updateSettings({ autoTranscribe: undefined });

    expect(useSettingsStore.getState().settings.autoTranscribe).toBeUndefined();
  });

  it("handles all setting types", async () => {
    const { saveSettings } = await import("../api/settings");
    useSettingsStore.setState({ settings: {}, loaded: true });

    const fullSettings: AppSettings = {
      defaultPenStyle: "ballpoint",
      defaultColor: "#123456",
      defaultStrokeWidth: 4,
      defaultGridType: "dotgrid",
      defaultBackgroundLineSpacing: 48,
      defaultViewMode: "overview",
      autoTranscribe: true,
    };

    vi.mocked(saveSettings).mockResolvedValue(fullSettings);

    await useSettingsStore.getState().updateSettings(fullSettings);

    expect(useSettingsStore.getState().settings).toEqual(fullSettings);
  });
});
