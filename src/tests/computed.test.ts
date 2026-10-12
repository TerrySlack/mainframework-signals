import { describe, it, expect, vi, afterEach } from "vitest";

import { computed } from "../shared/core/computed";
import { createSyncSignal } from "../shared/core/create-signal-node";
import { effect } from "../shared/core/effect";
import { restoreAfterWindowStub } from "./setup";

describe("computed", () => {
  afterEach(() => {
    restoreAfterWindowStub();
  });

  it("returns null when window is undefined", async () => {
    vi.stubGlobal("window", undefined);
    vi.resetModules();

    const mod = await import("../shared/core/computed");

    expect(mod.computed(() => 1)).toBeNull();
  });

  it("getter returns undefined when window is unavailable after creation", () => {
    const a = createSyncSignal(1);
    const doubled = computed(() => a() * 2);

    expect(doubled!()).toBe(2);

    vi.stubGlobal("window", undefined);

    expect(doubled!()).toBeUndefined();
  });

  it("returns derived value from dependencies", () => {
    const a = createSyncSignal(2);
    const b = createSyncSignal(3);

    const sum = computed(() => a() + b());

    expect(sum()).toBe(5);
  });

  it("updates when dependency changes", async () => {
    const a = createSyncSignal(1);
    const doubled = computed(() => a() * 2);

    expect(doubled()).toBe(2);

    a.set(4);

    await vi.waitFor(() => {
      expect(doubled()).toBe(8);
    });
  });

  it("does not notify when recomputed primitive is unchanged", async () => {
    const a = createSyncSignal(0);
    const constant = computed(() => {
      a();
      return 100;
    });

    expect(constant!()).toBe(100);

    const run = vi.fn(() => {
      constant!();
    });

    effect(run);

    expect(run).toHaveBeenCalledTimes(1);

    a.set(1);

    await vi.waitFor(() => {
      expect(a()).toBe(1);
    });

    expect(constant!()).toBe(100);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("does not notify dependents when value is deeply equal", async () => {
    const a = createSyncSignal({ n: 1 });
    const derived = computed(() => ({ n: a().n }));

    const run = vi.fn(() => {
      derived();
    });

    effect(run);

    expect(run).toHaveBeenCalledTimes(1);

    a.set({ n: 1 });

    await Promise.resolve();

    expect(run).toHaveBeenCalledTimes(1);
  });
});
