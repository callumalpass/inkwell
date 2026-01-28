import { useEffect } from "react";
import { useTranscriptionStore } from "../../stores/transcription-store";

export function TranscriptionPanel() {
  const panelOpen = useTranscriptionStore((s) => s.panelOpen);
  const panelPageId = useTranscriptionStore((s) => s.panelPageId);
  const closePanel = useTranscriptionStore((s) => s.closePanel);
  const info = useTranscriptionStore(
    (s) => (panelPageId ? s.transcriptions[panelPageId] : undefined),
  );
  const loadTranscription = useTranscriptionStore((s) => s.loadTranscription);
  const triggerTranscription = useTranscriptionStore((s) => s.triggerTranscription);

  useEffect(() => {
    if (panelPageId) {
      loadTranscription(panelPageId);
    }
  }, [panelPageId, loadTranscription]);

  if (!panelOpen || !panelPageId) return null;

  const status = info?.status ?? "none";
  const content = info?.content ?? "";
  const error = info?.error;

  return (
    <div
      className="fixed inset-y-0 right-0 z-50 flex w-96 flex-col border-l border-gray-200 bg-white shadow-lg"
      data-testid="transcription-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h2 className="text-sm font-medium text-gray-900">Transcription</h2>
        <div className="flex items-center gap-2">
          {status === "complete" && (
            <button
              onClick={() => triggerTranscription(panelPageId, true)}
              className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
              data-testid="panel-retranscribe"
            >
              Re-transcribe
            </button>
          )}
          {(status === "none" || status === "failed") && (
            <button
              onClick={() => triggerTranscription(panelPageId, status === "failed")}
              className="rounded bg-gray-900 px-3 py-1 text-xs text-white hover:bg-gray-800"
              data-testid="panel-transcribe"
            >
              Transcribe
            </button>
          )}
          <button
            onClick={closePanel}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            data-testid="panel-close"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M4 4L12 12M12 4L4 12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Status bar */}
      {status !== "none" && status !== "complete" && (
        <div className="border-b border-gray-100 px-4 py-2">
          {status === "pending" && (
            <span className="text-xs text-yellow-600">Queued for transcription…</span>
          )}
          {status === "processing" && (
            <span className="text-xs text-blue-600">Transcribing…</span>
          )}
          {status === "failed" && (
            <span className="text-xs text-red-600">
              Failed: {error || "Unknown error"}
            </span>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {content ? (
          <div
            className="prose prose-sm max-w-none whitespace-pre-wrap text-gray-800"
            data-testid="transcription-content"
          >
            {content}
          </div>
        ) : (
          <p className="text-sm text-gray-400">
            {status === "none"
              ? "No transcription yet. Click 'Transcribe' to start."
              : status === "failed"
                ? "Transcription failed. Try again."
                : "Waiting for transcription…"}
          </p>
        )}
      </div>
    </div>
  );
}
