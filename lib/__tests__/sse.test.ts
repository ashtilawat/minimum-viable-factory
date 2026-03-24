import { subscribe, unsubscribe, broadcast } from "@/lib/sse";

/** Minimal mock of ReadableStreamDefaultController */
function makeController() {
  return {
    enqueue: jest.fn(),
    close: jest.fn(),
  } as unknown as ReadableStreamDefaultController;
}

// Helper: drain the module-level boardSubscribers Map between tests by
// unsubscribing every controller we added.
const cleanup: Array<() => void> = [];
afterEach(() => {
  cleanup.forEach((fn) => fn());
  cleanup.length = 0;
});

describe("subscribe()", () => {
  it("adds a controller for a new boardId", () => {
    const ctrl = makeController();
    subscribe("board-1", ctrl);
    cleanup.push(() => unsubscribe("board-1", ctrl));

    // Broadcast should reach the controller
    broadcast("board-1", { type: "PING" });
    expect(ctrl.enqueue).toHaveBeenCalledTimes(1);
  });

  it("supports multiple controllers for the same board", () => {
    const c1 = makeController();
    const c2 = makeController();
    subscribe("board-multi", c1);
    subscribe("board-multi", c2);
    cleanup.push(() => {
      unsubscribe("board-multi", c1);
      unsubscribe("board-multi", c2);
    });

    broadcast("board-multi", { type: "PING" });
    expect(c1.enqueue).toHaveBeenCalledTimes(1);
    expect(c2.enqueue).toHaveBeenCalledTimes(1);
  });
});

describe("unsubscribe()", () => {
  it("removes the controller so it no longer receives broadcasts", () => {
    const ctrl = makeController();
    subscribe("board-unsub", ctrl);
    unsubscribe("board-unsub", ctrl);

    broadcast("board-unsub", { type: "PING" });
    expect(ctrl.enqueue).not.toHaveBeenCalled();
  });

  it("cleans up the boardId key when the last subscriber leaves", () => {
    const ctrl = makeController();
    subscribe("board-cleanup", ctrl);
    unsubscribe("board-cleanup", ctrl);

    // No-op — board key should be gone; broadcast silently does nothing
    expect(() => broadcast("board-cleanup", { type: "PING" })).not.toThrow();
    expect(ctrl.enqueue).not.toHaveBeenCalled();
  });

  it("is a no-op for a boardId that has no subscribers", () => {
    const ctrl = makeController();
    expect(() => unsubscribe("board-nonexistent", ctrl)).not.toThrow();
  });

  it("only removes the specified controller, not others", () => {
    const c1 = makeController();
    const c2 = makeController();
    subscribe("board-partial", c1);
    subscribe("board-partial", c2);
    cleanup.push(() => unsubscribe("board-partial", c2));

    unsubscribe("board-partial", c1);

    broadcast("board-partial", { type: "PING" });
    expect(c1.enqueue).not.toHaveBeenCalled();
    expect(c2.enqueue).toHaveBeenCalledTimes(1);
  });
});

describe("broadcast()", () => {
  it("sends a properly formatted SSE data string", () => {
    const ctrl = makeController();
    subscribe("board-fmt", ctrl);
    cleanup.push(() => unsubscribe("board-fmt", ctrl));

    broadcast("board-fmt", { type: "CARD_MOVED", cardId: "c1" });

    expect(ctrl.enqueue).toHaveBeenCalledTimes(1);
    // The argument is a Uint8Array produced by TextEncoder
    const encoded = (ctrl.enqueue as jest.Mock).mock.calls[0][0];
    const text = new TextDecoder().decode(encoded as Uint8Array);
    expect(text).toBe(
      `data: ${JSON.stringify({ type: "CARD_MOVED", cardId: "c1" })}\n\n`
    );
  });

  it("is a no-op when there are no subscribers for the boardId", () => {
    // Should not throw
    expect(() =>
      broadcast("board-no-subs", { type: "PING" })
    ).not.toThrow();
  });

  it("removes a controller that throws on enqueue (closed stream)", () => {
    const throwing = {
      enqueue: jest.fn().mockImplementation(() => {
        throw new Error("stream closed");
      }),
    } as unknown as ReadableStreamDefaultController;

    const healthy = makeController();

    subscribe("board-throw", throwing);
    subscribe("board-throw", healthy);
    cleanup.push(() => {
      unsubscribe("board-throw", healthy);
      // `throwing` should already be removed by broadcast
    });

    // First broadcast — throwing controller is removed, healthy receives the message
    broadcast("board-throw", { type: "PING" });
    expect(healthy.enqueue).toHaveBeenCalledTimes(1);

    // Second broadcast — throwing controller is gone, no additional throw
    broadcast("board-throw", { type: "PING" });
    expect(healthy.enqueue).toHaveBeenCalledTimes(2);
  });

  it("broadcasts to all controllers for the same board", () => {
    const controllers = [makeController(), makeController(), makeController()];
    controllers.forEach((c) => subscribe("board-all", c));
    cleanup.push(() =>
      controllers.forEach((c) => unsubscribe("board-all", c))
    );

    broadcast("board-all", { type: "UPDATE" });
    controllers.forEach((c) =>
      expect(c.enqueue).toHaveBeenCalledTimes(1)
    );
  });

  it("does not cross-broadcast to a different boardId", () => {
    const c1 = makeController();
    const c2 = makeController();
    subscribe("board-a", c1);
    subscribe("board-b", c2);
    cleanup.push(() => {
      unsubscribe("board-a", c1);
      unsubscribe("board-b", c2);
    });

    broadcast("board-a", { type: "PING" });
    expect(c1.enqueue).toHaveBeenCalledTimes(1);
    expect(c2.enqueue).not.toHaveBeenCalled();
  });
});
