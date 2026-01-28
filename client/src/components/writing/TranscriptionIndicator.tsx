import { useEffect } from "react";
import { useTranscriptionStore } from "../../stores/transcription-store";
import type { TranscriptionStatus } from "../../api/transcription";

const STATUS_LABELS: Record<TranscriptionStatus, string> = {
  none: "Not transcribed",
  pending: "Queued…",
  processing: "Transcribing…",
  complete: "Transcribed",
  failed: "Failed",
};

const STATUS_COLORS: Record<TranscriptionStatus, string> = {
  none: "text-gray-400",
  pending: "text-yellow-600",
  processing: "text-blue-600",
  complete: "text-green-600",
  failed: "text-red-600",
};

interface Props {
  pageId: string;
}

export function TranscriptionIndicator({ pageId }: Props) {
  const info = useTranscriptionStore((s) => s.transcriptions[pageId]);
  const loadTranscription = useTranscriptionStore((s) => s.loadTranscription);
  const triggerTranscription = useTranscriptionStore((s) => s.triggerTranscription);
  const openPanel = useTranscriptionStore((s) => s.openPanel);

  useEffect(() => {
    loadTranscription(pageId);
  }, [pageId, loadTranscription]);

  const status: TranscriptionStatus = info?.status ?? "none";

  const isAnimating = status === "pending" || status === "processing";

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => openPanel(pageId)}
        className={`rounded px-2 py-1 text-xs ${STATUS_COLORS[status]} hover:bg-gray-100`}
        title={`Transcription: ${STATUS_LABELS[status]}`}
        data-testid="transcription-indicator"
      >
        {isAnimating && (
          <span className="mr-1 inline-block animate-pulse">●</span>
        )}
        {STATUS_LABELS[status]}
      </button>
      {(status === "none" || status === "failed") && (
        <button
          onClick={() => triggerTranscription(pageId, status === "failed")}
          className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
          title="Transcribe now"
          data-testid="transcribe-button"
        >
          Transcribe
        </button>
      )}
      {status === "complete" && (
        <button
          onClick={() => triggerTranscription(pageId, true)}
          className="rounded px-2 py-1 text-xs text-gray-400 hover:bg-gray-100"
          title="Re-transcribe"
          data-testid="retranscribe-button"
        >
          Redo
        </button>
      )}
    </div>
  );
}
