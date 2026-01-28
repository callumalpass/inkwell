import {
  useToastStore,
  showToast,
  showError,
  showSuccess,
  showInfo,
  type Toast,
} from "./toast-store";

beforeEach(() => {
  useToastStore.setState({ toasts: [] });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("initial state", () => {
  it("starts with empty toasts array", () => {
    expect(useToastStore.getState().toasts).toEqual([]);
  });
});

describe("addToast", () => {
  it("adds a toast to the store", () => {
    const id = useToastStore.getState().addToast({
      type: "success",
      message: "Operation successful",
    });

    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toMatchObject({
      id,
      type: "success",
      message: "Operation successful",
    });
  });

  it("returns a unique toast id", () => {
    const id1 = useToastStore.getState().addToast({
      type: "info",
      message: "First toast",
    });
    const id2 = useToastStore.getState().addToast({
      type: "info",
      message: "Second toast",
    });

    expect(id1).toBeTruthy();
    expect(id2).toBeTruthy();
    expect(id1).not.toBe(id2);
  });

  it("generates ids with toast- prefix", () => {
    const id = useToastStore.getState().addToast({
      type: "success",
      message: "Test",
    });
    expect(id).toMatch(/^toast-\d+$/);
  });

  it("adds multiple toasts in order", () => {
    useToastStore.getState().addToast({ type: "info", message: "First" });
    useToastStore.getState().addToast({ type: "success", message: "Second" });
    useToastStore.getState().addToast({ type: "error", message: "Third" });

    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(3);
    expect(toasts[0].message).toBe("First");
    expect(toasts[1].message).toBe("Second");
    expect(toasts[2].message).toBe("Third");
  });

  it("preserves custom duration in toast object", () => {
    useToastStore.getState().addToast({
      type: "info",
      message: "Custom duration",
      duration: 10000,
    });

    const toast = useToastStore.getState().toasts[0];
    expect(toast.duration).toBe(10000);
  });
});

describe("auto-removal timing", () => {
  it("auto-removes success toast after 3 seconds by default", () => {
    useToastStore.getState().addToast({
      type: "success",
      message: "Success message",
    });

    expect(useToastStore.getState().toasts).toHaveLength(1);

    vi.advanceTimersByTime(2999);
    expect(useToastStore.getState().toasts).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("auto-removes info toast after 3 seconds by default", () => {
    useToastStore.getState().addToast({
      type: "info",
      message: "Info message",
    });

    expect(useToastStore.getState().toasts).toHaveLength(1);

    vi.advanceTimersByTime(3000);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("auto-removes error toast after 5 seconds by default", () => {
    useToastStore.getState().addToast({
      type: "error",
      message: "Error message",
    });

    expect(useToastStore.getState().toasts).toHaveLength(1);

    vi.advanceTimersByTime(4999);
    expect(useToastStore.getState().toasts).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("uses custom duration when provided", () => {
    useToastStore.getState().addToast({
      type: "success",
      message: "Custom duration",
      duration: 7000,
    });

    vi.advanceTimersByTime(6999);
    expect(useToastStore.getState().toasts).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("does not auto-remove when duration is 0 (persistent toast)", () => {
    useToastStore.getState().addToast({
      type: "error",
      message: "Persistent error",
      duration: 0,
    });

    vi.advanceTimersByTime(60000);
    expect(useToastStore.getState().toasts).toHaveLength(1);
  });

  it("handles multiple toasts with different durations independently", () => {
    useToastStore.getState().addToast({
      type: "success",
      message: "Quick toast",
      duration: 1000,
    });
    useToastStore.getState().addToast({
      type: "error",
      message: "Slow toast",
      duration: 5000,
    });

    expect(useToastStore.getState().toasts).toHaveLength(2);

    vi.advanceTimersByTime(1000);
    expect(useToastStore.getState().toasts).toHaveLength(1);
    expect(useToastStore.getState().toasts[0].message).toBe("Slow toast");

    vi.advanceTimersByTime(4000);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });
});

describe("removeToast", () => {
  it("removes a toast by id", () => {
    const id = useToastStore.getState().addToast({
      type: "info",
      message: "Will be removed",
    });

    useToastStore.getState().removeToast(id);

    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("only removes the specified toast", () => {
    const id1 = useToastStore.getState().addToast({
      type: "info",
      message: "First",
    });
    const id2 = useToastStore.getState().addToast({
      type: "success",
      message: "Second",
    });
    useToastStore.getState().addToast({ type: "error", message: "Third" });

    useToastStore.getState().removeToast(id2);

    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(2);
    expect(toasts.map((t) => t.message)).toEqual(["First", "Third"]);
  });

  it("handles removing non-existent toast gracefully", () => {
    useToastStore.getState().addToast({ type: "info", message: "Existing" });

    // Should not throw
    useToastStore.getState().removeToast("nonexistent-id");

    expect(useToastStore.getState().toasts).toHaveLength(1);
  });

  it("handles removing from empty toasts array", () => {
    // Should not throw
    useToastStore.getState().removeToast("any-id");

    expect(useToastStore.getState().toasts).toEqual([]);
  });
});

describe("clearAll", () => {
  it("removes all toasts", () => {
    useToastStore.getState().addToast({ type: "info", message: "First" });
    useToastStore.getState().addToast({ type: "success", message: "Second" });
    useToastStore.getState().addToast({ type: "error", message: "Third" });

    expect(useToastStore.getState().toasts).toHaveLength(3);

    useToastStore.getState().clearAll();

    expect(useToastStore.getState().toasts).toEqual([]);
  });

  it("handles clearing when already empty", () => {
    useToastStore.getState().clearAll();
    expect(useToastStore.getState().toasts).toEqual([]);
  });
});

describe("showToast helper", () => {
  it("creates a toast and returns its id", () => {
    const id = showToast("success", "Helper test");

    expect(id).toMatch(/^toast-\d+$/);
    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toMatchObject({
      type: "success",
      message: "Helper test",
    });
  });

  it("accepts optional duration parameter", () => {
    showToast("info", "Custom duration", 10000);

    const toast = useToastStore.getState().toasts[0];
    expect(toast.duration).toBe(10000);

    vi.advanceTimersByTime(10000);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });
});

describe("showError helper", () => {
  it("creates an error toast", () => {
    const id = showError("Something went wrong");

    expect(id).toMatch(/^toast-\d+$/);
    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toMatchObject({
      type: "error",
      message: "Something went wrong",
    });
  });

  it("uses error default duration of 5 seconds", () => {
    showError("Error message");

    vi.advanceTimersByTime(4999);
    expect(useToastStore.getState().toasts).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("accepts optional duration override", () => {
    showError("Custom error", 2000);

    vi.advanceTimersByTime(2000);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });
});

describe("showSuccess helper", () => {
  it("creates a success toast", () => {
    const id = showSuccess("Operation completed");

    expect(id).toMatch(/^toast-\d+$/);
    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toMatchObject({
      type: "success",
      message: "Operation completed",
    });
  });

  it("uses success default duration of 3 seconds", () => {
    showSuccess("Success message");

    vi.advanceTimersByTime(3000);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("accepts optional duration override", () => {
    showSuccess("Long success", 8000);

    vi.advanceTimersByTime(7999);
    expect(useToastStore.getState().toasts).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });
});

describe("showInfo helper", () => {
  it("creates an info toast", () => {
    const id = showInfo("Information");

    expect(id).toMatch(/^toast-\d+$/);
    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toMatchObject({
      type: "info",
      message: "Information",
    });
  });

  it("uses info default duration of 3 seconds", () => {
    showInfo("Info message");

    vi.advanceTimersByTime(3000);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("accepts optional duration override", () => {
    showInfo("Persistent info", 0);

    vi.advanceTimersByTime(60000);
    expect(useToastStore.getState().toasts).toHaveLength(1);
  });
});

describe("edge cases", () => {
  it("handles rapid sequential toast additions", () => {
    for (let i = 0; i < 10; i++) {
      showInfo(`Toast ${i}`);
    }

    expect(useToastStore.getState().toasts).toHaveLength(10);
  });

  it("maintains toast order when some are removed", () => {
    const id1 = showInfo("A");
    const id2 = showInfo("B");
    const id3 = showInfo("C");
    showInfo("D");

    useToastStore.getState().removeToast(id2);
    useToastStore.getState().removeToast(id1);

    const messages = useToastStore.getState().toasts.map((t) => t.message);
    expect(messages).toEqual(["C", "D"]);
  });

  it("handles adding new toast while others are auto-removing", () => {
    showSuccess("First", 1000);
    vi.advanceTimersByTime(500);

    showSuccess("Second", 2000);
    vi.advanceTimersByTime(500);

    // First should be removed
    expect(useToastStore.getState().toasts).toHaveLength(1);
    expect(useToastStore.getState().toasts[0].message).toBe("Second");

    vi.advanceTimersByTime(1500);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("handles empty message strings", () => {
    const id = showInfo("");

    const toast = useToastStore.getState().toasts[0];
    expect(toast.message).toBe("");
    expect(toast.id).toBe(id);
  });

  it("handles very long messages", () => {
    const longMessage = "A".repeat(10000);
    showInfo(longMessage);

    const toast = useToastStore.getState().toasts[0];
    expect(toast.message).toBe(longMessage);
  });
});
