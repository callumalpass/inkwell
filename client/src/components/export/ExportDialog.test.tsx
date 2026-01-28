import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExportDialog } from "./ExportDialog";
import * as exportApi from "../../api/export";

vi.mock("../../api/export", () => ({
  exportPagePdf: vi.fn(() => Promise.resolve()),
  exportPagePng: vi.fn(() => Promise.resolve()),
  exportNotebookPdf: vi.fn(() => Promise.resolve()),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ExportDialog", () => {
  it("does not render when closed", () => {
    render(<ExportDialog open={false} onClose={() => {}} pageId="pg_1" />);
    expect(screen.queryByTestId("export-dialog")).not.toBeInTheDocument();
  });

  it("renders when open with page export mode", () => {
    render(<ExportDialog open={true} onClose={() => {}} pageId="pg_1" />);
    expect(screen.getByTestId("export-dialog")).toBeInTheDocument();
    expect(screen.getByText("Export Page")).toBeInTheDocument();
  });

  it("renders notebook export mode when notebookId is set without pageId", () => {
    render(
      <ExportDialog
        open={true}
        onClose={() => {}}
        notebookId="nb_1"
        notebookTitle="My Notebook"
      />,
    );
    expect(screen.getByText("Export Notebook")).toBeInTheDocument();
  });

  it("shows format selector for page export", () => {
    render(<ExportDialog open={true} onClose={() => {}} pageId="pg_1" />);
    expect(screen.getByTestId("format-pdf")).toBeInTheDocument();
    expect(screen.getByTestId("format-png")).toBeInTheDocument();
  });

  it("does not show format selector for notebook export", () => {
    render(
      <ExportDialog
        open={true}
        onClose={() => {}}
        notebookId="nb_1"
        notebookTitle="Test"
      />,
    );
    expect(screen.queryByTestId("format-pdf")).not.toBeInTheDocument();
    expect(screen.queryByTestId("format-png")).not.toBeInTheDocument();
  });

  it("shows PDF options by default for page export", () => {
    render(<ExportDialog open={true} onClose={() => {}} pageId="pg_1" />);
    expect(screen.getByTestId("pagesize-original")).toBeInTheDocument();
    expect(screen.getByTestId("pagesize-a4")).toBeInTheDocument();
    expect(screen.getByTestId("pagesize-letter")).toBeInTheDocument();
    expect(screen.getByTestId("include-transcription")).toBeInTheDocument();
  });

  it("shows PDF options for notebook export", () => {
    render(
      <ExportDialog
        open={true}
        onClose={() => {}}
        notebookId="nb_1"
        notebookTitle="Test"
      />,
    );
    expect(screen.getByTestId("pagesize-original")).toBeInTheDocument();
    expect(screen.getByTestId("include-transcription")).toBeInTheDocument();
  });

  it("shows PNG scale options when PNG format is selected", async () => {
    const user = userEvent.setup();
    render(<ExportDialog open={true} onClose={() => {}} pageId="pg_1" />);

    await user.click(screen.getByTestId("format-png"));
    expect(screen.getByTestId("scale-1")).toBeInTheDocument();
    expect(screen.getByTestId("scale-2")).toBeInTheDocument();
    expect(screen.getByTestId("scale-3")).toBeInTheDocument();
    expect(screen.getByTestId("scale-4")).toBeInTheDocument();
    // PDF-only options should be hidden
    expect(screen.queryByTestId("pagesize-original")).not.toBeInTheDocument();
    expect(screen.queryByTestId("include-transcription")).not.toBeInTheDocument();
  });

  it("calls onClose when Cancel is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ExportDialog open={true} onClose={onClose} pageId="pg_1" />);

    await user.click(screen.getByTestId("export-cancel"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when clicking the overlay background", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ExportDialog open={true} onClose={onClose} pageId="pg_1" />);

    await user.click(screen.getByTestId("export-dialog-overlay"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not call onClose when clicking inside the dialog", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ExportDialog open={true} onClose={onClose} pageId="pg_1" />);

    await user.click(screen.getByTestId("export-dialog"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("exports page as PDF with default options", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ExportDialog open={true} onClose={onClose} pageId="pg_1" />);

    await user.click(screen.getByTestId("export-submit"));
    expect(exportApi.exportPagePdf).toHaveBeenCalledWith("pg_1", {
      includeTranscription: false,
      pageSize: "original",
    });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("exports page as PDF with custom options", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ExportDialog open={true} onClose={onClose} pageId="pg_1" />);

    await user.click(screen.getByTestId("pagesize-a4"));
    await user.click(screen.getByTestId("include-transcription"));
    await user.click(screen.getByTestId("export-submit"));

    expect(exportApi.exportPagePdf).toHaveBeenCalledWith("pg_1", {
      includeTranscription: true,
      pageSize: "a4",
    });
  });

  it("exports page as PNG with selected scale", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ExportDialog open={true} onClose={onClose} pageId="pg_1" />);

    await user.click(screen.getByTestId("format-png"));
    await user.click(screen.getByTestId("scale-3"));
    await user.click(screen.getByTestId("export-submit"));

    expect(exportApi.exportPagePng).toHaveBeenCalledWith("pg_1", { scale: 3 });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("exports notebook as PDF", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <ExportDialog
        open={true}
        onClose={onClose}
        notebookId="nb_1"
        notebookTitle="My Notebook"
      />,
    );

    await user.click(screen.getByTestId("export-submit"));
    expect(exportApi.exportNotebookPdf).toHaveBeenCalledWith(
      "nb_1",
      "My Notebook",
      {
        includeTranscription: false,
        pageSize: "original",
      },
    );
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows error message when export fails", async () => {
    vi.mocked(exportApi.exportPagePdf).mockRejectedValueOnce(
      new Error("Server error"),
    );
    const user = userEvent.setup();
    render(<ExportDialog open={true} onClose={() => {}} pageId="pg_1" />);

    await user.click(screen.getByTestId("export-submit"));
    expect(screen.getByTestId("export-error")).toHaveTextContent("Server error");
  });

  it("disables Export button while exporting", async () => {
    let resolve: () => void;
    vi.mocked(exportApi.exportPagePdf).mockReturnValueOnce(
      new Promise<void>((r) => {
        resolve = r;
      }),
    );
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ExportDialog open={true} onClose={onClose} pageId="pg_1" />);

    await user.click(screen.getByTestId("export-submit"));
    expect(screen.getByTestId("export-submit")).toBeDisabled();
    expect(screen.getByTestId("export-submit")).toHaveTextContent("Exporting\u2026");

    // Resolve the promise and wait for state to settle
    resolve!();
    // Wait for the export to complete and dialog to close
    await vi.waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("closes on Escape key press", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ExportDialog open={true} onClose={onClose} pageId="pg_1" />);

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("resets state when reopened", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <ExportDialog open={true} onClose={() => {}} pageId="pg_1" />,
    );

    // Switch to PNG and 3x scale
    await user.click(screen.getByTestId("format-png"));
    await user.click(screen.getByTestId("scale-3"));
    expect(screen.getByTestId("scale-3")).toHaveClass(/bg-black/);

    // Close and reopen
    rerender(<ExportDialog open={false} onClose={() => {}} pageId="pg_1" />);
    rerender(<ExportDialog open={true} onClose={() => {}} pageId="pg_1" />);

    // Should be back to PDF format (default)
    expect(screen.getByTestId("format-pdf")).toHaveClass(/bg-black/);
    expect(screen.getByTestId("pagesize-original")).toBeInTheDocument();
  });
});
