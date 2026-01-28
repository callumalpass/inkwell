import { useSyncStore } from "./sync-store";

beforeEach(() => {
  // Reset store to initial state before each test
  useSyncStore.setState({
    pendingSaves: 0,
    isSyncing: false,
    wsStatus: "disconnected",
    wsConnections: 0,
    wsReconnecting: 0,
  });
});

describe("initial state", () => {
  it("starts with zero pending saves", () => {
    expect(useSyncStore.getState().pendingSaves).toBe(0);
  });

  it("starts not syncing", () => {
    expect(useSyncStore.getState().isSyncing).toBe(false);
  });

  it("starts with disconnected websocket status", () => {
    expect(useSyncStore.getState().wsStatus).toBe("disconnected");
  });

  it("starts with zero websocket connections", () => {
    expect(useSyncStore.getState().wsConnections).toBe(0);
  });

  it("starts with zero reconnecting websockets", () => {
    expect(useSyncStore.getState().wsReconnecting).toBe(0);
  });
});

describe("startSave", () => {
  it("increments pending saves count", () => {
    useSyncStore.getState().startSave();
    expect(useSyncStore.getState().pendingSaves).toBe(1);
  });

  it("sets isSyncing to true", () => {
    useSyncStore.getState().startSave();
    expect(useSyncStore.getState().isSyncing).toBe(true);
  });

  it("increments pending saves for multiple calls", () => {
    useSyncStore.getState().startSave();
    useSyncStore.getState().startSave();
    useSyncStore.getState().startSave();
    expect(useSyncStore.getState().pendingSaves).toBe(3);
  });

  it("keeps isSyncing true with multiple pending saves", () => {
    useSyncStore.getState().startSave();
    useSyncStore.getState().startSave();
    expect(useSyncStore.getState().isSyncing).toBe(true);
  });
});

describe("endSave", () => {
  it("decrements pending saves count", () => {
    useSyncStore.getState().startSave();
    useSyncStore.getState().startSave();
    useSyncStore.getState().endSave();
    expect(useSyncStore.getState().pendingSaves).toBe(1);
  });

  it("sets isSyncing to false when no more pending saves", () => {
    useSyncStore.getState().startSave();
    useSyncStore.getState().endSave();
    expect(useSyncStore.getState().isSyncing).toBe(false);
  });

  it("keeps isSyncing true when there are still pending saves", () => {
    useSyncStore.getState().startSave();
    useSyncStore.getState().startSave();
    useSyncStore.getState().endSave();
    expect(useSyncStore.getState().isSyncing).toBe(true);
  });

  it("does not go below zero pending saves", () => {
    useSyncStore.getState().endSave();
    expect(useSyncStore.getState().pendingSaves).toBe(0);
  });

  it("keeps isSyncing false when called on already empty state", () => {
    useSyncStore.getState().endSave();
    expect(useSyncStore.getState().isSyncing).toBe(false);
  });

  it("handles multiple end calls that would go negative", () => {
    useSyncStore.getState().startSave();
    useSyncStore.getState().endSave();
    useSyncStore.getState().endSave();
    useSyncStore.getState().endSave();
    expect(useSyncStore.getState().pendingSaves).toBe(0);
    expect(useSyncStore.getState().isSyncing).toBe(false);
  });
});

describe("setWsConnected", () => {
  describe("connecting", () => {
    it("increments websocket connections when connected", () => {
      useSyncStore.getState().setWsConnected(true);
      expect(useSyncStore.getState().wsConnections).toBe(1);
    });

    it("sets status to connected when first connection is made", () => {
      useSyncStore.getState().setWsConnected(true);
      expect(useSyncStore.getState().wsStatus).toBe("connected");
    });

    it("handles multiple connections", () => {
      useSyncStore.getState().setWsConnected(true);
      useSyncStore.getState().setWsConnected(true);
      useSyncStore.getState().setWsConnected(true);
      expect(useSyncStore.getState().wsConnections).toBe(3);
      expect(useSyncStore.getState().wsStatus).toBe("connected");
    });
  });

  describe("disconnecting", () => {
    it("decrements websocket connections when disconnected", () => {
      useSyncStore.getState().setWsConnected(true);
      useSyncStore.getState().setWsConnected(true);
      useSyncStore.getState().setWsConnected(false);
      expect(useSyncStore.getState().wsConnections).toBe(1);
    });

    it("sets status to disconnected when last connection is closed", () => {
      useSyncStore.getState().setWsConnected(true);
      useSyncStore.getState().setWsConnected(false);
      expect(useSyncStore.getState().wsStatus).toBe("disconnected");
    });

    it("keeps status connected when some connections remain", () => {
      useSyncStore.getState().setWsConnected(true);
      useSyncStore.getState().setWsConnected(true);
      useSyncStore.getState().setWsConnected(false);
      expect(useSyncStore.getState().wsStatus).toBe("connected");
    });

    it("does not go below zero connections", () => {
      useSyncStore.getState().setWsConnected(false);
      expect(useSyncStore.getState().wsConnections).toBe(0);
    });

    it("sets status to reconnecting when disconnected but reconnection in progress", () => {
      useSyncStore.getState().setWsConnected(true);
      useSyncStore.getState().startWsReconnect();
      useSyncStore.getState().setWsConnected(false);
      expect(useSyncStore.getState().wsStatus).toBe("reconnecting");
    });
  });
});

describe("startWsReconnect", () => {
  it("increments reconnecting count", () => {
    useSyncStore.getState().startWsReconnect();
    expect(useSyncStore.getState().wsReconnecting).toBe(1);
  });

  it("sets status to reconnecting when no connections", () => {
    useSyncStore.getState().startWsReconnect();
    expect(useSyncStore.getState().wsStatus).toBe("reconnecting");
  });

  it("keeps status connected if there are active connections", () => {
    useSyncStore.getState().setWsConnected(true);
    useSyncStore.getState().startWsReconnect();
    expect(useSyncStore.getState().wsStatus).toBe("connected");
  });

  it("handles multiple reconnection attempts", () => {
    useSyncStore.getState().startWsReconnect();
    useSyncStore.getState().startWsReconnect();
    expect(useSyncStore.getState().wsReconnecting).toBe(2);
  });
});

describe("endWsReconnect", () => {
  it("decrements reconnecting count", () => {
    useSyncStore.getState().startWsReconnect();
    useSyncStore.getState().startWsReconnect();
    useSyncStore.getState().endWsReconnect();
    expect(useSyncStore.getState().wsReconnecting).toBe(1);
  });

  it("does not go below zero reconnecting", () => {
    useSyncStore.getState().endWsReconnect();
    expect(useSyncStore.getState().wsReconnecting).toBe(0);
  });

  it("handles multiple end calls", () => {
    useSyncStore.getState().startWsReconnect();
    useSyncStore.getState().endWsReconnect();
    useSyncStore.getState().endWsReconnect();
    expect(useSyncStore.getState().wsReconnecting).toBe(0);
  });
});

describe("websocket status transitions", () => {
  it("transitions from disconnected to connected", () => {
    expect(useSyncStore.getState().wsStatus).toBe("disconnected");
    useSyncStore.getState().setWsConnected(true);
    expect(useSyncStore.getState().wsStatus).toBe("connected");
  });

  it("transitions from connected to disconnected", () => {
    useSyncStore.getState().setWsConnected(true);
    useSyncStore.getState().setWsConnected(false);
    expect(useSyncStore.getState().wsStatus).toBe("disconnected");
  });

  it("transitions from disconnected to reconnecting", () => {
    useSyncStore.getState().startWsReconnect();
    expect(useSyncStore.getState().wsStatus).toBe("reconnecting");
  });

  it("transitions from reconnecting to connected when reconnection succeeds", () => {
    useSyncStore.getState().startWsReconnect();
    expect(useSyncStore.getState().wsStatus).toBe("reconnecting");
    useSyncStore.getState().setWsConnected(true);
    expect(useSyncStore.getState().wsStatus).toBe("connected");
  });

  it("stays reconnecting if reconnect ends but no connection made", () => {
    useSyncStore.getState().startWsReconnect();
    useSyncStore.getState().startWsReconnect();
    useSyncStore.getState().endWsReconnect();
    // Still one reconnect attempt in progress
    expect(useSyncStore.getState().wsStatus).toBe("reconnecting");
  });
});

describe("complex scenarios", () => {
  it("handles save and websocket operations independently", () => {
    useSyncStore.getState().startSave();
    useSyncStore.getState().setWsConnected(true);

    expect(useSyncStore.getState().pendingSaves).toBe(1);
    expect(useSyncStore.getState().isSyncing).toBe(true);
    expect(useSyncStore.getState().wsConnections).toBe(1);
    expect(useSyncStore.getState().wsStatus).toBe("connected");

    useSyncStore.getState().endSave();
    expect(useSyncStore.getState().pendingSaves).toBe(0);
    expect(useSyncStore.getState().isSyncing).toBe(false);
    expect(useSyncStore.getState().wsConnections).toBe(1);
    expect(useSyncStore.getState().wsStatus).toBe("connected");
  });

  it("simulates connection loss and reconnection", () => {
    // Initial connected state
    useSyncStore.getState().setWsConnected(true);
    expect(useSyncStore.getState().wsStatus).toBe("connected");

    // Connection lost, attempting to reconnect
    useSyncStore.getState().startWsReconnect();
    useSyncStore.getState().setWsConnected(false);
    expect(useSyncStore.getState().wsStatus).toBe("reconnecting");

    // Reconnection successful
    useSyncStore.getState().setWsConnected(true);
    useSyncStore.getState().endWsReconnect();
    expect(useSyncStore.getState().wsStatus).toBe("connected");
    expect(useSyncStore.getState().wsReconnecting).toBe(0);
    expect(useSyncStore.getState().wsConnections).toBe(1);
  });

  it("simulates multiple pages with concurrent connections and saves", () => {
    // Open two pages with websocket connections
    useSyncStore.getState().setWsConnected(true);
    useSyncStore.getState().setWsConnected(true);
    expect(useSyncStore.getState().wsConnections).toBe(2);

    // Start saves on both pages
    useSyncStore.getState().startSave();
    useSyncStore.getState().startSave();
    useSyncStore.getState().startSave();
    expect(useSyncStore.getState().pendingSaves).toBe(3);
    expect(useSyncStore.getState().isSyncing).toBe(true);

    // Close one page
    useSyncStore.getState().setWsConnected(false);
    expect(useSyncStore.getState().wsConnections).toBe(1);
    expect(useSyncStore.getState().wsStatus).toBe("connected");

    // Complete saves
    useSyncStore.getState().endSave();
    useSyncStore.getState().endSave();
    useSyncStore.getState().endSave();
    expect(useSyncStore.getState().pendingSaves).toBe(0);
    expect(useSyncStore.getState().isSyncing).toBe(false);
  });

  it("handles rapid connect/disconnect cycles", () => {
    for (let i = 0; i < 10; i++) {
      useSyncStore.getState().setWsConnected(true);
      useSyncStore.getState().setWsConnected(false);
    }
    expect(useSyncStore.getState().wsConnections).toBe(0);
    expect(useSyncStore.getState().wsStatus).toBe("disconnected");
  });

  it("handles rapid save start/end cycles", () => {
    for (let i = 0; i < 100; i++) {
      useSyncStore.getState().startSave();
    }
    expect(useSyncStore.getState().pendingSaves).toBe(100);
    expect(useSyncStore.getState().isSyncing).toBe(true);

    for (let i = 0; i < 100; i++) {
      useSyncStore.getState().endSave();
    }
    expect(useSyncStore.getState().pendingSaves).toBe(0);
    expect(useSyncStore.getState().isSyncing).toBe(false);
  });
});

describe("edge cases", () => {
  it("reconnect status is preserved after connection if reconnect not ended", () => {
    useSyncStore.getState().startWsReconnect();
    useSyncStore.getState().setWsConnected(true);
    // Connected but reconnect counter still at 1
    expect(useSyncStore.getState().wsStatus).toBe("connected");
    expect(useSyncStore.getState().wsReconnecting).toBe(1);
  });

  it("transitions from reconnecting to disconnected when reconnect fails", () => {
    useSyncStore.getState().startWsReconnect();
    expect(useSyncStore.getState().wsStatus).toBe("reconnecting");

    // Reconnect attempt ended without success
    useSyncStore.getState().endWsReconnect();
    // Status should be disconnected since wsConnections is 0 and no reconnect attempts
    expect(useSyncStore.getState().wsStatus).toBe("disconnected");
  });

  it("handles interleaved reconnect attempts", () => {
    // First reconnect attempt starts
    useSyncStore.getState().startWsReconnect();
    expect(useSyncStore.getState().wsReconnecting).toBe(1);

    // Second reconnect attempt starts before first completes
    useSyncStore.getState().startWsReconnect();
    expect(useSyncStore.getState().wsReconnecting).toBe(2);

    // First attempt connects
    useSyncStore.getState().setWsConnected(true);
    useSyncStore.getState().endWsReconnect();
    expect(useSyncStore.getState().wsConnections).toBe(1);
    expect(useSyncStore.getState().wsReconnecting).toBe(1);
    expect(useSyncStore.getState().wsStatus).toBe("connected");

    // Second attempt also connects
    useSyncStore.getState().setWsConnected(true);
    useSyncStore.getState().endWsReconnect();
    expect(useSyncStore.getState().wsConnections).toBe(2);
    expect(useSyncStore.getState().wsReconnecting).toBe(0);
    expect(useSyncStore.getState().wsStatus).toBe("connected");
  });
});
