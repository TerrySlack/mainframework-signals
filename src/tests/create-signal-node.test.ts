import { describe, it, expect, vi, afterEach } from "vitest";

import { createSyncSignal } from "../shared/core/create-signal-node";
import { effect } from "../shared/core/effect";
import { restoreAfterWindowStub } from "./setup";

describe("createSyncSignal", () => {
  afterEach(() => {
    restoreAfterWindowStub();
  });

  it("read and set are no-ops when window is unavailable after creation", () => {
    const sig = createSyncSignal(10);

    expect(sig()).toBe(10);

    vi.stubGlobal("window", undefined);

    expect(sig()).toBeUndefined();
    expect(() => sig.set(20)).not.toThrow();
    expect(sig()).toBeUndefined();
  });

  it("reads initial value", () => {
    const sig = createSyncSignal(10);

    expect(sig()).toBe(10);
  });

  it("sets value", () => {
    const sig = createSyncSignal(0);

    sig.set(5);

    expect(sig()).toBe(5);
  });

  it("supports functional updater", () => {
    const sig = createSyncSignal(2);

    sig.set((previous) => previous + 3);

    expect(sig()).toBe(5);
  });

  it("skips notify when value is equal", async () => {
    const sig = createSyncSignal({ x: 1 });
    const run = vi.fn(() => {
      sig();
    });

    effect(run);

    expect(run).toHaveBeenCalledTimes(1);

    sig.set({ x: 1 });

    await Promise.resolve();

    expect(run).toHaveBeenCalledTimes(1);
  });
});
