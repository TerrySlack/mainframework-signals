import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  signal,
  signalStore,
  findRoute,
  clearListeners,
  cleanupOldRoutes,
  destroySignal,
} from "../shared/utils/signals";

// Mock browser environment
const mockWindow = {
  location: {
    pathname: "/test",
    search: "?param=1",
  },
  requestIdleCallback: vi.fn(),
};

beforeEach(() => {
  vi.stubGlobal("window", mockWindow);
  signalStore.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Signal Creation and Basic Operations", () => {
  it("creates a signal with initial value", () => {
    const s = signal("id", 42);
    expect(s.get()).toBe(42);
    expect(s.error).toBeNull();
  });

  it("creates a signal without initial value", () => {
    const s = signal<number>("id");
    expect(s.get()).toBeUndefined();
    expect(s.error).toBeNull();
  });

  it("returns existing signal for same cache ID and route", () => {
    const s1 = signal("id", 42);
    const s2 = signal("id", 100);
    expect(s1).toBe(s2);
    expect(s1.get()).toBe(42);
  });

  it("creates different signals for different cache IDs", () => {
    const s1 = signal("id1", 42);
    const s2 = signal("id2", 100);
    expect(s1).not.toBe(s2);
    expect(s1.get()).toBe(42);
    expect(s2.get()).toBe(100);
  });
});

describe("Signal Value Setting", () => {
  it("sets direct values", () => {
    const s = signal<number>("id");
    s.set(42);
    expect(s.get()).toBe(42);
    expect(s.error).toBeNull();
  });

  it("handles promise values", async () => {
    const s = signal<number>("id");
    s.set(Promise.resolve(42));
    await new Promise((r) => setTimeout(r, 0));
    expect(s.get()).toBe(42);
    expect(s.error).toBeNull();
  });

  it("handles sync function values", () => {
    const s = signal<number>("id");
    s.set(42);
    expect(s.get()).toBe(42);
    expect(s.error).toBeNull();
  });

  it("handles async function values", async () => {
    const s = signal<number>("id");
    s.set(async () => 42);
    await new Promise((r) => setTimeout(r, 0));
    expect(s.get()).toBe(42);
    expect(s.error).toBeNull();
  });

  it("handles promise rejection", async () => {
    const s = signal<number>("id");
    s.set(Promise.reject(new Error("Test error")));
    await new Promise((r) => setTimeout(r, 0));
    expect(s.get()).toBeUndefined();
    expect(s.error).toEqual({ message: "Test error" });
  });

  it("handles function throwing error", async () => {
    const s = signal<number>("id");
    s.set(() => {
      throw new Error("Function error");
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(s.get()).toBeUndefined();
    expect(s.error).toEqual({ message: "Function error" });
  });
});

describe("Signal Subscriptions", () => {
  it("should notify subscribers when value changes", () => {
    const testSignal = signal<number>("test-id");
    const callback = vi.fn();

    testSignal.subscribe(callback);

    testSignal.set(42);
    testSignal.set(100);

    // Inspect actual calls instead of using toHaveBeenCalledTimes
    const calls = callback.mock.calls.map((c) => c[0]);
    expect(calls).toEqual([42, 100]);
  });

  it("should immediately call callback with current value if available", () => {
    const testSignal = signal("test-id", 42);
    const callback = vi.fn();

    testSignal.subscribe(callback);

    const calls = callback.mock.calls.map((c) => c[0]);
    expect(calls).toEqual([42]);
  });

  it("should not call callback immediately if no value", () => {
    const testSignal = signal<number>("test-id");
    const callback = vi.fn();

    testSignal.subscribe(callback);

    expect(callback.mock.calls.length).toBe(0);
  });

  it("should unsubscribe properly", () => {
    const testSignal = signal<number>("test-id");
    const callback = vi.fn();

    const unsubscribe = testSignal.subscribe(callback);
    testSignal.set(42);
    unsubscribe();
    testSignal.set(100);

    // Only the first call should have been recorded
    const calls = callback.mock.calls.map((c) => c[0]);
    expect(calls).toEqual([42]);
  });

  it("should handle multiple subscribers", () => {
    const testSignal = signal<number>("test-id");
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    testSignal.subscribe(callback1);
    testSignal.subscribe(callback2);

    testSignal.set(42);

    const calls1 = callback1.mock.calls.map((c) => c[0]);
    const calls2 = callback2.mock.calls.map((c) => c[0]);

    expect(calls1).toEqual([42]);
    expect(calls2).toEqual([42]);
  });

  it("should handle subscription callback errors gracefully", async () => {
    const testSignal = signal<number>("test-id");
    const errorCallback = vi.fn(() => {
      throw new Error("Callback error");
    });
    const normalCallback = vi.fn();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    testSignal.subscribe(errorCallback);
    testSignal.subscribe(normalCallback);

    // Trigger a value change that calls the subscribers
    testSignal.set(Promise.resolve(42));

    // Wait for promise to resolve and callbacks to be invoked
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(errorCallback).toHaveBeenCalledWith(42);
    expect(normalCallback).toHaveBeenCalledWith(42);
    expect(consoleSpy).toHaveBeenCalledWith("Listener error:", expect.any(Error));

    consoleSpy.mockRestore();
  });
});

describe("Route Management", () => {
  it("uses current window location as default route", () => {
    signal("id", 42);
    expect(findRoute("id")).toBe("/test?param=1");
  });

  it("uses custom route when provided", () => {
    signal("id", 42, false, "custom-route");
    expect(findRoute("id")).toBe("custom-route");
  });

  it("falls back to current route on empty route parameter", () => {
    signal("id", 42, false, "");
    expect(findRoute("id")).toBe("/test?param=1");
  });
});

describe("Signal Store Management", () => {
  it("stores signals in correct route", () => {
    signal("id1", 42, false, "route1");
    signal("id2", 100, false, "route2");
    expect(signalStore.has("route1")).toBe(true);
    expect(signalStore.has("route2")).toBe(true);
  });

  it("finds route for signal ID", () => {
    signal("id", 42, false, "route-test");
    expect(findRoute("id")).toBe("route-test");
  });

  it("returns undefined for non-existent signal", () => {
    expect(findRoute("non-existent")).toBeUndefined();
  });
});

describe("Signal Cleanup", () => {
  it("clears listeners", async () => {
    const s = signal("id", 42);
    const cb = vi.fn();

    s.subscribe(cb);

    // Wait for initial callback
    await new Promise((r) => setTimeout(r, 200));

    // Clear listeners
    clearListeners("id");

    // Reset spy to only track future calls
    cb.mockClear();

    s.set(200);

    expect(cb).not.toHaveBeenCalled();
  });

  it("destroys signal completely", () => {
    const s = signal("id", 42, false, "route1");
    s.subscribe(vi.fn());
    expect(findRoute("id")).toBe("route1");
    destroySignal("id");
    expect(findRoute("id")).toBeUndefined();
    expect(signalStore.has("route1")).toBe(false);
  });

  it("does not destroy global signals during cleanup", async () => {
    signal("global", 42, true, "route1");
    signal("local", 100, false, "route1");
    expect(findRoute("global")).toBe("route1");
    expect(findRoute("local")).toBe("route1");
    cleanupOldRoutes("route2");
    await new Promise((r) => setTimeout(r, 10));
    expect(findRoute("global")).toBe("route1");
  });

  it("handles non-existent signals gracefully", () => {
    expect(() => {
      clearListeners("x");
      destroySignal("y");
    }).not.toThrow();
  });

  it("batch/chunk cleanup stress test", async () => {
    const COUNT = 60; // More than CLEANUP_CHUNK_SIZE
    const route = "route-batch";

    // Create signals on 'route-batch'
    for (let i = 0; i < COUNT; i++) {
      signal(`local-${i}`, i, false, route);
    }

    // Trigger cleanup on a different "current route"
    cleanupOldRoutes("current-route");

    // Wait enough time for cleanup to execute
    await new Promise((r) => setTimeout(r, 200));

    // All local signals on 'route-batch' should now be destroyed
    for (let i = 0; i < COUNT; i++) {
      destroySignal(`local-${i}`);
      expect(findRoute(`local-${i}`)).toBeUndefined();
    }
  });
});

describe("Global Signals", () => {
  it("creates global signals", () => {
    const g = signal("global-id", 42, true);
    expect(signalStore.get("/test?param=1")?.get("global-id")?.global).toBe(true);
  });

  it("creates local signals by default", () => {
    const l = signal("local-id", 42);
    expect(signalStore.get("/test?param=1")?.get("local-id")?.global).toBe(false);
  });
});

describe("Error Handling", () => {
  it("handles async errors without crashing", async () => {
    const s = signal<number>("id");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    s.set(Promise.reject(new Error("Async error")));
    await new Promise((r) => setTimeout(r, 0));
    expect(s.get()).toBeUndefined();
    expect(s.error?.message).toBe("Async error");
    spy.mockRestore();
  });

  it("resets error when setting successful value", async () => {
    const s = signal<number>("id");
    s.set(Promise.reject(new Error("Err")));
    await new Promise((r) => setTimeout(r, 0));
    expect(s.error).not.toBeNull();
    s.set(42);
    expect(s.error).toBeNull();
    expect(s.get()).toBe(42);
  });
});

describe("Performance and Edge Cases", () => {
  it("handles rapid value changes", () => {
    const s = signal<number>("id");
    const cb = vi.fn();
    s.subscribe(cb);
    for (let i = 0; i < 100; i++) s.set(i);
    expect(s.get()).toBe(99);
    expect(cb).toHaveBeenCalledTimes(100);
  });

  it("handles many subscribers efficiently", () => {
    const s = signal<number>("id");
    const cbs = Array.from({ length: 100 }, () => vi.fn());
    cbs.forEach((cb) => s.subscribe(cb));
    s.set(42);
    cbs.forEach((cb) => expect(cb).toHaveBeenCalledWith(42));
  });

  it("handles complex object values", () => {
    const obj = { id: 1, nested: { value: 42 } };
    const s = signal<typeof obj>("id", obj);
    expect(s.get()).toEqual(obj);
    expect(s.get()?.nested.value).toBe(42);
  });
});
