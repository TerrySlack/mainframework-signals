import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, act, waitFor } from "@testing-library/react";
import { StrictMode, useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { peekDomElement } from "../dom/core";
import { getStoredDomSignal } from "../dom/dom-store";
import { destroyDomSignal } from "../dom/index";
import { getRoute } from "../shared/store/signal-store";
import { markDomDirty } from "../dom/internal";
import { useDomSignal } from "../dom/react";
import type { DomRef, DomSignal } from "../dom/types";
import { createSignal } from "../shared/core/signal";
import { resetAllStores } from "./helpers/store-reset";
import { restoreAfterWindowStub } from "./setup";

describe("useDomSignal hook", () => {
  afterEach(() => {
    restoreAfterWindowStub();
  });

  beforeEach(() => {
    resetAllStores();
  });

  it("does not call attachElement during render; layout attaches when ref is set", async () => {
    const cacheId = "use-dom-render-no-attach";
    const node = document.createElement("div");
    const ref: DomRef<HTMLDivElement> = { current: node };
    let attachDuringRender = 0;
    let domInstance: DomSignal | null = null;
    let patched = false;

    const Test = () => {
      let renderPhase = false;
      renderPhase = true;
      const dom = useDomSignal(ref, { cacheId });
      renderPhase = false;

      if (dom && !patched) {
        patched = true;
        domInstance = dom;
        const original = dom.attachElement.bind(dom);
        vi.spyOn(dom, "attachElement").mockImplementation((el) => {
          if (renderPhase) {
            attachDuringRender += 1;
          }

          return original(el);
        });
      }

      return null;
    };

    render(<Test />);

    expect(attachDuringRender).toBe(0);
    expect(domInstance).not.toBeNull();
    expect(peekDomElement(domInstance!)).toBe(node);
  });

  it("layout attach runs when ref.current is set and peek differs", async () => {
    const cacheId = "use-dom-layout-attach";
    const node = document.createElement("div");
    const ref: DomRef<HTMLDivElement> = { current: null };
    let domInstance: DomSignal | null = null;

    const Test = () => {
      domInstance = useDomSignal(ref, { cacheId });
      return null;
    };

    const { rerender } = render(<Test />);
    expect(peekDomElement(domInstance!)).toBeNull();

    ref.current = node;
    rerender(<Test />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(peekDomElement(domInstance!)).toBe(node);
  });

  it("unmount detach keeps store entry and unregisters bump for that instance", async () => {
    const cacheId = "use-dom-unmount-bump";
    const node = document.createElement("div");
    const ref: DomRef<HTMLDivElement> = { current: node };
    let domInstance: DomSignal | null = null;
    let renders = 0;

    const Test = () => {
      renders += 1;
      domInstance = useDomSignal(ref, { cacheId });
      return null;
    };

    const { unmount } = render(<Test />);
    const rendersAfterMount = renders;

    await act(async () => {
      await Promise.resolve();
    });

    unmount();

    expect(getStoredDomSignal(cacheId, getRoute(), false)).toBeDefined();
    expect(peekDomElement(domInstance!)).toBeNull();

    markDomDirty(domInstance);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(renders).toBe(rendersAfterMount);
  });

  it("Strict Mode remounts and second subscriber still receives markDomDirty", async () => {
    const cacheId = "use-dom-strict-shared";
    const nodeA = document.createElement("div");
    const nodeB = document.createElement("div");
    const refA: DomRef<HTMLDivElement> = { current: nodeA };
    const refB: DomRef<HTMLDivElement> = { current: nodeB };
    let rendersA = 0;
    let rendersB = 0;
    let domA: DomSignal | null = null;

    const A = () => {
      rendersA += 1;
      domA = useDomSignal(refA, { cacheId });
      return null;
    };

    const B = () => {
      rendersB += 1;
      useDomSignal(refB, { cacheId });
      return null;
    };

    const Parent = () => {
      const [showA, setShowA] = useState(true);

      const hideA = () => {
        setShowA(false);
      };

      return (
        <StrictMode>
          {showA ? <A /> : null}
          <B />
          <button type='button' onClick={hideA}>
            hide
          </button>
        </StrictMode>
      );
    };

    const { getByRole } = render(<Parent />);

    await act(async () => {
      await Promise.resolve();
    });

    const rendersBBefore = rendersB;

    await act(async () => {
      getByRole("button", { name: "hide" }).click();
    });

    markDomDirty(domA);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(rendersB).toBeGreaterThan(rendersBBefore);
  });

  it("parent re-render does not spuriously detach when ref unchanged", async () => {
    const cacheId = "use-dom-rerender-no-detach";
    const node = document.createElement("div");
    const ref: DomRef<HTMLDivElement> = { current: node };
    let domInstance: DomSignal | null = null;
    let detachCalls = 0;

    const Child = () => {
      const dom = useDomSignal(ref, { cacheId });
      domInstance = dom;

      if (dom) {
        const original = dom.detach.bind(dom);
        vi.spyOn(dom, "detach").mockImplementation(() => {
          detachCalls += 1;
          return original();
        });
      }

      return null;
    };

    const Parent = () => {
      const [n, setN] = useState(0);
      const onBump = () => {
        setN((v) => v + 1);
      };

      return (
        <>
          <button type='button' onClick={onBump}>
            {n}
          </button>
          <Child />
        </>
      );
    };

    const { getByRole } = render(<Parent />);

    await act(async () => {
      await Promise.resolve();
    });

    detachCalls = 0;
    const button = getByRole("button", { name: "0" });
    await act(async () => {
      button.click();
    });

    expect(detachCalls).toBe(0);
    expect(peekDomElement(domInstance!)).toBe(node);
  });

  it("ref cleared to null detaches in layout", async () => {
    const cacheId = "use-dom-ref-null-detach";
    const node = document.createElement("div");
    const ref: DomRef<HTMLDivElement> = { current: node };
    let domInstance: DomSignal | null = null;
    let showRef = true;

    const Test = () => {
      if (!showRef) {
        ref.current = null;
      } else {
        ref.current = node;
      }

      domInstance = useDomSignal(ref, { cacheId });
      return null;
    };

    const { rerender } = render(<Test />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(peekDomElement(domInstance!)).toBe(node);

    showRef = false;
    rerender(<Test />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(peekDomElement(domInstance!)).toBeNull();
  });

  it("hook unmount detach only; destroyDomSignal removes store entry", async () => {
    const cacheId = "use-dom-list-destroy";
    const node = document.createElement("div");
    const ref: DomRef<HTMLDivElement> = { current: node };

    const Test = () => {
      useDomSignal(ref, { cacheId });
      return null;
    };

    const { unmount } = render(<Test />);

    await act(async () => {
      await Promise.resolve();
    });

    unmount();

    expect(getStoredDomSignal(cacheId, getRoute(), false)).toBeDefined();

    destroyDomSignal(cacheId);

    expect(getStoredDomSignal(cacheId, getRoute(), false)).toBeUndefined();
  });

  it("returns null when window is undefined", async () => {
    vi.stubGlobal("window", undefined);
    vi.resetModules();

    const { useDomSignal: useDomSignalSsr } = await import("../dom/react");

    let hookResult: ReturnType<typeof useDomSignalSsr<HTMLDivElement>> | undefined;
    const ref: DomRef<HTMLDivElement> = { current: null };

    const Test = () => {
      hookResult = useDomSignalSsr(ref);
      return null;
    };

    expect(() => renderToStaticMarkup(<Test />)).not.toThrow();
    expect(hookResult).toBeNull();
  });

  it("does not warn about useLayoutEffect during SSR markup", async () => {
    vi.stubGlobal("window", undefined);
    vi.resetModules();

    const errors: string[] = [];
    const errorSpy = vi.spyOn(console, "error").mockImplementation((message) => {
      errors.push(String(message));
    });

    const { useDomSignal: useDomSignalSsr } = await import("../dom/react");
    const ref: DomRef<HTMLDivElement> = { current: null };

    const Test = () => {
      useDomSignalSsr(ref, { cacheId: "ssr-layout-warn" });
      return null;
    };

    renderToStaticMarkup(<Test />);

    const layoutWarning = errors.some((line) => line.includes("useLayoutEffect"));

    errorSpy.mockRestore();
    expect(layoutWarning).toBe(false);
  });

  it("subscription effect no-ops when cacheId is empty string", async () => {
    const node = document.createElement("div");
    const ref: DomRef<HTMLDivElement> = { current: node };
    let domInstance: DomSignal | null = null;
    let renders = 0;

    const Test = () => {
      renders += 1;
      domInstance = useDomSignal(ref, { cacheId: "" });
      return null;
    };

    render(<Test />);

    await act(async () => {
      await Promise.resolve();
    });

    const rendersAfterMount = renders;

    markDomDirty(domInstance);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(renders).toBe(rendersAfterMount);
  });

  it("mapped backing signal change triggers re-render", async () => {
    const cacheId = "use-dom-backing-rerender";
    const node = document.createElement("div");
    const ref: DomRef<HTMLDivElement> = { current: node };
    const signal = createSignal("use-dom-backing-sig", "a");
    let renders = 0;

    const Test = () => {
      renders += 1;
      useDomSignal(ref, { cacheId, backing: { textContent: signal } });
      return null;
    };

    render(<Test />);

    await act(async () => {
      await Promise.resolve();
    });

    const before = renders;

    await act(async () => {
      signal.set("b");
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(renders).toBeGreaterThan(before);
    });
  });
});
