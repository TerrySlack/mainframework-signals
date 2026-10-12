import { describe, it, expect, vi, afterEach } from "vitest";

import { createSyncSignal } from "../shared/core/create-signal-node";
import { effect } from "../shared/core/effect";
import { restoreAfterWindowStub } from "./setup";

describe("effect", () => {
  afterEach(() => {
    restoreAfterWindowStub();
  });

  it("returns null when window is undefined", async () => {
    vi.stubGlobal("window", undefined);
    vi.resetModules();

    const mod = await import("../shared/core/effect");

    expect(mod.effect(() => {})).toBeNull();
  });

  it("runs callback immediately", () => {
    const run = vi.fn();

    effect(run);

    expect(run).toHaveBeenCalledTimes(1);
  });

  it("re-runs when a tracked signal changes", async () => {
    const count = createSyncSignal(0);
    const run = vi.fn(() => {
      count();
    });

    effect(run);

    expect(run).toHaveBeenCalledTimes(1);

    count.set(1);

    await vi.waitFor(() => {
      expect(run).toHaveBeenCalledTimes(2);
    });
  });

  it("dispose stops further runs", async () => {
    const count = createSyncSignal(0);
    const run = vi.fn(() => {
      count();
    });

    const dispose = effect(run);

    dispose();

    count.set(1);

    await Promise.resolve();

    expect(run).toHaveBeenCalledTimes(1);
  });
});
