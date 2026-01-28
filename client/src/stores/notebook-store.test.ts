import { useNotebookStore } from "./notebook-store";
import type { NotebookMeta } from "../api/notebooks";

vi.mock("../api/notebooks", () => ({
  listNotebooks: vi.fn(),
  createNotebook: vi.fn(),
  deleteNotebook: vi.fn(),
}));

const makeNotebook = (id: string, title = `Notebook ${id}`): NotebookMeta => ({
  id,
  title,
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
  pageCount: 1,
});

beforeEach(() => {
  useNotebookStore.setState({
    notebooks: [],
    loading: false,
    error: null,
  });
  vi.clearAllMocks();
});

describe("initial state", () => {
  it("starts with empty notebooks, not loading, no error", () => {
    const state = useNotebookStore.getState();
    expect(state.notebooks).toEqual([]);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });
});

describe("fetchNotebooks", () => {
  it("fetches notebooks and stores them", async () => {
    const { listNotebooks } = await import("../api/notebooks");
    const notebooks = [makeNotebook("nb1"), makeNotebook("nb2")];
    vi.mocked(listNotebooks).mockResolvedValue(notebooks);

    await useNotebookStore.getState().fetchNotebooks();

    const state = useNotebookStore.getState();
    expect(state.notebooks).toEqual(notebooks);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
    expect(listNotebooks).toHaveBeenCalledOnce();
  });

  it("sets loading to true while fetching", async () => {
    const { listNotebooks } = await import("../api/notebooks");
    let resolvePromise: (value: NotebookMeta[]) => void;
    vi.mocked(listNotebooks).mockImplementation(
      () => new Promise((resolve) => { resolvePromise = resolve; }),
    );

    const promise = useNotebookStore.getState().fetchNotebooks();
    expect(useNotebookStore.getState().loading).toBe(true);
    expect(useNotebookStore.getState().error).toBeNull();

    resolvePromise!([]);
    await promise;

    expect(useNotebookStore.getState().loading).toBe(false);
  });

  it("clears previous error when re-fetching", async () => {
    const { listNotebooks } = await import("../api/notebooks");

    // First call fails
    vi.mocked(listNotebooks).mockRejectedValueOnce(new Error("Network error"));
    await useNotebookStore.getState().fetchNotebooks();
    expect(useNotebookStore.getState().error).toBe("Network error");

    // Second call succeeds
    vi.mocked(listNotebooks).mockResolvedValueOnce([makeNotebook("nb1")]);
    await useNotebookStore.getState().fetchNotebooks();

    expect(useNotebookStore.getState().error).toBeNull();
    expect(useNotebookStore.getState().notebooks).toHaveLength(1);
  });

  it("sets error on failure", async () => {
    const { listNotebooks } = await import("../api/notebooks");
    vi.mocked(listNotebooks).mockRejectedValue(new Error("Connection refused"));

    await useNotebookStore.getState().fetchNotebooks();

    const state = useNotebookStore.getState();
    expect(state.error).toBe("Connection refused");
    expect(state.loading).toBe(false);
    expect(state.notebooks).toEqual([]);
  });

  it("replaces previous notebooks on re-fetch", async () => {
    const { listNotebooks } = await import("../api/notebooks");

    useNotebookStore.setState({ notebooks: [makeNotebook("old")] });

    vi.mocked(listNotebooks).mockResolvedValue([makeNotebook("new1"), makeNotebook("new2")]);
    await useNotebookStore.getState().fetchNotebooks();

    expect(useNotebookStore.getState().notebooks).toHaveLength(2);
    expect(useNotebookStore.getState().notebooks[0].id).toBe("new1");
  });

  it("handles empty list from API", async () => {
    const { listNotebooks } = await import("../api/notebooks");
    vi.mocked(listNotebooks).mockResolvedValue([]);

    await useNotebookStore.getState().fetchNotebooks();

    expect(useNotebookStore.getState().notebooks).toEqual([]);
    expect(useNotebookStore.getState().loading).toBe(false);
  });
});

describe("createNotebook", () => {
  it("creates a notebook and prepends it to the list", async () => {
    const { createNotebook } = await import("../api/notebooks");
    const existing = makeNotebook("nb1");
    useNotebookStore.setState({ notebooks: [existing] });

    const created = makeNotebook("nb2", "New Notebook");
    vi.mocked(createNotebook).mockResolvedValue(created);

    const result = await useNotebookStore.getState().createNotebook("New Notebook");

    expect(createNotebook).toHaveBeenCalledWith("New Notebook");
    expect(result).toEqual(created);

    const notebooks = useNotebookStore.getState().notebooks;
    expect(notebooks).toHaveLength(2);
    expect(notebooks[0].id).toBe("nb2");
    expect(notebooks[1].id).toBe("nb1");
  });

  it("returns the created notebook", async () => {
    const { createNotebook } = await import("../api/notebooks");
    const created = makeNotebook("nb1", "My Notebook");
    vi.mocked(createNotebook).mockResolvedValue(created);

    const result = await useNotebookStore.getState().createNotebook("My Notebook");
    expect(result).toEqual(created);
    expect(result.title).toBe("My Notebook");
  });

  it("propagates API errors to the caller", async () => {
    const { createNotebook } = await import("../api/notebooks");
    vi.mocked(createNotebook).mockRejectedValue(new Error("Title required"));

    await expect(
      useNotebookStore.getState().createNotebook(""),
    ).rejects.toThrow("Title required");
  });

  it("does not modify notebook list when API fails", async () => {
    const { createNotebook } = await import("../api/notebooks");
    const existing = makeNotebook("nb1");
    useNotebookStore.setState({ notebooks: [existing] });

    vi.mocked(createNotebook).mockRejectedValue(new Error("Server error"));

    try {
      await useNotebookStore.getState().createNotebook("Will Fail");
    } catch {
      // expected
    }

    expect(useNotebookStore.getState().notebooks).toEqual([existing]);
  });

  it("works when notebook list is empty", async () => {
    const { createNotebook } = await import("../api/notebooks");
    const created = makeNotebook("nb1");
    vi.mocked(createNotebook).mockResolvedValue(created);

    await useNotebookStore.getState().createNotebook("First");

    expect(useNotebookStore.getState().notebooks).toEqual([created]);
  });
});

describe("deleteNotebook", () => {
  it("removes the notebook from the list", async () => {
    const { deleteNotebook } = await import("../api/notebooks");
    vi.mocked(deleteNotebook).mockResolvedValue(undefined);

    const nb1 = makeNotebook("nb1");
    const nb2 = makeNotebook("nb2");
    const nb3 = makeNotebook("nb3");
    useNotebookStore.setState({ notebooks: [nb1, nb2, nb3] });

    await useNotebookStore.getState().deleteNotebook("nb2");

    expect(deleteNotebook).toHaveBeenCalledWith("nb2");
    const notebooks = useNotebookStore.getState().notebooks;
    expect(notebooks).toHaveLength(2);
    expect(notebooks.map((n) => n.id)).toEqual(["nb1", "nb3"]);
  });

  it("handles deleting the only notebook", async () => {
    const { deleteNotebook } = await import("../api/notebooks");
    vi.mocked(deleteNotebook).mockResolvedValue(undefined);

    useNotebookStore.setState({ notebooks: [makeNotebook("nb1")] });

    await useNotebookStore.getState().deleteNotebook("nb1");

    expect(useNotebookStore.getState().notebooks).toEqual([]);
  });

  it("propagates API errors to the caller", async () => {
    const { deleteNotebook } = await import("../api/notebooks");
    vi.mocked(deleteNotebook).mockRejectedValue(new Error("Not found"));

    useNotebookStore.setState({ notebooks: [makeNotebook("nb1")] });

    await expect(
      useNotebookStore.getState().deleteNotebook("nb1"),
    ).rejects.toThrow("Not found");
  });

  it("does not modify notebook list when API fails", async () => {
    const { deleteNotebook } = await import("../api/notebooks");
    vi.mocked(deleteNotebook).mockRejectedValue(new Error("Forbidden"));

    const notebooks = [makeNotebook("nb1"), makeNotebook("nb2")];
    useNotebookStore.setState({ notebooks });

    try {
      await useNotebookStore.getState().deleteNotebook("nb1");
    } catch {
      // expected
    }

    expect(useNotebookStore.getState().notebooks).toHaveLength(2);
  });

  it("handles deleting a non-existent id gracefully", async () => {
    const { deleteNotebook } = await import("../api/notebooks");
    vi.mocked(deleteNotebook).mockResolvedValue(undefined);

    const nb1 = makeNotebook("nb1");
    useNotebookStore.setState({ notebooks: [nb1] });

    await useNotebookStore.getState().deleteNotebook("nonexistent");

    // API was called, list unchanged since filter finds nothing to remove
    expect(deleteNotebook).toHaveBeenCalledWith("nonexistent");
    expect(useNotebookStore.getState().notebooks).toEqual([nb1]);
  });
});
