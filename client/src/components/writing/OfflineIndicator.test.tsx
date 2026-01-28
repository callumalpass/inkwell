import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { OfflineIndicator } from "./OfflineIndicator";
import * as offlineQueue from "../../lib/offline-queue";

vi.mock("../../lib/offline-queue", () => ({
  pendingCount: vi.fn(),
}));

describe("OfflineIndicator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    vi.mocked(offlineQueue.pendingCount).mockResolvedValue(0);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renders nothing when online with no queued items", async () => {
    const { container } = render(<OfflineIndicator />);
    // Flush pending promises
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(container.querySelector("[data-testid='offline-indicator']")).toBeNull();
  });

  it("shows 'Offline' when browser is offline", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);

    render(<OfflineIndicator />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByText("Offline")).toBeInTheDocument();
  });

  it("shows syncing message when online with queued items", async () => {
    vi.mocked(offlineQueue.pendingCount).mockResolvedValue(3);

    render(<OfflineIndicator />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByText("Syncing 3 batches...")).toBeInTheDocument();
  });

  it("uses singular 'batch' for count of 1", async () => {
    vi.mocked(offlineQueue.pendingCount).mockResolvedValue(1);

    render(<OfflineIndicator />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByText("Syncing 1 batch...")).toBeInTheDocument();
  });

  it("shows red dot when offline", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);

    const { container } = render(<OfflineIndicator />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    const dot = container.querySelector(".bg-red-500");
    expect(dot).not.toBeNull();
  });

  it("shows yellow dot when syncing", async () => {
    vi.mocked(offlineQueue.pendingCount).mockResolvedValue(2);

    const { container } = render(<OfflineIndicator />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    const dot = container.querySelector(".bg-yellow-500");
    expect(dot).not.toBeNull();
  });
});
