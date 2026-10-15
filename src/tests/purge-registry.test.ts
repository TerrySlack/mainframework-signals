import { describe, it, expect, beforeEach, vi } from "vitest";

import { resetAllStores } from "./helpers/store-reset";

describe("purge-registry integration", () => {
  beforeEach(() => {
    resetAllStores();
    vi.resetModules();
  });

  it("janitor with generation skip does not dispose entries on new route", async () => {
    const { domSignal } = await import("../dom/index");
    const { getStoredDomSignal } = await import("../dom/dom-store");
    const { runStoreCleanup } = await import("../shared/store/store-cleanup");

    await runStoreCleanup("/janitor-a", "route");

    const janitor = runStoreCleanup("/janitor-a", "janitor");
    void runStoreCleanup("/janitor-b", "route");

    const dom = domSignal("janitor-skip", document.createElement("div"), { route: "/janitor-b" })!;

    await janitor;

    expect(getStoredDomSignal("janitor-skip", "/janitor-b", false)).toBe(dom);
  });

  it("globals survive route purge and global lookup works from another route", async () => {
    const { domSignal } = await import("../dom/index");
    const { getStoredDomSignal } = await import("../dom/dom-store");
    const { runStoreCleanup } = await import("../shared/store/store-cleanup");

    const globalDom = domSignal("global-purge", document.createElement("div"), {
      global: true,
      route: "/g-old",
    })!;

    await runStoreCleanup("/g-new", "route");

    expect(getStoredDomSignal("global-purge", "/g-old", true)).toBe(globalDom);
    expect(getStoredDomSignal("global-purge", "/g-new", true)).toBe(globalDom);
  });

  it("dispose removes global and route map entries", async () => {
    const { domSignal } = await import("../dom/index");
    const { getStoredDomSignal } = await import("../dom/dom-store");

    const dom = domSignal("dispose-both", document.createElement("div"), {
      global: true,
      route: "/dispose-route",
    })!;

    dom.dispose();

    expect(getStoredDomSignal("dispose-both", "/dispose-route", true)).toBeUndefined();
    expect(getStoredDomSignal("dispose-both", "/dispose-route", false)).toBeUndefined();
  });

  it("stale-route purge disposes all non-globals on other routes", async () => {
    const { domSignal } = await import("../dom/index");
    const { getStoredDomSignal } = await import("../dom/dom-store");
    const { runStoreCleanup } = await import("../shared/store/store-cleanup");

    const staleOne = domSignal("stale-1", document.createElement("div"), { route: "/stale" })!;
    const staleTwo = domSignal("stale-2", document.createElement("div"), { route: "/stale" })!;
    const globalKeep = domSignal("stale-global", document.createElement("div"), {
      global: true,
      route: "/stale",
    })!;

    await runStoreCleanup("/current", "route");

    expect(getStoredDomSignal("stale-1", "/stale", false)).toBeUndefined();
    expect(getStoredDomSignal("stale-2", "/stale", false)).toBeUndefined();
    expect(getStoredDomSignal("stale-global", "/stale", true)).toBe(globalKeep);

    staleOne.dispose();
    staleTwo.dispose();
    globalKeep.dispose();
  });

  it("destroyDomSignal disposes stored entry", async () => {
    const { domSignal, destroyDomSignal } = await import("../dom/index");
    const { getStoredDomSignal } = await import("../dom/dom-store");

    domSignal("destroy-purge", document.createElement("div"), { route: "/d" });
    destroyDomSignal("destroy-purge", { route: "/d" });
    expect(getStoredDomSignal("destroy-purge", "/d", false)).toBeUndefined();
  });
});
