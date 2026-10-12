import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import * as resourceTimers from "../shared/core/resource-timers";
import { createSyncSignal } from "../shared/core/create-signal-node";
import {
  getCurrentRoute,
  getRoute,
  getStoredSignal,
  globalSignalStore,
  purgeStaleRoutes,
  routeSignalStore,
  storeSignal,
} from "../shared/store";
import { resetAllStores } from "./helpers/store-reset";
import { restoreAfterWindowStub } from "./setup";

describe("signal-store", () => {
  afterEach(() => {
    restoreAfterWindowStub();
  });

  beforeEach(() => {
    resetAllStores();
  });

  it("getRoute uses override when provided", () => {
    expect(getRoute("custom")).toBe("custom");
    expect(getRoute(42)).toBe("42");
  });

  it("getRoute uses current route when not provided", () => {
    window.history.replaceState({}, "", "/hello?q=1");

    expect(getRoute()).toBe("/hello?q=1");
    expect(getCurrentRoute()).toBe("/hello?q=1");
  });

  it("getRoute and getCurrentRoute do not throw when window is undefined", async () => {
    vi.stubGlobal("window", undefined);
    vi.resetModules();

    const mod = await import("../shared/store/signal-store");

    expect(() => mod.getRoute()).not.toThrow();
    expect(() => mod.getCurrentRoute()).not.toThrow();
    expect(mod.getRoute()).toBe("");
    expect(mod.getCurrentRoute()).toBe("");
    expect(mod.getRoute("x")).toBe("x");
  });

  it("storeSignal and getStoredSignal for route-scoped entries", () => {
    const sig = createSyncSignal(1);

    storeSignal({
      id: "a",
      route: "r1",
      global: false,
      signal: sig,
      created: Date.now(),
    });

    expect(getStoredSignal("a", "r1", false)).toBe(sig);
    expect(getStoredSignal("a", "r2", false)).toBeUndefined();
  });

  it("storeSignal and getStoredSignal for global entries", () => {
    const sig = createSyncSignal(2);

    storeSignal({
      id: "g",
      route: "r1",
      global: true,
      signal: sig,
      created: Date.now(),
    });

    expect(getStoredSignal("g", "r1", true)).toBe(sig);
    expect(getStoredSignal("g", "r9", true)).toBe(sig);
  });

  it("purgeStaleRoutes removes non-global entries on other routes", () => {
    const local = createSyncSignal(1);
    const globalSig = createSyncSignal(2);

    storeSignal({ id: "local", route: "old", global: false, signal: local, created: Date.now() });
    storeSignal({ id: "global", route: "old", global: true, signal: globalSig, created: Date.now() });

    const stopSpy = vi.spyOn(resourceTimers, "stopResourceIntervalsForRoute");

    purgeStaleRoutes("new");

    expect(routeSignalStore.get("old")?.has("local")).toBe(false);
    expect(routeSignalStore.get("old")?.has("global")).toBe(true);
    expect(stopSpy).toHaveBeenCalledWith("old");

    stopSpy.mockRestore();
  });

  it("purgeStaleRoutes deletes empty route maps", () => {
    storeSignal({
      id: "only",
      route: "gone",
      global: false,
      signal: createSyncSignal(0),
      created: Date.now(),
    });

    purgeStaleRoutes("stay");

    expect(routeSignalStore.has("gone")).toBe(false);
  });

  it("purgeStaleRoutes keeps current route entries", () => {
    const sig = createSyncSignal(3);

    storeSignal({ id: "keep", route: "here", global: false, signal: sig, created: Date.now() });

    purgeStaleRoutes("here");

    expect(getStoredSignal("keep", "here", false)).toBe(sig);
  });

  it("globalSignalStore is independent map", () => {
    expect(globalSignalStore.size).toBe(0);
  });
});
