import { useNotebookPagesStore } from "../../stores/notebook-pages-store";
import type { NotebookSettings } from "../../api/notebooks";
import { COLOR_PRESETS } from "../../lib/constants";

interface NotebookSettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

const BTN =
  "rounded-md px-3 py-2 text-sm font-medium border border-transparent";
const BTN_ACTIVE = "bg-black text-white border-black";
const BTN_INACTIVE = "text-gray-800 border-gray-300 bg-white";

const TOOLS = ["pen", "highlighter", "eraser"] as const;
const TOOL_LABELS: Record<string, string> = {
  pen: "Pen",
  highlighter: "Highlighter",
  eraser: "Eraser",
};

const WIDTHS = [2, 3, 5, 8];

const GRID_TYPES = ["none", "lined", "grid", "dotgrid"] as const;
const GRID_TYPE_LABELS: Record<string, string> = {
  none: "Plain",
  lined: "Lined",
  grid: "Grid",
  dotgrid: "Dots",
};

export function NotebookSettingsDialog({
  open,
  onClose,
}: NotebookSettingsDialogProps) {
  const settings = useNotebookPagesStore((s) => s.settings);
  const updateSettings = useNotebookPagesStore((s) => s.updateSettings);

  if (!open) return null;

  const set = <K extends keyof NotebookSettings>(
    key: K,
    value: NotebookSettings[K],
  ) => {
    updateSettings({ [key]: value });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      data-testid="notebook-settings-dialog"
    >
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Notebook Settings</h2>
          <button
            onClick={onClose}
            className="rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
            data-testid="notebook-settings-close"
          >
            Close
          </button>
        </div>

        <p className="mt-1 text-xs text-gray-500">
          Defaults for this notebook. These override global settings.
        </p>

        <div className="mt-4 space-y-4">
          {/* Default Tool */}
          <SettingsRow label="Default Tool">
            <div className="flex flex-wrap gap-1">
              {TOOLS.map((tool) => (
                <button
                  key={tool}
                  onClick={() => set("defaultTool", tool)}
                  className={`${BTN} ${settings.defaultTool === tool ? BTN_ACTIVE : BTN_INACTIVE}`}
                  data-testid={`nb-setting-tool-${tool}`}
                >
                  {TOOL_LABELS[tool]}
                </button>
              ))}
            </div>
          </SettingsRow>

          {/* Default Color */}
          <SettingsRow label="Default Color">
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
                  data-testid={`nb-setting-color-${preset.label.toLowerCase()}`}
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

          {/* Default Stroke Width */}
          <SettingsRow label="Default Width">
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
                  data-testid={`nb-setting-width-${w}`}
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
                  onClick={() => set("gridType", gt)}
                  className={`${BTN} ${settings.gridType === gt ? BTN_ACTIVE : BTN_INACTIVE}`}
                  data-testid={`nb-setting-grid-${gt}`}
                >
                  {GRID_TYPE_LABELS[gt]}
                </button>
              ))}
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
