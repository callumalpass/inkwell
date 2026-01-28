import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TranscriptionIndicator } from "./TranscriptionIndicator";
import { useTranscriptionStore } from "../../stores/transcription-store";

beforeEach(() => {
  useTranscriptionStore.setState({
    transcriptions: {},
    loading: {},
    panelOpen: false,
    panelPageId: null,
  });
});

describe("TranscriptionIndicator", () => {
  it("shows 'Not transcribed' for a page with no transcription", () => {
    render(<TranscriptionIndicator pageId="pg_1" />);
    expect(screen.getByText("Not transcribed")).toBeInTheDocument();
  });

  it("shows 'Transcribe' button for pages with no transcription", () => {
    render(<TranscriptionIndicator pageId="pg_1" />);
    expect(screen.getByTestId("transcribe-button")).toBeInTheDocument();
  });

  it("shows 'Queued…' when status is pending", () => {
    useTranscriptionStore.getState().updateStatus("pg_1", "pending");
    render(<TranscriptionIndicator pageId="pg_1" />);
    expect(screen.getByText(/Queued/)).toBeInTheDocument();
  });

  it("shows 'Transcribing…' when status is processing", () => {
    useTranscriptionStore.getState().updateStatus("pg_1", "processing");
    render(<TranscriptionIndicator pageId="pg_1" />);
    expect(screen.getByText(/Transcribing/)).toBeInTheDocument();
  });

  it("shows 'Transcribed' and 'Redo' button when complete", () => {
    useTranscriptionStore.getState().updateStatus("pg_1", "complete", "content");
    render(<TranscriptionIndicator pageId="pg_1" />);
    expect(screen.getByText("Transcribed")).toBeInTheDocument();
    expect(screen.getByTestId("retranscribe-button")).toBeInTheDocument();
  });

  it("shows 'Failed' and 'Transcribe' button when failed", () => {
    useTranscriptionStore.getState().updateStatus("pg_1", "failed", undefined, "Error");
    render(<TranscriptionIndicator pageId="pg_1" />);
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByTestId("transcribe-button")).toBeInTheDocument();
  });

  it("opens panel when clicking on the status text", async () => {
    const user = userEvent.setup();
    render(<TranscriptionIndicator pageId="pg_1" />);

    await user.click(screen.getByTestId("transcription-indicator"));
    expect(useTranscriptionStore.getState().panelOpen).toBe(true);
    expect(useTranscriptionStore.getState().panelPageId).toBe("pg_1");
  });
});
