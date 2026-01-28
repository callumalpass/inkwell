import { useUndoRedoStore, type UndoCommand } from "./undo-redo-store";
import type { Stroke } from "../api/strokes";

const makeStroke = (id: string): Stroke => ({
  id,
  points: [
    { x: 0, y: 0, pressure: 0.5 },
    { x: 10, y: 10, pressure: 0.5 },
  ],
  color: "#000000",
  width: 3,
  createdAt: new Date().toISOString(),
});

function addStrokeCmd(pageId: string, stroke: Stroke): UndoCommand {
  return { type: "add-stroke", pageId, stroke };
}

function removeStrokeCmd(pageId: string, stroke: Stroke): UndoCommand {
  return { type: "remove-stroke", pageId, stroke };
}

beforeEach(() => {
  useUndoRedoStore.setState({ historyByPage: {} });
});

describe("record", () => {
  it("records an add-stroke command to the undo stack", () => {
    const stroke = makeStroke("s1");
    useUndoRedoStore.getState().record(addStrokeCmd("page1", stroke));

    expect(useUndoRedoStore.getState().canUndo("page1")).toBe(true);
    expect(useUndoRedoStore.getState().canRedo("page1")).toBe(false);
  });

  it("records a remove-stroke command to the undo stack", () => {
    const stroke = makeStroke("s1");
    useUndoRedoStore.getState().record(removeStrokeCmd("page1", stroke));

    expect(useUndoRedoStore.getState().canUndo("page1")).toBe(true);
  });

  it("clears the redo stack when a new command is recorded", () => {
    const s1 = makeStroke("s1");
    const s2 = makeStroke("s2");
    const store = useUndoRedoStore.getState();

    store.record(addStrokeCmd("page1", s1));
    // Undo to put s1 on redo stack
    store.popUndo("page1");
    expect(useUndoRedoStore.getState().canRedo("page1")).toBe(true);

    // New command should clear redo
    useUndoRedoStore.getState().record(addStrokeCmd("page1", s2));
    expect(useUndoRedoStore.getState().canRedo("page1")).toBe(false);
  });

  it("maintains separate history per page", () => {
    const s1 = makeStroke("s1");
    const s2 = makeStroke("s2");
    const store = useUndoRedoStore.getState();

    store.record(addStrokeCmd("page1", s1));
    store.record(addStrokeCmd("page2", s2));

    expect(useUndoRedoStore.getState().canUndo("page1")).toBe(true);
    expect(useUndoRedoStore.getState().canUndo("page2")).toBe(true);
    expect(useUndoRedoStore.getState().canUndo("page3")).toBe(false);
  });

  it("caps undo stack at MAX_HISTORY (200)", () => {
    for (let i = 0; i < 250; i++) {
      useUndoRedoStore.getState().record(addStrokeCmd("page1", makeStroke(`s${i}`)));
    }

    const history = useUndoRedoStore.getState().historyByPage["page1"];
    expect(history.undoStack.length).toBe(200);
    // Oldest commands should have been removed; latest should be s249
    const lastCmd = history.undoStack[199];
    expect(lastCmd.type).toBe("add-stroke");
    expect(lastCmd.stroke.id).toBe("s249");
  });
});

describe("popUndo", () => {
  it("returns the most recent command and moves it to redo", () => {
    const s1 = makeStroke("s1");
    const s2 = makeStroke("s2");
    const store = useUndoRedoStore.getState();

    store.record(addStrokeCmd("page1", s1));
    store.record(addStrokeCmd("page1", s2));

    const cmd = useUndoRedoStore.getState().popUndo("page1");
    expect(cmd).not.toBeNull();
    expect(cmd!.type).toBe("add-stroke");
    expect(cmd!.stroke.id).toBe("s2");

    // Redo stack should have s2 now
    expect(useUndoRedoStore.getState().canRedo("page1")).toBe(true);
    // Undo stack should still have s1
    expect(useUndoRedoStore.getState().canUndo("page1")).toBe(true);
  });

  it("returns null when undo stack is empty", () => {
    const cmd = useUndoRedoStore.getState().popUndo("page1");
    expect(cmd).toBeNull();
  });

  it("returns null for unknown page", () => {
    const cmd = useUndoRedoStore.getState().popUndo("nonexistent");
    expect(cmd).toBeNull();
  });
});

describe("popRedo", () => {
  it("returns the most recent redo command and moves it back to undo", () => {
    const s1 = makeStroke("s1");
    const store = useUndoRedoStore.getState();

    store.record(addStrokeCmd("page1", s1));
    store.popUndo("page1");

    const cmd = useUndoRedoStore.getState().popRedo("page1");
    expect(cmd).not.toBeNull();
    expect(cmd!.stroke.id).toBe("s1");

    // Should be back on undo stack
    expect(useUndoRedoStore.getState().canUndo("page1")).toBe(true);
    expect(useUndoRedoStore.getState().canRedo("page1")).toBe(false);
  });

  it("returns null when redo stack is empty", () => {
    const cmd = useUndoRedoStore.getState().popRedo("page1");
    expect(cmd).toBeNull();
  });
});

describe("canUndo / canRedo", () => {
  it("reports false for pages with no history", () => {
    expect(useUndoRedoStore.getState().canUndo("page1")).toBe(false);
    expect(useUndoRedoStore.getState().canRedo("page1")).toBe(false);
  });

  it("correctly reports after multiple undo/redo cycles", () => {
    const s1 = makeStroke("s1");
    const s2 = makeStroke("s2");
    const store = useUndoRedoStore.getState();

    store.record(addStrokeCmd("page1", s1));
    store.record(addStrokeCmd("page1", s2));

    // Can undo both, can't redo
    expect(useUndoRedoStore.getState().canUndo("page1")).toBe(true);
    expect(useUndoRedoStore.getState().canRedo("page1")).toBe(false);

    // Undo once
    useUndoRedoStore.getState().popUndo("page1");
    expect(useUndoRedoStore.getState().canUndo("page1")).toBe(true);
    expect(useUndoRedoStore.getState().canRedo("page1")).toBe(true);

    // Undo again
    useUndoRedoStore.getState().popUndo("page1");
    expect(useUndoRedoStore.getState().canUndo("page1")).toBe(false);
    expect(useUndoRedoStore.getState().canRedo("page1")).toBe(true);

    // Redo once
    useUndoRedoStore.getState().popRedo("page1");
    expect(useUndoRedoStore.getState().canUndo("page1")).toBe(true);
    expect(useUndoRedoStore.getState().canRedo("page1")).toBe(true);

    // Redo again
    useUndoRedoStore.getState().popRedo("page1");
    expect(useUndoRedoStore.getState().canUndo("page1")).toBe(true);
    expect(useUndoRedoStore.getState().canRedo("page1")).toBe(false);
  });
});

describe("clearPage", () => {
  it("removes all history for a page", () => {
    const s1 = makeStroke("s1");
    useUndoRedoStore.getState().record(addStrokeCmd("page1", s1));
    useUndoRedoStore.getState().record(addStrokeCmd("page2", s1));

    useUndoRedoStore.getState().clearPage("page1");

    expect(useUndoRedoStore.getState().canUndo("page1")).toBe(false);
    expect(useUndoRedoStore.getState().canRedo("page1")).toBe(false);
    // Other pages unaffected
    expect(useUndoRedoStore.getState().canUndo("page2")).toBe(true);
  });

  it("does nothing for unknown page", () => {
    useUndoRedoStore.getState().clearPage("nonexistent");
    expect(useUndoRedoStore.getState().historyByPage).toEqual({});
  });
});

describe("full undo/redo cycle", () => {
  it("handles interleaved add and remove commands correctly", () => {
    const s1 = makeStroke("s1");
    const s2 = makeStroke("s2");
    const store = useUndoRedoStore.getState();

    // Draw s1
    store.record(addStrokeCmd("page1", s1));
    // Draw s2
    useUndoRedoStore.getState().record(addStrokeCmd("page1", s2));
    // Erase s1
    useUndoRedoStore.getState().record(removeStrokeCmd("page1", s1));

    // Undo erase → should give back remove-stroke for s1
    const cmd1 = useUndoRedoStore.getState().popUndo("page1");
    expect(cmd1!.type).toBe("remove-stroke");
    expect(cmd1!.stroke.id).toBe("s1");

    // Undo draw s2 → should give back add-stroke for s2
    const cmd2 = useUndoRedoStore.getState().popUndo("page1");
    expect(cmd2!.type).toBe("add-stroke");
    expect(cmd2!.stroke.id).toBe("s2");

    // Redo draw s2 → should give back add-stroke for s2
    const cmd3 = useUndoRedoStore.getState().popRedo("page1");
    expect(cmd3!.type).toBe("add-stroke");
    expect(cmd3!.stroke.id).toBe("s2");
  });
});
