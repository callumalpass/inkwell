import type { FastifyInstance } from "fastify";
import type { WebSocket } from "@fastify/websocket";
import { subscribeTo, unsubscribeFrom, broadcastToPage } from "./handlers.js";

// ─── Mock WebSocket ──────────────────────────────────────────────────────────

function createMockSocket(overrides: Partial<WebSocket> = {}): WebSocket {
  return {
    readyState: 1, // OPEN
    send: vi.fn(),
    close: vi.fn(),
    ...overrides,
  } as unknown as WebSocket;
}

function createMockApp(): FastifyInstance {
  return {} as FastifyInstance;
}

// ─── subscribeTo ─────────────────────────────────────────────────────────────

describe("subscribeTo", () => {
  describe("happy path", () => {
    it("adds a socket to a new page subscription", () => {
      const socket = createMockSocket();
      const pageId = "pg_test1";

      subscribeTo(pageId, socket);

      // Verify by broadcasting - if subscribed, the socket should receive the message
      const mockApp = createMockApp();
      broadcastToPage(mockApp, pageId, { type: "test" });

      expect(socket.send).toHaveBeenCalledWith('{"type":"test"}');
    });

    it("adds multiple sockets to the same page", () => {
      const socket1 = createMockSocket();
      const socket2 = createMockSocket();
      const pageId = "pg_test2";

      subscribeTo(pageId, socket1);
      subscribeTo(pageId, socket2);

      const mockApp = createMockApp();
      broadcastToPage(mockApp, pageId, { type: "update" });

      expect(socket1.send).toHaveBeenCalledWith('{"type":"update"}');
      expect(socket2.send).toHaveBeenCalledWith('{"type":"update"}');
    });

    it("allows a socket to subscribe to multiple pages", () => {
      const socket = createMockSocket();
      const pageId1 = "pg_multi1";
      const pageId2 = "pg_multi2";

      subscribeTo(pageId1, socket);
      subscribeTo(pageId2, socket);

      const mockApp = createMockApp();

      broadcastToPage(mockApp, pageId1, { page: 1 });
      expect(socket.send).toHaveBeenCalledWith('{"page":1}');

      broadcastToPage(mockApp, pageId2, { page: 2 });
      expect(socket.send).toHaveBeenCalledWith('{"page":2}');
    });
  });

  describe("edge cases", () => {
    it("handles subscribing the same socket twice to the same page", () => {
      const socket = createMockSocket();
      const pageId = "pg_duplicate";

      subscribeTo(pageId, socket);
      subscribeTo(pageId, socket);

      const mockApp = createMockApp();
      broadcastToPage(mockApp, pageId, { type: "test" });

      // Should only receive message once (Set deduplicates)
      expect(socket.send).toHaveBeenCalledTimes(1);
    });

    it("handles empty page ID", () => {
      const socket = createMockSocket();

      subscribeTo("", socket);

      const mockApp = createMockApp();
      broadcastToPage(mockApp, "", { type: "empty" });

      expect(socket.send).toHaveBeenCalledWith('{"type":"empty"}');
    });
  });
});

// ─── unsubscribeFrom ─────────────────────────────────────────────────────────

describe("unsubscribeFrom", () => {
  describe("happy path", () => {
    it("removes a socket from page subscription", () => {
      const socket = createMockSocket();
      const pageId = "pg_unsub1";

      subscribeTo(pageId, socket);
      unsubscribeFrom(pageId, socket);

      const mockApp = createMockApp();
      broadcastToPage(mockApp, pageId, { type: "test" });

      expect(socket.send).not.toHaveBeenCalled();
    });

    it("removes only the specified socket, leaving others subscribed", () => {
      const socket1 = createMockSocket();
      const socket2 = createMockSocket();
      const pageId = "pg_unsub2";

      subscribeTo(pageId, socket1);
      subscribeTo(pageId, socket2);
      unsubscribeFrom(pageId, socket1);

      const mockApp = createMockApp();
      broadcastToPage(mockApp, pageId, { type: "test" });

      expect(socket1.send).not.toHaveBeenCalled();
      expect(socket2.send).toHaveBeenCalledWith('{"type":"test"}');
    });

    it("cleans up empty page subscription sets", () => {
      const socket = createMockSocket();
      const pageId = "pg_cleanup";

      subscribeTo(pageId, socket);
      unsubscribeFrom(pageId, socket);

      // After cleanup, broadcasting should be a no-op with no errors
      const mockApp = createMockApp();
      expect(() =>
        broadcastToPage(mockApp, pageId, { type: "test" }),
      ).not.toThrow();
      expect(socket.send).not.toHaveBeenCalled();
    });
  });

  describe("edge cases", () => {
    it("handles unsubscribing from non-existent page", () => {
      const socket = createMockSocket();

      expect(() =>
        unsubscribeFrom("pg_nonexistent", socket),
      ).not.toThrow();
    });

    it("handles unsubscribing a socket that was never subscribed", () => {
      const socket1 = createMockSocket();
      const socket2 = createMockSocket();
      const pageId = "pg_never";

      subscribeTo(pageId, socket1);

      expect(() => unsubscribeFrom(pageId, socket2)).not.toThrow();

      // socket1 should still be subscribed
      const mockApp = createMockApp();
      broadcastToPage(mockApp, pageId, { type: "test" });
      expect(socket1.send).toHaveBeenCalled();
    });

    it("handles double unsubscribe", () => {
      const socket = createMockSocket();
      const pageId = "pg_double_unsub";

      subscribeTo(pageId, socket);
      unsubscribeFrom(pageId, socket);

      expect(() => unsubscribeFrom(pageId, socket)).not.toThrow();
    });

    it("only removes socket from specified page, not other pages", () => {
      const socket = createMockSocket();
      const pageId1 = "pg_multi_unsub1";
      const pageId2 = "pg_multi_unsub2";

      subscribeTo(pageId1, socket);
      subscribeTo(pageId2, socket);
      unsubscribeFrom(pageId1, socket);

      const mockApp = createMockApp();

      broadcastToPage(mockApp, pageId1, { page: 1 });
      expect(socket.send).not.toHaveBeenCalled();

      broadcastToPage(mockApp, pageId2, { page: 2 });
      expect(socket.send).toHaveBeenCalledWith('{"page":2}');
    });
  });
});

// ─── broadcastToPage ─────────────────────────────────────────────────────────

describe("broadcastToPage", () => {
  describe("happy path", () => {
    it("sends JSON stringified message to all subscribers", () => {
      const socket1 = createMockSocket();
      const socket2 = createMockSocket();
      const pageId = "pg_broadcast1";
      const mockApp = createMockApp();

      subscribeTo(pageId, socket1);
      subscribeTo(pageId, socket2);

      broadcastToPage(mockApp, pageId, { action: "strokeAdded", id: "st_1" });

      expect(socket1.send).toHaveBeenCalledWith(
        '{"action":"strokeAdded","id":"st_1"}',
      );
      expect(socket2.send).toHaveBeenCalledWith(
        '{"action":"strokeAdded","id":"st_1"}',
      );
    });

    it("handles various message types", () => {
      const socket = createMockSocket();
      const pageId = "pg_broadcast_types";
      const mockApp = createMockApp();

      subscribeTo(pageId, socket);

      // Object
      broadcastToPage(mockApp, pageId, { key: "value" });
      expect(socket.send).toHaveBeenLastCalledWith('{"key":"value"}');

      // Array
      broadcastToPage(mockApp, pageId, [1, 2, 3]);
      expect(socket.send).toHaveBeenLastCalledWith("[1,2,3]");

      // String
      broadcastToPage(mockApp, pageId, "hello");
      expect(socket.send).toHaveBeenLastCalledWith('"hello"');

      // Number
      broadcastToPage(mockApp, pageId, 42);
      expect(socket.send).toHaveBeenLastCalledWith("42");

      // Boolean
      broadcastToPage(mockApp, pageId, true);
      expect(socket.send).toHaveBeenLastCalledWith("true");

      // Null
      broadcastToPage(mockApp, pageId, null);
      expect(socket.send).toHaveBeenLastCalledWith("null");
    });

    it("handles nested objects", () => {
      const socket = createMockSocket();
      const pageId = "pg_nested";
      const mockApp = createMockApp();

      subscribeTo(pageId, socket);

      const message = {
        type: "strokeUpdate",
        data: {
          stroke: {
            id: "st_1",
            points: [
              { x: 10, y: 20 },
              { x: 30, y: 40 },
            ],
          },
        },
      };

      broadcastToPage(mockApp, pageId, message);

      expect(socket.send).toHaveBeenCalledWith(JSON.stringify(message));
    });
  });

  describe("connection state handling", () => {
    it("only sends to sockets with readyState OPEN (1)", () => {
      const openSocket = createMockSocket({ readyState: 1 });
      const closingSocket = createMockSocket({ readyState: 2 });
      const closedSocket = createMockSocket({ readyState: 3 });
      const pageId = "pg_states";
      const mockApp = createMockApp();

      subscribeTo(pageId, openSocket);
      subscribeTo(pageId, closingSocket);
      subscribeTo(pageId, closedSocket);

      broadcastToPage(mockApp, pageId, { type: "test" });

      expect(openSocket.send).toHaveBeenCalled();
      expect(closingSocket.send).not.toHaveBeenCalled();
      expect(closedSocket.send).not.toHaveBeenCalled();
    });

    it("skips sockets with readyState CONNECTING (0)", () => {
      const connectingSocket = createMockSocket({ readyState: 0 });
      const pageId = "pg_connecting";
      const mockApp = createMockApp();

      subscribeTo(pageId, connectingSocket);

      broadcastToPage(mockApp, pageId, { type: "test" });

      expect(connectingSocket.send).not.toHaveBeenCalled();
    });
  });

  describe("edge cases", () => {
    it("handles broadcast to page with no subscribers", () => {
      const mockApp = createMockApp();

      expect(() =>
        broadcastToPage(mockApp, "pg_no_subscribers", { type: "test" }),
      ).not.toThrow();
    });

    it("handles broadcast to page that had all subscribers removed", () => {
      const socket = createMockSocket();
      const pageId = "pg_all_removed";
      const mockApp = createMockApp();

      subscribeTo(pageId, socket);
      unsubscribeFrom(pageId, socket);

      expect(() =>
        broadcastToPage(mockApp, pageId, { type: "test" }),
      ).not.toThrow();
      expect(socket.send).not.toHaveBeenCalled();
    });

    it("handles empty message object", () => {
      const socket = createMockSocket();
      const pageId = "pg_empty_msg";
      const mockApp = createMockApp();

      subscribeTo(pageId, socket);

      broadcastToPage(mockApp, pageId, {});

      expect(socket.send).toHaveBeenCalledWith("{}");
    });
  });
});

// ─── Integration: subscription lifecycle ─────────────────────────────────────

describe("subscription lifecycle", () => {
  it("subscribe → broadcast → unsubscribe → broadcast (no delivery)", () => {
    const socket = createMockSocket();
    const pageId = "pg_lifecycle";
    const mockApp = createMockApp();

    // Step 1: Subscribe
    subscribeTo(pageId, socket);

    // Step 2: Broadcast (should receive)
    broadcastToPage(mockApp, pageId, { step: 2 });
    expect(socket.send).toHaveBeenCalledWith('{"step":2}');

    // Step 3: Unsubscribe
    unsubscribeFrom(pageId, socket);

    // Step 4: Broadcast (should NOT receive)
    broadcastToPage(mockApp, pageId, { step: 4 });
    expect(socket.send).toHaveBeenCalledTimes(1);
  });

  it("handles multiple pages with multiple sockets", () => {
    const socket1 = createMockSocket();
    const socket2 = createMockSocket();
    const socket3 = createMockSocket();
    const pageA = "pg_multi_a";
    const pageB = "pg_multi_b";
    const mockApp = createMockApp();

    // socket1 on pageA only
    subscribeTo(pageA, socket1);
    // socket2 on both pages
    subscribeTo(pageA, socket2);
    subscribeTo(pageB, socket2);
    // socket3 on pageB only
    subscribeTo(pageB, socket3);

    // Broadcast to pageA
    broadcastToPage(mockApp, pageA, { page: "A" });
    expect(socket1.send).toHaveBeenCalledWith('{"page":"A"}');
    expect(socket2.send).toHaveBeenCalledWith('{"page":"A"}');
    expect(socket3.send).not.toHaveBeenCalled();

    // Reset mocks
    vi.clearAllMocks();

    // Broadcast to pageB
    broadcastToPage(mockApp, pageB, { page: "B" });
    expect(socket1.send).not.toHaveBeenCalled();
    expect(socket2.send).toHaveBeenCalledWith('{"page":"B"}');
    expect(socket3.send).toHaveBeenCalledWith('{"page":"B"}');
  });

  it("socket disconnect scenario - unsubscribe from all pages", () => {
    const socket = createMockSocket();
    const page1 = "pg_disconnect1";
    const page2 = "pg_disconnect2";
    const page3 = "pg_disconnect3";
    const mockApp = createMockApp();

    // Subscribe to multiple pages
    subscribeTo(page1, socket);
    subscribeTo(page2, socket);
    subscribeTo(page3, socket);

    // Simulate disconnect by unsubscribing from all
    unsubscribeFrom(page1, socket);
    unsubscribeFrom(page2, socket);
    unsubscribeFrom(page3, socket);

    // Broadcasts should not reach the socket
    broadcastToPage(mockApp, page1, { type: "test" });
    broadcastToPage(mockApp, page2, { type: "test" });
    broadcastToPage(mockApp, page3, { type: "test" });

    expect(socket.send).not.toHaveBeenCalled();
  });
});
