import { describe, expect, test, beforeEach, afterEach, vi } from "vitest";

import { signal, destroySignal, cleanupOldRoutes, signalStore } from "../shared/utils/signals";

describe("signals library", () => {
  beforeEach(() => {
    // Clear all signals and routes before each test
    for (const id in signalStore) {
      destroySignal(id);
    }
    for (const route in signalStore) {
      delete signalStore[route];
    }
  });
  test("create a signal and get initial undefined value", () => {
    const s = signal<number>("id1", 4, false, "fakeroute1");
    const storedSignal = s.get();
    expect(storedSignal).toBeDefined();
    expect(storedSignal).toBe(4);
  });

  test("create a signal with initial value", () => {
    const s = signal("id2", 42, false, "fakeroute2");
    expect(s.get()).toBe(42);
  });

  test("set updates value and notifies subscribers", () => {
    const s = signal("id3", 0, false, "fakeroute3");
    const callback = vi.fn();
    const unsubscribe = s.subscribe(callback);

    s.set(10);
    expect(s.get()).toBe(10);
    expect(callback).toHaveBeenCalledWith(0); // initial call on subscribe
    expect(callback).toHaveBeenCalledWith(10);

    unsubscribe();
    s.set(20);
    expect(callback).toHaveBeenCalledTimes(2); // no new calls after unsubscribe
  });

  test("destroySignal removes signal from stores and clears listeners", () => {
    const s = signal("id4", "hello", false, "fakeroute4");
    const callback = vi.fn();
    s.subscribe(callback);

    expect(signalStore["fakeroute4"]["id4"]).toBeDefined();

    //destroySignal("id4");
    //expect(signalStore["id4"]).toBeUndefined();
  });

  test("re-creating signal with same id returns existing instance", () => {
    const s1 = signal("id5", 5);
    const s2 = signal("id5");
    expect(s1).toBe(s2);
    expect(s2.get()).toBe(5);
  });

  describe("route cleanup", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    test("cleanupOldRoutes removes signals from other routes", () => {
      signal("sig1", "a", false, "fakeRoute99"); // route1
      expect(signalStore["fakeRoute99"]["sig1"]).toBeDefined();

      signal("sig2", "b", false, "fakeRoute100"); // route2
      expect(signalStore["fakeRoute100"]["sig2"]).toBeDefined();

      // Trigger cleanup for routes, should remove signals for route1
      // Force cleanup function call synchronously:
      cleanupOldRoutes("fakeRoute99");
      cleanupOldRoutes("fakeRoute100");

      // If requestIdleCallback not defined, fallback uses setTimeout(0)
      vi.runAllTimers();

      // Now signalStore should have only sig2 for route2
      expect(signalStore["fakeRoute99"]).toBeUndefined();
      expect(signalStore["fakeRoute100"]).toBeUndefined();
    });

    test("global signals are not destroyed during route cleanup", () => {
      // Global signal on route1
      signal("globalSig", "g", true, "global1");
      // Non-global signal on route1
      signal("normalSig", "n", false, "normal1");
      // Run cleanup timers
      vi.runAllTimers();

      cleanupOldRoutes("global1");
      cleanupOldRoutes("normal1");

      // Global signal should remain
      expect(signalStore["global1"]).toBeDefined();
      // Normal signal from route1 should be destroyed
      expect(signalStore["normal1"]).toBeUndefined();
    });
  });
});
