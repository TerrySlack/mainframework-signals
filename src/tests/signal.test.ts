import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

import { createSignal, destroySignal, isPromiseLike } from "../shared/core/signal";
import { getStoredSignal, globalSignalStore, routeSignalStore } from "../shared/store";
import { resetAllStores } from "./helpers/store-reset";
import { restoreAfterWindowStub } from "./setup";

describe("signal", () => {
  afterEach(() => {
    restoreAfterWindowStub();
  });

  beforeEach(() => {
    resetAllStores();
  });

  it("creates sync signal and caches by cacheId", () => {
    const first = createSignal("sync-cache", 1, { route: "r1" });
    const second = createSignal("sync-cache", 99, { route: "r1" });

    expect(first).toBe(second);
    expect(first()).toBe(1);
  });

  it("creates sync signal without reload for plain data", () => {
    const sync = createSignal("sync-shape", 42, { route: "r-shape" });

    expect(sync).toBeTruthy();
    expect(sync!.set).toBeDefined();
    expect("reload" in sync!).toBe(false);

    const obj = createSignal("sync-obj", { a: 1 }, { route: "r-shape" });
    expect(obj!.set).toBeDefined();
    expect("reload" in obj!).toBe(false);

    const undef = createSignal<number | undefined>("sync-undef", undefined, { route: "r-shape" });
    expect(undef!.set).toBeDefined();
    expect("reload" in undef!).toBe(false);
  });

  it("treats non-thenable object as sync", () => {
    const sync = createSignal("plain-obj", { foo: "bar" }, { route: "r-plain" });

    expect(sync!.set).toBeDefined();
    expect("reload" in sync!).toBe(false);
  });

  it("creates async resource for promise initial value", async () => {
    const res = createSignal("async-cache", Promise.resolve(5), { route: "r1" });

    expect(res.loading).toBeDefined();
    expect(res.reload).toBeDefined();

    await vi.waitFor(() => {
      expect(res.loading()).toBe(false);
    });

    expect(res()).toBe(5);
  });

  it("creates async resource for function initial value without options", async () => {
    const res = createSignal("async-fn", () => Promise.resolve("ok"), { route: "r-fn" });

    expect(res).toBeTruthy();
    expect(res!.reload).toBeDefined();

    await vi.waitFor(() => {
      expect(res!.loading()).toBe(false);
    });

    expect(res!()).toBe("ok");
  });

  it("isPromiseLike detects thenables", () => {
    expect(isPromiseLike(Promise.resolve(1))).toBe(true);
    expect(isPromiseLike({ then: () => {} })).toBe(true);
    expect(isPromiseLike(null)).toBe(false);
    expect(isPromiseLike(1)).toBe(false);
  });

  it("returns null when window is undefined", async () => {
    vi.stubGlobal("window", undefined);
    vi.resetModules();

    const mod = await import("../shared/core/signal");

    expect(mod.createSignal("ssr-cache", 1)).toBeNull();
  });

  it("destroySignal does not throw when window is undefined", async () => {
    vi.stubGlobal("window", undefined);
    vi.resetModules();

    const mod = await import("../shared/core/signal");

    expect(() => mod.destroySignal("ssr-destroy")).not.toThrow();
  });

  it("cache hit keeps first async resource when initial value changes", async () => {
    const first = createSignal("same-async", () => Promise.resolve("first"), { route: "r-same" });

    await vi.waitFor(() => {
      expect(first!.loading()).toBe(false);
    });

    expect(first!()).toBe("first");

    const second = createSignal("same-async", () => Promise.resolve("second"), { route: "r-same" });

    expect(second).toBe(first);
    expect(second!()).toBe("first");
  });

  it("reload on promise source reuses same promise", async () => {
    const promise = Promise.resolve(9);
    const res = createSignal("promise-reload", promise, { route: "r-pr" });

    await vi.waitFor(() => {
      expect(res!.loading()).toBe(false);
    });

    expect(res!()).toBe(9);

    res!.reload();

    await vi.waitFor(() => {
      expect(res!.loading()).toBe(false);
    });

    expect(res!()).toBe(9);
  });

  it("destroySignal removes main and resource suffix keys", () => {
    createSignal("destroy-me", Promise.resolve(1), { route: "r-destroy" });

    destroySignal("destroy-me", { route: "r-destroy" });

    expect(getStoredSignal("destroy-me", "r-destroy", false)).toBeUndefined();
    expect(globalSignalStore.has("destroy-me:value")).toBe(false);

    const routeMap = routeSignalStore.get("r-destroy");

    expect(routeMap?.has("destroy-me:value")).toBe(false);
    expect(routeMap?.has("destroy-me:loading")).toBe(false);
    expect(routeMap?.has("destroy-me:error")).toBe(false);
  });
});
