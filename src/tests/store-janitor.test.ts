import { describe, it, expect, beforeEach, vi } from "vitest";

import { createSyncSignal } from "../shared/core/create-signal-node";
import { emitTimerExpired, fakeTimerWorkers } from "./setup";
import { resetAllStores } from "./helpers/store-reset";

describe("store-janitor", () => {
  beforeEach(() => {
    resetAllStores();
    fakeTimerWorkers.length = 0;
    vi.resetModules();
  });

  it("ensureStoreJanitor registers timer and runs cleanup on expired", async () => {
    const { storeSignal, routeSignalStore } = await import("../shared/store");
    const { ensureStoreJanitor } = await import("../shared/store/store-janitor");

    storeSignal({
      id: "old-entry",
      route: "stale-janitor",
      global: false,
      signal: createSyncSignal(1),
      created: Date.now(),
    });

    window.history.replaceState({}, "", "/current-janitor");

    ensureStoreJanitor();

    const worker = fakeTimerWorkers[fakeTimerWorkers.length - 1];

    emitTimerExpired(worker, "__signals_store_janitor__");

    await vi.waitFor(() => {
      expect(routeSignalStore.get("stale-janitor")?.has("old-entry")).not.toBe(true);
    });
  });

  it("ignores worker messages with non-expired type", async () => {
    const { storeSignal, routeSignalStore } = await import("../shared/store");
    const { ensureStoreJanitor } = await import("../shared/store/store-janitor");

    storeSignal({
      id: "non-expired-entry",
      route: "stale-non-expired",
      global: false,
      signal: createSyncSignal(1),
      created: Date.now(),
    });

    ensureStoreJanitor();

    const worker = fakeTimerWorkers[fakeTimerWorkers.length - 1];

    worker.emitMessage({ type: "register", id: "__signals_store_janitor__" });

    await Promise.resolve();

    expect(routeSignalStore.get("stale-non-expired")?.has("non-expired-entry")).toBe(true);
  });

  it("ignores worker messages with wrong id", async () => {
    const { storeSignal, routeSignalStore } = await import("../shared/store");
    const { ensureStoreJanitor } = await import("../shared/store/store-janitor");

    storeSignal({
      id: "wrong-id-entry",
      route: "stale-wrong-id",
      global: false,
      signal: createSyncSignal(1),
      created: Date.now(),
    });

    ensureStoreJanitor();

    const worker = fakeTimerWorkers[fakeTimerWorkers.length - 1];

    worker.emitMessage({ type: "expired", id: "not-janitor-id" });

    await Promise.resolve();

    expect(routeSignalStore.get("stale-wrong-id")?.has("wrong-id-entry")).toBe(true);

    emitTimerExpired(worker, "__signals_store_janitor__");

    await vi.waitFor(() => {
      expect(routeSignalStore.get("stale-wrong-id")?.has("wrong-id-entry")).not.toBe(true);
    });
  });

  it("ensureStoreJanitor is a no-op when already started", async () => {
    const { ensureStoreJanitor } = await import("../shared/store/store-janitor");

    const before = fakeTimerWorkers.length;

    ensureStoreJanitor();
    ensureStoreJanitor();

    expect(fakeTimerWorkers.length).toBe(before + 1);
  });
});
