import { useSettingsStore } from "../../stores/settings-store";
import type { AppSettings } from "../../api/settings";
import { COLOR_PRESETS } from "../../lib/constants";

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

const BTN =
  "rounded-md px-3 py-2 text-sm font-medium border border-transparent";
const BTN_ACTIVE = "bg-black text-white border-black";
const BTN_INACTIVE = "text-gray-800 border-gray-300 bg-white";

const PEN_STYLES = ["pressure", "uniform", "ballpoint"] as const;
const PEN_STYLE_LABELS: Record<string, string> = {
  pressure: "Pressure",
  uniform: "Uniform",
  ballpoint: "Ballpoint",
};

const WIDTHS = [2, 3, 5, 8];

const GRID_TYPES = ["none", "lined", "grid", "dotgrid"] as const;
const GRID_TYPE_LABELS: Record<string, string> = {
  none: "Plain",
  lined: "Lined",
  grid: "Grid",
  dotgrid: "Dots",
};

const VIEW_MODES = ["single", "scroll", "canvas"] as const;
const VIEW_MODE_LABELS: Record<string, string> = {
  single: "Single",
  scroll: "Scroll",
  canvas: "Canvas",
};

export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const { settings, updateSettings } = useSettingsStore();

  if (!open) return null;

  const set = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    updateSettings({ [key]: value });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button
            onClick={onClose}
            className="rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
          >
            Close
          </button>
        </div>

        <p className="mt-1 text-xs text-gray-500">
          Global defaults for new notebooks. Per-notebook settings override these.
        </p>

        <div className="mt-4 space-y-4">
          {/* Pen Style */}
          <SettingsRow label="Pen Style">
            <div className="flex flex-wrap gap-1">
              {PEN_STYLES.map((ps) => (
                <button
                  key={ps}
                  onClick={() => set("defaultPenStyle", ps)}
                  className={`${BTN} ${settings.defaultPenStyle === ps ? BTN_ACTIVE : BTN_INACTIVE}`}
                >
                  {PEN_STYLE_LABELS[ps]}
                </button>
              ))}
            </div>
          </SettingsRow>

          {/* Color */}
          <SettingsRow label="Color">
            <div className="flex flex-wrap gap-1">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.color}
                  onClick={() => set("defaultColor", preset.color)}
                  aria-label={preset.label}
                  className={`flex h-9 w-9 items-center justify-center rounded-md border-2 ${
                    settings.defaultColor === preset.color
                      ? "border-black"
                      : "border-gray-300"
                  }`}
                >
                  <span
                    className="rounded-full"
                    style={{
                      width: 18,
                      height: 18,
                      backgroundColor: preset.color,
                    }}
                  />
                </button>
              ))}
            </div>
          </SettingsRow>

          {/* Stroke Width */}
          <SettingsRow label="Width">
            <div className="flex flex-wrap gap-1">
              {WIDTHS.map((w) => (
                <button
                  key={w}
                  onClick={() => set("defaultStrokeWidth", w)}
                  className={`flex h-9 w-9 items-center justify-center rounded-md border ${
                    settings.defaultStrokeWidth === w
                      ? "border-black bg-gray-100"
                      : "border-gray-300 bg-white"
                  }`}
                >
                  <span
                    className="rounded-full bg-black"
                    style={{ width: w + 4, height: w + 4 }}
                  />
                </button>
              ))}
            </div>
          </SettingsRow>

          {/* Grid Type */}
          <SettingsRow label="Grid">
            <div className="flex flex-wrap gap-1">
              {GRID_TYPES.map((gt) => (
                <button
                  key={gt}
                  onClick={() => set("defaultGridType", gt)}
                  className={`${BTN} ${settings.defaultGridType === gt ? BTN_ACTIVE : BTN_INACTIVE}`}
                >
                  {GRID_TYPE_LABELS[gt]}
                </button>
              ))}
            </div>
          </SettingsRow>

          {/* View Mode */}
          <SettingsRow label="View">
            <div className="flex flex-wrap gap-1">
              {VIEW_MODES.map((vm) => (
                <button
                  key={vm}
                  onClick={() => set("defaultViewMode", vm)}
                  className={`${BTN} ${settings.defaultViewMode === vm ? BTN_ACTIVE : BTN_INACTIVE}`}
                >
                  {VIEW_MODE_LABELS[vm]}
                </button>
              ))}
            </div>
          </SettingsRow>

          {/* Auto-Transcribe */}
          <SettingsRow label="Auto-Transcribe">
            <div className="flex gap-1">
              <button
                onClick={() => set("autoTranscribe", true)}
                className={`${BTN} ${settings.autoTranscribe === true ? BTN_ACTIVE : BTN_INACTIVE}`}
              >
                On
              </button>
              <button
                onClick={() => set("autoTranscribe", false)}
                className={`${BTN} ${settings.autoTranscribe === false ? BTN_ACTIVE : BTN_INACTIVE}`}
              >
                Off
              </button>
            </div>
          </SettingsRow>
        </div>
      </div>
    </div>
  );
}

function SettingsRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-500">
        {label}
      </label>
      {children}
    </div>
  );
}
