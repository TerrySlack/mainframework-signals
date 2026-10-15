import { describe, it, expect, beforeEach, vi } from "vitest";

import { effect } from "../shared/core/effect";
import { createSyncSignal } from "../shared/core/create-signal-node";
import { peekDomElement } from "../dom/core";
import { getStoredDomSignal } from "../dom/dom-store";
import { domSignal, destroyDomSignal } from "../dom/index";
import { getRoute } from "../shared/store/signal-store";
import { resetAllStores } from "./helpers/store-reset";

describe("dom-signal", () => {
  beforeEach(() => {
    resetAllStores();
  });

  it("no-ops allowlist set when key is not on the element", () => {
    const node = document.createElement("div");
    const dom = domSignal("allowlist-miss", node)!;

    dom.htmlFor = "x";

    expect(node.getAttribute("for")).toBeNull();
  });

  it('textContent null becomes empty string not "null"', () => {
    const node = document.createElement("div");
    const dom = domSignal("null-text", node)!;

    dom.textContent = null;

    expect(node.textContent).toBe("");
    expect(node.textContent).not.toBe("null");
  });

  it("peekDomElement inside effect does not re-run on attach; dom.element does", async () => {
    const dom = domSignal("peek-track", null)!;
    let peekRuns = 0;
    let trackRuns = 0;

    effect(() => {
      peekRuns++;
      peekDomElement(dom);
    });

    effect(() => {
      trackRuns++;
      void dom.element;
    });

    expect(peekRuns).toBe(1);
    expect(trackRuns).toBe(1);

    const node = document.createElement("div");
    dom.attachElement(node);

    await vi.waitFor(() => {
      expect(peekRuns).toBe(1);
      expect(trackRuns).toBe(2);
    });
  });

  it("attachElement re-runs effect that subscribed via dom.element while null", async () => {
    const dom = domSignal("attach-rerun", null)!;
    let runs = 0;

    effect(() => {
      runs++;
      void dom.element;
    });

    expect(runs).toBe(1);

    dom.attachElement(document.createElement("span"));

    await vi.waitFor(() => {
      expect(runs).toBe(2);
    });
  });

  it("second attachElement with same node does not restart mapped backing", async () => {
    const node = document.createElement("div");
    const text = createSyncSignal("a");
    let backingRuns = 0;

    const dom = domSignal("same-attach", null, {
      backing: { textContent: text },
    })!;

    effect(() => {
      backingRuns++;
      text();
    });

    await vi.waitFor(() => {
      expect(backingRuns).toBeGreaterThanOrEqual(1);
    });

    const before = backingRuns;
    dom.attachElement(node);
    dom.attachElement(node);

    await vi.waitFor(() => {
      expect(backingRuns).toBe(before);
    });
  });

  it("readonly property sets no-op and return true", () => {
    const dom = domSignal("readonly", document.createElement("div"))!;

    expect(Reflect.set(dom, "cacheId", "x")).toBe(true);
    expect(Reflect.set(dom, "route", "/nope")).toBe(true);
    expect(Reflect.set(dom, "global", true)).toBe(true);
    expect(Reflect.set(dom, "element", document.createElement("p"))).toBe(true);
    expect(dom.cacheId).not.toBe("x");
    expect(dom.route).not.toBe("/nope");
    expect(dom.global).toBe(false);
    expect(dom.element).toBeInstanceOf(HTMLDivElement);
  });

  it("domSignal attaches element and cache hit ignores new options", () => {
    const node = document.createElement("div");
    const first = domSignal("cache-hit", node, { route: "r1" })!;
    const second = domSignal("cache-hit", node, {
      route: "r1",
      backing: { props: { textContent: "nope" } },
    })!;

    expect(second).toBe(first);
    expect(first.element).toBe(node);
    expect(node.textContent).toBe("");
  });

  it("detach keeps store entry; dispose and destroyDomSignal remove maps", () => {
    const dom = domSignal("lifecycle", document.createElement("div"), { route: "life" })!;

    dom.detach();
    expect(getStoredDomSignal("lifecycle", "life", false)).toBe(dom);
    expect(dom.element).toBeNull();

    dom.dispose();
    expect(getStoredDomSignal("lifecycle", "life", false)).toBeUndefined();

    const again = domSignal("destroy-me", document.createElement("div"), { route: "d" })!;
    destroyDomSignal("destroy-me", { route: "d" });
    expect(getStoredDomSignal("destroy-me", "d", false)).toBeUndefined();
    expect(again.element).toBeNull();
  });

  it("global vs route lookup mirrors signal store", () => {
    window.history.replaceState({}, "", "/route-a");
    const routeA = getRoute();

    const local = domSignal("shared-id", document.createElement("div"), { route: routeA })!;
    window.history.replaceState({}, "", "/route-b");
    const otherRoute = getRoute();
    const miss = domSignal("shared-id", document.createElement("div"), { route: otherRoute })!;

    expect(miss).not.toBe(local);

    const globalDom = domSignal("global-id", document.createElement("div"), {
      global: true,
      route: routeA,
    })!;
    const fromOther = domSignal("global-id", document.createElement("div"), {
      global: true,
      route: otherRoute,
    })!;

    expect(fromOther).toBe(globalDom);
  });
});
