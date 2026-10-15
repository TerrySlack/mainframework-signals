import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { describe, it, expect, beforeEach, vi } from "vitest";

import { resetAllStores } from "./helpers/store-reset";

const distRoot = path.join(process.cwd(), "dist");

const distUrl = (relativePath: string) => pathToFileURL(path.join(distRoot, relativePath)).href;

const readDist = (relativePath: string) => readFileSync(path.join(distRoot, relativePath), "utf8");

describe("dom-dist-singleton", () => {
  beforeEach(() => {
    resetAllStores();
    vi.resetModules();
  });

  it("dist import graph matches shared singleton layout", () => {
    const index = readDist("index.mjs");
    expect(index).toContain("./shared/core/reactive.mjs");
    expect(index).toContain("./shared/core/batch.mjs");
    expect(index).toContain("./shared/store/store-cleanup.mjs");

    const domIndex = readDist("dom/index.mjs");
    const domCore = readDist("dom/core.mjs");
    const domGetOrCreate = readDist("dom/get-or-create-dom-signal.mjs");
    expect(domGetOrCreate).toContain("../shared/core/reactive.mjs");
    expect(domCore).toContain("../shared/core/reactive.mjs");
    expect(domIndex).toContain("./core.mjs");
    expect(domIndex).toContain("./dom-store.mjs");
    expect(domIndex).toContain("./get-or-create-dom-signal.mjs");

    const domReact = readDist("dom/react.mjs");
    const domInternal = readDist("dom/internal.mjs");
    expect(domReact).toContain("./core.mjs");
    expect(domInternal).toContain("./core.mjs");

    expect(domIndex).not.toContain("bumpSets");
    expect(domReact).not.toContain("bumpSets");
  });

  it("effect from dist/index and dom from dist/dom share element slot after attachElement", async () => {
    const { effect } = await import(distUrl("index.mjs"));
    const { domSignal } = await import(distUrl("dom/index.mjs"));

    const dom = domSignal("dist-attach-slot", null)!;
    let runs = 0;

    effect(() => {
      runs++;
      void dom.element;
    });

    expect(runs).toBe(1);

    dom.attachElement(document.createElement("div"));

    await vi.waitFor(() => {
      expect(runs).toBe(2);
    });
  });

  it("runStoreCleanup from dist purges non-global dom on stale route", async () => {
    const { domSignal } = await import(distUrl("dom/index.mjs"));
    const { getStoredDomSignal } = await import(distUrl("dom/dom-store.mjs"));
    const { runStoreCleanup } = await import(distUrl("shared/store/store-cleanup.mjs"));

    domSignal("dist-stale-purge", document.createElement("div"), { route: "/dist-stale" });

    await runStoreCleanup("/dist-current", "route");

    expect(getStoredDomSignal("dist-stale-purge", "/dist-stale", false)).toBeUndefined();
  });

  it("createSignal on a new route disposes non-global dom from dist/dom", async () => {
    const routeA = "/dist-create-signal-a";
    const routeB = "/dist-create-signal-b";
    const cacheId = "dist-create-signal-purge";

    const { domSignal } = await import(distUrl("dom/index.mjs"));
    const { getStoredDomSignal } = await import(distUrl("dom/dom-store.mjs"));
    const { createSignal } = await import(distUrl("index.mjs"));

    domSignal(cacheId, document.createElement("div"), { route: routeA, global: false });

    expect(getStoredDomSignal(cacheId, routeA, false)).toBeDefined();

    createSignal("dist-create-signal-trigger", 0, { route: routeB });

    expect(getStoredDomSignal(cacheId, routeA, false)).toBeUndefined();
  });

  it("useDomSignal from dist updates component state when markDomDirty runs", async () => {
    const React = await import("react");
    const { act } = await import("react");
    const { createRoot } = await import("react-dom/client");
    const { useDomSignal } = await import(distUrl("dom/react.mjs"));
    const { getStoredDomSignal } = await import(distUrl("dom/dom-store.mjs"));
    const { markDomDirty } = await import(distUrl("dom/internal.mjs"));

    const cacheId = "dist-use-dom-dirty";
    const node = document.createElement("div");
    const ref = { current: node };
    let renderCount = 0;

    const Test = () => {
      renderCount += 1;
      useDomSignal(ref, { cacheId });
      return null;
    };

    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => {
      root.render(React.createElement(Test));
    });

    const before = renderCount;
    const dom = getStoredDomSignal(cacheId, "/", false);

    markDomDirty(dom ?? null);

    await vi.waitFor(() => {
      expect(renderCount).toBeGreaterThan(before);
    });
  });
});
