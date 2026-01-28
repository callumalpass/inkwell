import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TranscriptionPanel } from "./TranscriptionPanel";
import { useTranscriptionStore } from "../../stores/transcription-store";

beforeEach(() => {
  useTranscriptionStore.setState({
    transcriptions: {},
    loading: {},
    panelOpen: false,
    panelPageId: null,
  });
});

describe("TranscriptionPanel", () => {
  it("does not render when panel is closed", () => {
    render(<TranscriptionPanel />);
    expect(screen.queryByTestId("transcription-panel")).not.toBeInTheDocument();
  });

  it("renders when panel is open", () => {
    useTranscriptionStore.setState({ panelOpen: true, panelPageId: "pg_1" });
    render(<TranscriptionPanel />);
    expect(screen.getByTestId("transcription-panel")).toBeInTheDocument();
  });

  it("shows empty state message when no transcription exists", () => {
    useTranscriptionStore.setState({ panelOpen: true, panelPageId: "pg_1" });
    render(<TranscriptionPanel />);
    expect(
      screen.getByText(/No transcription yet/),
    ).toBeInTheDocument();
  });

  it("shows transcription content when available", () => {
    useTranscriptionStore.setState({
      panelOpen: true,
      panelPageId: "pg_1",
      transcriptions: {
        pg_1: {
          status: "complete",
          content: "Hello world transcription",
          lastAttempt: new Date().toISOString(),
          error: null,
        },
      },
    });
    render(<TranscriptionPanel />);
    expect(screen.getByTestId("transcription-content")).toHaveTextContent(
      "Hello world transcription",
    );
  });

  it("shows processing status banner", () => {
    useTranscriptionStore.setState({
      panelOpen: true,
      panelPageId: "pg_1",
      transcriptions: {
        pg_1: {
          status: "processing",
          content: "",
          lastAttempt: null,
          error: null,
        },
      },
    });
    render(<TranscriptionPanel />);
    expect(screen.getByText(/Transcribing/)).toBeInTheDocument();
  });

  it("shows failed status with error message", () => {
    useTranscriptionStore.setState({
      panelOpen: true,
      panelPageId: "pg_1",
      transcriptions: {
        pg_1: {
          status: "failed",
          content: "",
          lastAttempt: new Date().toISOString(),
          error: "API rate limit exceeded",
        },
      },
    });
    render(<TranscriptionPanel />);
    expect(screen.getByText(/Failed.*API rate limit exceeded/)).toBeInTheDocument();
  });

  it("shows Re-transcribe button when complete", () => {
    useTranscriptionStore.setState({
      panelOpen: true,
      panelPageId: "pg_1",
      transcriptions: {
        pg_1: {
          status: "complete",
          content: "Some text",
          lastAttempt: new Date().toISOString(),
          error: null,
        },
      },
    });
    render(<TranscriptionPanel />);
    expect(screen.getByTestId("panel-retranscribe")).toBeInTheDocument();
  });

  it("shows Transcribe button when status is none", () => {
    useTranscriptionStore.setState({
      panelOpen: true,
      panelPageId: "pg_1",
      transcriptions: {
        pg_1: {
          status: "none",
          content: "",
          lastAttempt: null,
          error: null,
        },
      },
    });
    render(<TranscriptionPanel />);
    expect(screen.getByTestId("panel-transcribe")).toBeInTheDocument();
  });

  it("closes panel when close button is clicked", async () => {
    const user = userEvent.setup();
    useTranscriptionStore.setState({ panelOpen: true, panelPageId: "pg_1" });
    render(<TranscriptionPanel />);

    await user.click(screen.getByTestId("panel-close"));
    expect(useTranscriptionStore.getState().panelOpen).toBe(false);
  });
});
