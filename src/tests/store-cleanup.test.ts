import { describe, it, expect, beforeEach, vi } from "vitest";

import { createSyncSignal } from "../shared/core/create-signal-node";
import { resetAllStores } from "./helpers/store-reset";

describe("store-cleanup", () => {
  beforeEach(() => {
    resetAllStores();
    vi.resetModules();
  });

  it("runStoreCleanup with route purges immediately", async () => {
    const { storeSignal, routeSignalStore } = await import("../shared/store");
    const { runStoreCleanup } = await import("../shared/store/store-cleanup");

    storeSignal({
      id: "x",
      route: "old-route",
      global: false,
      signal: createSyncSignal(1),
      created: Date.now(),
    });

    await runStoreCleanup("new-route", "route");

    expect(routeSignalStore.get("old-route")?.has("x")).not.toBe(true);
  });

  it("runStoreCleanup janitor reuses in-flight cleanup promise", async () => {
    const { runStoreCleanup } = await import("../shared/store/store-cleanup");

    await runStoreCleanup("route-a", "route");

    const first = runStoreCleanup("route-a", "janitor");
    const second = runStoreCleanup("route-a", "janitor");

    expect(second).toBe(first);

    await first;
  });

  it("runStoreCleanup janitor skips purge when generation changes during cleanup", async () => {
    const signalStore = await import("../shared/store/signal-store");
    const purgeSpy = vi.spyOn(signalStore, "purgeStaleRoutes");
    const { runStoreCleanup } = await import("../shared/store/store-cleanup");

    await runStoreCleanup("route-a", "route");

    purgeSpy.mockClear();

    const janitor = runStoreCleanup("route-a", "janitor");

    void runStoreCleanup("route-b", "route");

    await janitor;

    expect(purgeSpy).toHaveBeenCalledTimes(1);
  });

  it("runStoreCleanup janitor purges stale routes when generation is unchanged", async () => {
    const { storeSignal } = await import("../shared/store");
    const { runStoreCleanup } = await import("../shared/store/store-cleanup");

    storeSignal({
      id: "purge-me",
      route: "other-route",
      global: false,
      signal: createSyncSignal(1),
      created: Date.now(),
    });

    await runStoreCleanup("/home", "janitor");

    const { getStoredSignal } = await import("../shared/store");

    expect(getStoredSignal("purge-me", "other-route", false)).toBeUndefined();
  });
});
