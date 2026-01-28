import { BTN, BTN_ACTIVE, BTN_INACTIVE, BTN_DISABLED } from "./styles";

export interface OverviewToolbarProps {
  selectedCount: number;
  transcribing: boolean;
  duplicating: boolean;
  deleting: boolean;
  moving: boolean;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onAddTags: () => void;
  onRemoveTags: () => void;
  onExport: () => void;
  onDuplicate: () => void;
  onMove: () => void;
  onTranscribeSelected: () => void;
  onTranscribeAll: () => void;
  onDelete: () => void;
}

export function OverviewToolbar({
  selectedCount,
  transcribing,
  duplicating,
  deleting,
  moving,
  onSelectAll,
  onClearSelection,
  onAddTags,
  onRemoveTags,
  onExport,
  onDuplicate,
  onMove,
  onTranscribeSelected,
  onTranscribeAll,
  onDelete,
}: OverviewToolbarProps) {
  const hasSelection = selectedCount > 0;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700">
          Overview (read-only)
        </span>
        <span
          className="hidden text-xs text-gray-400 sm:inline"
          title="Arrow keys navigate, Enter opens, Space selects"
        >
          {"\u2190 \u2192 \u2191 \u2193"} navigate · Enter open · Space select
        </span>
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-500">Selected: {selectedCount}</span>
        <button onClick={onSelectAll} className={`${BTN} ${BTN_INACTIVE}`}>
          Select All
        </button>
        <button onClick={onClearSelection} className={`${BTN} ${BTN_INACTIVE}`}>
          Clear
        </button>
        <button
          onClick={onAddTags}
          className={`${BTN} ${hasSelection ? BTN_ACTIVE : `${BTN_INACTIVE} ${BTN_DISABLED}`}`}
          disabled={!hasSelection}
        >
          Add Tags
        </button>
        <button
          onClick={onRemoveTags}
          className={`${BTN} ${hasSelection ? BTN_INACTIVE : `${BTN_INACTIVE} ${BTN_DISABLED}`}`}
          disabled={!hasSelection}
        >
          Remove Tags
        </button>
        <button
          onClick={onExport}
          className={`${BTN} ${hasSelection ? BTN_INACTIVE : `${BTN_INACTIVE} ${BTN_DISABLED}`}`}
          disabled={!hasSelection}
        >
          Export
        </button>
        <button
          onClick={onDuplicate}
          className={`${BTN} ${hasSelection && !duplicating ? BTN_INACTIVE : `${BTN_INACTIVE} ${BTN_DISABLED}`}`}
          disabled={!hasSelection || duplicating}
        >
          {duplicating ? "Duplicating..." : "Duplicate"}
        </button>
        <button
          onClick={onMove}
          className={`${BTN} ${hasSelection && !moving ? BTN_INACTIVE : `${BTN_INACTIVE} ${BTN_DISABLED}`}`}
          disabled={!hasSelection || moving}
        >
          {moving ? "Moving..." : "Move"}
        </button>
        <button
          onClick={onTranscribeSelected}
          className={`${BTN} ${hasSelection && !transcribing ? BTN_INACTIVE : `${BTN_INACTIVE} ${BTN_DISABLED}`}`}
          disabled={!hasSelection || transcribing}
        >
          {transcribing ? "Transcribing..." : "Transcribe"}
        </button>
        <button
          onClick={onTranscribeAll}
          className={`${BTN} ${!transcribing ? BTN_INACTIVE : `${BTN_INACTIVE} ${BTN_DISABLED}`}`}
          disabled={transcribing}
          title="Transcribe all pages that haven't been transcribed yet"
        >
          Transcribe All
        </button>
        <button
          onClick={onDelete}
          className={`${BTN} ${hasSelection && !deleting ? "bg-red-600 text-white" : `${BTN_INACTIVE} ${BTN_DISABLED}`}`}
          disabled={!hasSelection || deleting}
        >
          {deleting ? "Deleting..." : "Delete"}
        </button>
      </div>
    </div>
  );
}
