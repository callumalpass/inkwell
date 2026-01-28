import { useTagsPanelStore } from "./tags-panel-store";

beforeEach(() => {
  useTagsPanelStore.setState({
    panelOpen: false,
    panelPageId: null,
  });
});

describe("tags-panel-store", () => {
  it("starts with panel closed and no pageId", () => {
    const state = useTagsPanelStore.getState();
    expect(state.panelOpen).toBe(false);
    expect(state.panelPageId).toBeNull();
  });

  it("opens panel with a pageId", () => {
    useTagsPanelStore.getState().openPanel("pg_1");
    const state = useTagsPanelStore.getState();
    expect(state.panelOpen).toBe(true);
    expect(state.panelPageId).toBe("pg_1");
  });

  it("closes panel and clears pageId", () => {
    useTagsPanelStore.getState().openPanel("pg_1");
    useTagsPanelStore.getState().closePanel();
    const state = useTagsPanelStore.getState();
    expect(state.panelOpen).toBe(false);
    expect(state.panelPageId).toBeNull();
  });

  it("can switch to a different page", () => {
    useTagsPanelStore.getState().openPanel("pg_1");
    useTagsPanelStore.getState().openPanel("pg_2");
    const state = useTagsPanelStore.getState();
    expect(state.panelOpen).toBe(true);
    expect(state.panelPageId).toBe("pg_2");
  });
});
