import { useLinksPanelStore } from "./links-panel-store";

beforeEach(() => {
  useLinksPanelStore.setState({
    panelOpen: false,
    panelPageId: null,
  });
});

describe("links-panel-store", () => {
  it("starts with panel closed and no pageId", () => {
    const state = useLinksPanelStore.getState();
    expect(state.panelOpen).toBe(false);
    expect(state.panelPageId).toBeNull();
  });

  it("opens panel with a pageId", () => {
    useLinksPanelStore.getState().openPanel("pg_1");
    const state = useLinksPanelStore.getState();
    expect(state.panelOpen).toBe(true);
    expect(state.panelPageId).toBe("pg_1");
  });

  it("closes panel and clears pageId", () => {
    useLinksPanelStore.getState().openPanel("pg_1");
    useLinksPanelStore.getState().closePanel();
    const state = useLinksPanelStore.getState();
    expect(state.panelOpen).toBe(false);
    expect(state.panelPageId).toBeNull();
  });

  it("can switch to a different page", () => {
    useLinksPanelStore.getState().openPanel("pg_1");
    useLinksPanelStore.getState().openPanel("pg_2");
    const state = useLinksPanelStore.getState();
    expect(state.panelOpen).toBe(true);
    expect(state.panelPageId).toBe("pg_2");
  });
});
