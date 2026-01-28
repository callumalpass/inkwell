import { useEffect, useState } from "react";
import { useMarkdownConfigStore } from "../../stores/markdown-config-store";

const BTN =
  "rounded-md px-3 py-2 text-sm font-medium border border-transparent";
const BTN_ACTIVE = "bg-black text-white border-black";
const BTN_INACTIVE = "text-gray-800 border-gray-300 bg-white";

const INPUT =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-gray-500 focus:outline-none";

const TEMPLATE_VARS = [
  { var: "{{page.id}}", desc: "Page ID" },
  { var: "{{page.seq}}", desc: "Page number" },
  { var: "{{page.created}}", desc: "Creation date (ISO)" },
  { var: "{{page.modified}}", desc: "Modified date (ISO)" },
  { var: "{{page.tags}}", desc: "Tags (YAML array)" },
  { var: "{{notebook.id}}", desc: "Notebook ID" },
  { var: "{{notebook.name}}", desc: "Notebook title" },
  { var: "{{transcription.firstLine}}", desc: "First line of transcription" },
];

export function MarkdownConfigPanel() {
  const config = useMarkdownConfigStore((s) => s.config);
  const loading = useMarkdownConfigStore((s) => s.loading);
  const error = useMarkdownConfigStore((s) => s.error);
  const syncStatus = useMarkdownConfigStore((s) => s.syncStatus);
  const fetchConfig = useMarkdownConfigStore((s) => s.fetchConfig);
  const fetchSyncStatus = useMarkdownConfigStore((s) => s.fetchSyncStatus);
  const updateFrontmatter = useMarkdownConfigStore((s) => s.updateFrontmatter);
  const updateSync = useMarkdownConfigStore((s) => s.updateSync);

  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  useEffect(() => {
    fetchConfig();
    fetchSyncStatus();
  }, [fetchConfig, fetchSyncStatus]);

  if (loading && !config) {
    return <p className="py-4 text-center text-sm text-gray-400">Loading...</p>;
  }

  if (!config) {
    return (
      <p className="py-4 text-center text-sm text-red-500">
        {error || "Failed to load markdown config"}
      </p>
    );
  }

  const { frontmatter, sync } = config;

  const handleTemplateChange = (key: string, value: string) => {
    updateFrontmatter({
      template: { ...frontmatter.template, [key]: value },
    });
  };

  const handleTemplateRemove = (key: string) => {
    const next = { ...frontmatter.template };
    delete next[key];
    updateFrontmatter({ template: next });
  };

  const handleAddField = () => {
    const trimmedKey = newKey.trim();
    if (!trimmedKey || frontmatter.template[trimmedKey] !== undefined) return;
    updateFrontmatter({
      template: { ...frontmatter.template, [trimmedKey]: newValue },
    });
    setNewKey("");
    setNewValue("");
  };

  return (
    <div className="space-y-5" data-testid="markdown-config-panel">
      {/* Section: Frontmatter */}
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Frontmatter</h3>
          <ToggleButton
            on={frontmatter.enabled}
            onToggle={(v) => updateFrontmatter({ enabled: v })}
            testId="frontmatter-toggle"
          />
        </div>

        {frontmatter.enabled && (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-gray-500">
              YAML frontmatter fields added to synced markdown files.
            </p>

            {/* Template fields */}
            <div className="space-y-1.5" data-testid="frontmatter-fields">
              {Object.entries(frontmatter.template).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="w-24 shrink-0 text-xs font-medium text-gray-600">
                    {key}
                  </span>
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => handleTemplateChange(key, e.target.value)}
                    className={`${INPUT} flex-1`}
                    data-testid={`frontmatter-field-${key}`}
                  />
                  <button
                    onClick={() => handleTemplateRemove(key)}
                    className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                    aria-label={`Remove ${key}`}
                    data-testid={`frontmatter-remove-${key}`}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path
                        d="M3 3L11 11M11 3L3 11"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            {/* Add new field */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="field name"
                className={`${INPUT} w-24 shrink-0`}
                data-testid="frontmatter-new-key"
              />
              <input
                type="text"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="{{page.id}}"
                className={`${INPUT} flex-1`}
                data-testid="frontmatter-new-value"
              />
              <button
                onClick={handleAddField}
                disabled={!newKey.trim()}
                className={`${BTN} ${BTN_INACTIVE} shrink-0 disabled:opacity-50`}
                data-testid="frontmatter-add"
              >
                Add
              </button>
            </div>

            {/* Variable reference */}
            <details className="pt-1">
              <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700">
                Template variables
              </summary>
              <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-gray-500">
                {TEMPLATE_VARS.map((tv) => (
                  <div key={tv.var}>
                    <code className="text-gray-700">{tv.var}</code>
                    <span className="ml-1">— {tv.desc}</span>
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}
      </div>

      {/* Section: Sync */}
      <div className="border-t border-gray-200 pt-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Markdown Sync</h3>
          <ToggleButton
            on={sync.enabled}
            onToggle={(v) => updateSync({ enabled: v })}
            testId="sync-toggle"
          />
        </div>

        {sync.enabled && (
          <div className="mt-3 space-y-3">
            {/* Destination path */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Destination Path
              </label>
              <input
                type="text"
                value={sync.destination}
                onChange={(e) => updateSync({ destination: e.target.value })}
                placeholder="/path/to/obsidian/vault"
                className={INPUT}
                data-testid="sync-destination"
              />
            </div>

            {/* Filename template */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Filename Template
              </label>
              <input
                type="text"
                value={sync.filenameTemplate}
                onChange={(e) => updateSync({ filenameTemplate: e.target.value })}
                placeholder="{{notebook.name}}/{{page.seq}}-{{page.id}}.md"
                className={INPUT}
                data-testid="sync-filename-template"
              />
              <p className="mt-0.5 text-xs text-gray-400">
                Supports template variables. Subdirectories will be created automatically.
              </p>
            </div>

            {/* Auto-sync toggles */}
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={sync.syncOnTranscription}
                  onChange={(e) =>
                    updateSync({ syncOnTranscription: e.target.checked })
                  }
                  className="rounded border-gray-300"
                  data-testid="sync-on-transcription"
                />
                Sync on transcription
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={sync.syncOnManual}
                  onChange={(e) =>
                    updateSync({ syncOnManual: e.target.checked })
                  }
                  className="rounded border-gray-300"
                  data-testid="sync-on-manual"
                />
                Sync on manual trigger
              </label>
            </div>

            {/* Sync status */}
            {syncStatus && (
              <div
                className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600"
                data-testid="sync-status"
              >
                <div>
                  Total synced:{" "}
                  <span className="font-medium">{syncStatus.totalSynced}</span>
                </div>
                {syncStatus.lastSync && (
                  <div>
                    Last sync:{" "}
                    <span className="font-medium">
                      {new Date(syncStatus.lastSync).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600" data-testid="markdown-config-error">
          {error}
        </p>
      )}
    </div>
  );
}

function ToggleButton({
  on,
  onToggle,
  testId,
}: {
  on: boolean;
  onToggle: (value: boolean) => void;
  testId: string;
}) {
  return (
    <div className="flex gap-1">
      <button
        onClick={() => onToggle(true)}
        className={`${BTN} text-xs ${on ? BTN_ACTIVE : BTN_INACTIVE}`}
        data-testid={`${testId}-on`}
      >
        On
      </button>
      <button
        onClick={() => onToggle(false)}
        className={`${BTN} text-xs ${!on ? BTN_ACTIVE : BTN_INACTIVE}`}
        data-testid={`${testId}-off`}
      >
        Off
      </button>
    </div>
  );
}
