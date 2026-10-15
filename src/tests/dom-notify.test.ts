import { describe, it, expect, beforeEach, vi } from "vitest";

import { registerReactBump, unregisterReactBump } from "../dom/core";
import { markDomDirty } from "../dom/internal";
import { domSignal } from "../dom/index";
import { resetAllStores } from "./helpers/store-reset";

describe("dom-notify", () => {
  beforeEach(() => {
    resetAllStores();
  });

  it("runs two registerReactBump callbacks on one proxy after markDomDirty", async () => {
    const el = document.createElement("div");
    const dom = domSignal("notify-two", el)!;
    const first = vi.fn();
    const second = vi.fn();

    registerReactBump(dom, first);
    registerReactBump(dom, second);

    markDomDirty(dom);

    await vi.waitFor(() => {
      expect(first).toHaveBeenCalledTimes(1);
      expect(second).toHaveBeenCalledTimes(1);
    });
  });

  it("keeps bump sets separate per proxy", async () => {
    const a = domSignal("notify-a", document.createElement("div"))!;
    const b = domSignal("notify-b", document.createElement("div"))!;
    const bumpA = vi.fn();
    const bumpB = vi.fn();

    registerReactBump(a, bumpA);
    registerReactBump(b, bumpB);

    markDomDirty(a);

    await vi.waitFor(() => {
      expect(bumpA).toHaveBeenCalledTimes(1);
      expect(bumpB).not.toHaveBeenCalled();
    });
  });

  it("markDomDirty(null) is a no-op", async () => {
    const bump = vi.fn();
    const dom = domSignal("notify-null", document.createElement("div"))!;

    registerReactBump(dom, bump);
    markDomDirty(null);

    await new Promise((resolve) => queueMicrotask(resolve));

    expect(bump).not.toHaveBeenCalled();
  });

  it("unregisterReactBump removes one callback and missing unregister is safe", async () => {
    const dom = domSignal("notify-unreg", document.createElement("div"))!;
    const keep = vi.fn();
    const drop = vi.fn();

    registerReactBump(dom, keep);
    registerReactBump(dom, drop);
    unregisterReactBump(dom, drop);
    unregisterReactBump(dom, () => {});

    markDomDirty(dom);

    await vi.waitFor(() => {
      expect(keep).toHaveBeenCalledTimes(1);
      expect(drop).not.toHaveBeenCalled();
    });
  });

  it("coalesces markDomDirty to one microtask per turn", async () => {
    const dom = domSignal("notify-coalesce", document.createElement("div"))!;
    const bump = vi.fn();

    registerReactBump(dom, bump);
    markDomDirty(dom);
    markDomDirty(dom);
    markDomDirty(dom);

    await vi.waitFor(() => {
      expect(bump).toHaveBeenCalledTimes(1);
    });
  });
});
