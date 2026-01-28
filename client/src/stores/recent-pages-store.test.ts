import { useRecentPagesStore, type RecentPage } from "./recent-pages-store";

const makeRecentPage = (
  overrides: Partial<Omit<RecentPage, "visitedAt">> = {},
): Omit<RecentPage, "visitedAt"> => ({
  pageId: "pg_test123",
  notebookId: "nb_test456",
  notebookTitle: "Test Notebook",
  pageNumber: 1,
  thumbnailUrl: "/api/pages/pg_test123/thumbnail",
  ...overrides,
});

beforeEach(() => {
  useRecentPagesStore.setState({ recentPages: [] });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("initial state", () => {
  it("starts with an empty recentPages array", () => {
    const state = useRecentPagesStore.getState();
    expect(state.recentPages).toEqual([]);
  });
});

describe("addRecentPage", () => {
  it("adds a page to the beginning of the list", () => {
    const page = makeRecentPage();
    vi.setSystemTime(1000);

    useRecentPagesStore.getState().addRecentPage(page);

    const state = useRecentPagesStore.getState();
    expect(state.recentPages).toHaveLength(1);
    expect(state.recentPages[0]).toEqual({
      ...page,
      visitedAt: 1000,
    });
  });

  it("sets visitedAt to current timestamp", () => {
    const page = makeRecentPage();
    vi.setSystemTime(1234567890);

    useRecentPagesStore.getState().addRecentPage(page);

    expect(useRecentPagesStore.getState().recentPages[0].visitedAt).toBe(1234567890);
  });

  it("places new pages at the beginning", () => {
    vi.setSystemTime(1000);
    useRecentPagesStore.getState().addRecentPage(makeRecentPage({ pageId: "pg_first" }));

    vi.setSystemTime(2000);
    useRecentPagesStore.getState().addRecentPage(makeRecentPage({ pageId: "pg_second" }));

    const state = useRecentPagesStore.getState();
    expect(state.recentPages[0].pageId).toBe("pg_second");
    expect(state.recentPages[1].pageId).toBe("pg_first");
  });

  it("removes duplicate entries when re-adding a page", () => {
    vi.setSystemTime(1000);
    useRecentPagesStore.getState().addRecentPage(makeRecentPage({ pageId: "pg_dup" }));
    vi.setSystemTime(2000);
    useRecentPagesStore.getState().addRecentPage(makeRecentPage({ pageId: "pg_other" }));
    vi.setSystemTime(3000);
    useRecentPagesStore.getState().addRecentPage(makeRecentPage({ pageId: "pg_dup" }));

    const state = useRecentPagesStore.getState();
    expect(state.recentPages).toHaveLength(2);
    expect(state.recentPages[0].pageId).toBe("pg_dup");
    expect(state.recentPages[0].visitedAt).toBe(3000);
    expect(state.recentPages[1].pageId).toBe("pg_other");
  });

  it("updates page metadata when re-adding", () => {
    vi.setSystemTime(1000);
    useRecentPagesStore.getState().addRecentPage(
      makeRecentPage({
        pageId: "pg_update",
        notebookTitle: "Old Title",
        pageNumber: 1,
      }),
    );

    vi.setSystemTime(2000);
    useRecentPagesStore.getState().addRecentPage(
      makeRecentPage({
        pageId: "pg_update",
        notebookTitle: "New Title",
        pageNumber: 5,
      }),
    );

    const state = useRecentPagesStore.getState();
    expect(state.recentPages).toHaveLength(1);
    expect(state.recentPages[0].notebookTitle).toBe("New Title");
    expect(state.recentPages[0].pageNumber).toBe(5);
  });

  it("enforces maximum of 10 recent pages", () => {
    for (let i = 1; i <= 15; i++) {
      vi.setSystemTime(i * 1000);
      useRecentPagesStore.getState().addRecentPage(
        makeRecentPage({ pageId: `pg_page${i}` }),
      );
    }

    const state = useRecentPagesStore.getState();
    expect(state.recentPages).toHaveLength(10);
    // Most recent pages should be kept
    expect(state.recentPages[0].pageId).toBe("pg_page15");
    expect(state.recentPages[9].pageId).toBe("pg_page6");
  });

  it("oldest pages are removed when limit is exceeded", () => {
    for (let i = 1; i <= 10; i++) {
      vi.setSystemTime(i * 1000);
      useRecentPagesStore.getState().addRecentPage(
        makeRecentPage({ pageId: `pg_page${i}` }),
      );
    }

    vi.setSystemTime(11000);
    useRecentPagesStore.getState().addRecentPage(
      makeRecentPage({ pageId: "pg_new" }),
    );

    const state = useRecentPagesStore.getState();
    expect(state.recentPages).toHaveLength(10);
    expect(state.recentPages.find((p) => p.pageId === "pg_page1")).toBeUndefined();
    expect(state.recentPages[0].pageId).toBe("pg_new");
  });

  it("re-adding existing page does not exceed limit", () => {
    for (let i = 1; i <= 10; i++) {
      vi.setSystemTime(i * 1000);
      useRecentPagesStore.getState().addRecentPage(
        makeRecentPage({ pageId: `pg_page${i}` }),
      );
    }

    vi.setSystemTime(11000);
    useRecentPagesStore.getState().addRecentPage(
      makeRecentPage({ pageId: "pg_page5" }),
    );

    const state = useRecentPagesStore.getState();
    expect(state.recentPages).toHaveLength(10);
    expect(state.recentPages[0].pageId).toBe("pg_page5");
    // page1 should still exist since we only re-added an existing page
    expect(state.recentPages.find((p) => p.pageId === "pg_page1")).toBeDefined();
  });

  it("handles pages from different notebooks", () => {
    vi.setSystemTime(1000);
    useRecentPagesStore.getState().addRecentPage(
      makeRecentPage({
        pageId: "pg_a",
        notebookId: "nb_notebook1",
        notebookTitle: "Notebook 1",
      }),
    );

    vi.setSystemTime(2000);
    useRecentPagesStore.getState().addRecentPage(
      makeRecentPage({
        pageId: "pg_b",
        notebookId: "nb_notebook2",
        notebookTitle: "Notebook 2",
      }),
    );

    const state = useRecentPagesStore.getState();
    expect(state.recentPages).toHaveLength(2);
    expect(state.recentPages[0].notebookId).toBe("nb_notebook2");
    expect(state.recentPages[1].notebookId).toBe("nb_notebook1");
  });
});

describe("removeRecentPage", () => {
  it("removes a page by pageId", () => {
    vi.setSystemTime(1000);
    useRecentPagesStore.getState().addRecentPage(makeRecentPage({ pageId: "pg_keep" }));
    vi.setSystemTime(2000);
    useRecentPagesStore.getState().addRecentPage(makeRecentPage({ pageId: "pg_remove" }));

    useRecentPagesStore.getState().removeRecentPage("pg_remove");

    const state = useRecentPagesStore.getState();
    expect(state.recentPages).toHaveLength(1);
    expect(state.recentPages[0].pageId).toBe("pg_keep");
  });

  it("does nothing when removing non-existent page", () => {
    vi.setSystemTime(1000);
    useRecentPagesStore.getState().addRecentPage(makeRecentPage({ pageId: "pg_exists" }));

    useRecentPagesStore.getState().removeRecentPage("pg_nonexistent");

    const state = useRecentPagesStore.getState();
    expect(state.recentPages).toHaveLength(1);
    expect(state.recentPages[0].pageId).toBe("pg_exists");
  });

  it("can remove all pages one by one", () => {
    vi.setSystemTime(1000);
    useRecentPagesStore.getState().addRecentPage(makeRecentPage({ pageId: "pg_1" }));
    vi.setSystemTime(2000);
    useRecentPagesStore.getState().addRecentPage(makeRecentPage({ pageId: "pg_2" }));

    useRecentPagesStore.getState().removeRecentPage("pg_1");
    useRecentPagesStore.getState().removeRecentPage("pg_2");

    expect(useRecentPagesStore.getState().recentPages).toEqual([]);
  });

  it("preserves order of remaining pages", () => {
    vi.setSystemTime(1000);
    useRecentPagesStore.getState().addRecentPage(makeRecentPage({ pageId: "pg_a" }));
    vi.setSystemTime(2000);
    useRecentPagesStore.getState().addRecentPage(makeRecentPage({ pageId: "pg_b" }));
    vi.setSystemTime(3000);
    useRecentPagesStore.getState().addRecentPage(makeRecentPage({ pageId: "pg_c" }));

    useRecentPagesStore.getState().removeRecentPage("pg_b");

    const state = useRecentPagesStore.getState();
    expect(state.recentPages).toHaveLength(2);
    expect(state.recentPages[0].pageId).toBe("pg_c");
    expect(state.recentPages[1].pageId).toBe("pg_a");
  });

  it("removes from empty list without error", () => {
    expect(useRecentPagesStore.getState().recentPages).toEqual([]);

    useRecentPagesStore.getState().removeRecentPage("pg_any");

    expect(useRecentPagesStore.getState().recentPages).toEqual([]);
  });
});

describe("clearRecentPages", () => {
  it("removes all pages", () => {
    vi.setSystemTime(1000);
    useRecentPagesStore.getState().addRecentPage(makeRecentPage({ pageId: "pg_1" }));
    vi.setSystemTime(2000);
    useRecentPagesStore.getState().addRecentPage(makeRecentPage({ pageId: "pg_2" }));
    vi.setSystemTime(3000);
    useRecentPagesStore.getState().addRecentPage(makeRecentPage({ pageId: "pg_3" }));

    useRecentPagesStore.getState().clearRecentPages();

    expect(useRecentPagesStore.getState().recentPages).toEqual([]);
  });

  it("does nothing when already empty", () => {
    expect(useRecentPagesStore.getState().recentPages).toEqual([]);

    useRecentPagesStore.getState().clearRecentPages();

    expect(useRecentPagesStore.getState().recentPages).toEqual([]);
  });

  it("allows adding pages after clearing", () => {
    vi.setSystemTime(1000);
    useRecentPagesStore.getState().addRecentPage(makeRecentPage({ pageId: "pg_old" }));

    useRecentPagesStore.getState().clearRecentPages();

    vi.setSystemTime(2000);
    useRecentPagesStore.getState().addRecentPage(makeRecentPage({ pageId: "pg_new" }));

    const state = useRecentPagesStore.getState();
    expect(state.recentPages).toHaveLength(1);
    expect(state.recentPages[0].pageId).toBe("pg_new");
  });
});

describe("edge cases", () => {
  it("handles page with empty strings", () => {
    vi.setSystemTime(1000);
    useRecentPagesStore.getState().addRecentPage(
      makeRecentPage({
        pageId: "",
        notebookId: "",
        notebookTitle: "",
        thumbnailUrl: "",
      }),
    );

    const state = useRecentPagesStore.getState();
    expect(state.recentPages).toHaveLength(1);
    expect(state.recentPages[0].pageId).toBe("");
  });

  it("handles special characters in pageId", () => {
    vi.setSystemTime(1000);
    useRecentPagesStore.getState().addRecentPage(
      makeRecentPage({ pageId: "pg_special-chars_123!@#" }),
    );

    const state = useRecentPagesStore.getState();
    expect(state.recentPages[0].pageId).toBe("pg_special-chars_123!@#");
  });

  it("handles unicode characters in notebook title", () => {
    vi.setSystemTime(1000);
    useRecentPagesStore.getState().addRecentPage(
      makeRecentPage({ notebookTitle: "📓 My Notes 日記" }),
    );

    expect(useRecentPagesStore.getState().recentPages[0].notebookTitle).toBe(
      "📓 My Notes 日記",
    );
  });

  it("handles very large page numbers", () => {
    vi.setSystemTime(1000);
    useRecentPagesStore.getState().addRecentPage(
      makeRecentPage({ pageNumber: Number.MAX_SAFE_INTEGER }),
    );

    expect(useRecentPagesStore.getState().recentPages[0].pageNumber).toBe(
      Number.MAX_SAFE_INTEGER,
    );
  });

  it("handles page number zero", () => {
    vi.setSystemTime(1000);
    useRecentPagesStore.getState().addRecentPage(makeRecentPage({ pageNumber: 0 }));

    expect(useRecentPagesStore.getState().recentPages[0].pageNumber).toBe(0);
  });

  it("handles negative page numbers", () => {
    vi.setSystemTime(1000);
    useRecentPagesStore.getState().addRecentPage(makeRecentPage({ pageNumber: -1 }));

    expect(useRecentPagesStore.getState().recentPages[0].pageNumber).toBe(-1);
  });

  it("handles rapid consecutive additions", () => {
    for (let i = 0; i < 100; i++) {
      vi.setSystemTime(i);
      useRecentPagesStore.getState().addRecentPage(
        makeRecentPage({ pageId: `pg_rapid${i}` }),
      );
    }

    const state = useRecentPagesStore.getState();
    expect(state.recentPages).toHaveLength(10);
    expect(state.recentPages[0].pageId).toBe("pg_rapid99");
  });

  it("maintains data integrity with interleaved operations", () => {
    vi.setSystemTime(1000);
    useRecentPagesStore.getState().addRecentPage(makeRecentPage({ pageId: "pg_1" }));

    vi.setSystemTime(2000);
    useRecentPagesStore.getState().addRecentPage(makeRecentPage({ pageId: "pg_2" }));

    useRecentPagesStore.getState().removeRecentPage("pg_1");

    vi.setSystemTime(3000);
    useRecentPagesStore.getState().addRecentPage(makeRecentPage({ pageId: "pg_3" }));

    vi.setSystemTime(4000);
    useRecentPagesStore.getState().addRecentPage(makeRecentPage({ pageId: "pg_2" }));

    const state = useRecentPagesStore.getState();
    expect(state.recentPages).toHaveLength(2);
    expect(state.recentPages[0].pageId).toBe("pg_2");
    expect(state.recentPages[0].visitedAt).toBe(4000);
    expect(state.recentPages[1].pageId).toBe("pg_3");
  });
});
