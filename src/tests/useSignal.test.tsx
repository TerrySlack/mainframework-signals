import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, act, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { useSignal } from "../shared/hooks/useSignal";
import { getStoredSignal } from "../shared/store";
import { resetAllStores } from "./helpers/store-reset";
import { restoreAfterWindowStub } from "./setup";

describe("useSignal hook", () => {
  afterEach(() => {
    restoreAfterWindowStub();
  });

  beforeEach(() => {
    resetAllStores();
  });

  it("returns null when window is undefined", async () => {
    vi.stubGlobal("window", undefined);
    vi.resetModules();

    const { useSignal: useSignalSsr } = await import("../shared/hooks/useSignal");

    let hookResult: ReturnType<typeof useSignalSsr<number>> | undefined;

    const Test = () => {
      hookResult = useSignalSsr(42);
      return null;
    };

    expect(() => renderToStaticMarkup(<Test />)).not.toThrow();
    expect(hookResult).toBeNull();
  });

  it("should initialize with initial value", () => {
    let value: number | null | undefined;
    const Test = () => {
      const hook = useSignal(42);
      value = hook.value;
      return null;
    };

    render(<Test />);
    expect(value).toBe(42);
  });

  it("should initialize with undefined if no initial value", () => {
    let value: number | null | undefined;
    const Test = () => {
      const hook = useSignal<number>(undefined);
      value = hook.value;
      return null;
    };

    render(<Test />);
    expect(value).toBeUndefined();
  });

  it("should update value with set (sync)", async () => {
    let value: number | null | undefined;
    let setFn!: (v: number) => void;

    const Test = () => {
      const hook = useSignal(0);
      value = hook.value;
      setFn = hook.set;
      return null;
    };

    const { rerender } = render(<Test />);
    await act(async () => {
      setFn(100);
      await Promise.resolve();
    });
    rerender(<Test />);
    expect(value).toBe(100);
  });

  it("should create unique signals per hook instance", () => {
    let signal1: ReturnType<typeof useSignal<number>>;
    let signal2: ReturnType<typeof useSignal<number>>;

    const Test = () => {
      signal1 = useSignal(1);
      signal2 = useSignal(2);
      return null;
    };

    render(<Test />);
    expect(signal1!.value).toBe(1);
    expect(signal2!.value).toBe(2);
  });

  it("should update value and notify subscribers", async () => {
    let value: number | undefined | null;

    const Test = () => {
      const hook = useSignal(0);
      value = hook.value;

      useEffect(() => {
        hook.set(10);
        hook.set(20);
      }, [hook.set]);

      return null;
    };

    render(<Test />);
    await waitFor(() => {
      expect(value).toBe(20);
    });
  });

  it("should resolve async useSignal from promise", async () => {
    let hookResult: ReturnType<typeof useSignal<{ id: number }>> | undefined;

    const Test = () => {
      hookResult = useSignal(Promise.resolve({ id: 1 }), { cacheId: "async-run-once" });
      return null;
    };

    render(<Test />);

    await waitFor(() => {
      expect(hookResult && "loading" in hookResult && hookResult.loading).toBe(false);
    });

    expect(hookResult && "value" in hookResult && hookResult.value).toEqual({ id: 1 });
    expect(hookResult && "error" in hookResult && hookResult.error).toBeNull();
  });

  it("should surface async errors from fetcher function", async () => {
    let hookResult: ReturnType<typeof useSignal<unknown>> | undefined;

    const Test = () => {
      hookResult = useSignal(() => Promise.reject(new Error("fail")), { cacheId: "async-error" });
      return null;
    };

    render(<Test />);

    await waitFor(() => {
      expect(hookResult && "loading" in hookResult && hookResult.loading).toBe(false);
    });

    expect(hookResult && "error" in hookResult && hookResult.error?.message).toBe("fail");
  });

  it("should share backing signal when cacheId matches", async () => {
    const cacheId = "shared-cache-id";
    let valueA = 0;
    let valueB = 0;
    let setA!: (v: number) => void;

    const Test = () => {
      const a = useSignal(0, { cacheId });
      const b = useSignal(0, { cacheId });
      valueA = a.value;
      valueB = b.value;
      setA = a.set;
      return null;
    };

    const { rerender } = render(<Test />);
    await act(async () => {
      setA(7);
      await Promise.resolve();
    });
    rerender(<Test />);
    expect(valueA).toBe(7);
    expect(valueB).toBe(7);
  });

  it("should keep store entry after unmount when route unchanged", () => {
    const cacheId = "unmount-cache";

    const Test = () => {
      useSignal(1, { cacheId, route: "unmount-route" });
      return null;
    };

    const { unmount } = render(<Test />);

    unmount();

    expect(getStoredSignal(cacheId, "unmount-route", false)).toBeDefined();
  });

  it("retains async value on remount and reload uses original fetcher", async () => {
    const cacheId = "async-remount-cache";
    let calls = 0;

    const TestA = () => {
      useSignal(
        () => {
          calls += 1;

          return Promise.resolve(calls);
        },
        { cacheId, route: "async-remount-route" },
      );
      return null;
    };

    const { unmount } = render(<TestA />);

    await waitFor(() => {
      expect(calls).toBeGreaterThanOrEqual(1);
    });

    unmount();

    let hookResult: ReturnType<typeof useSignal<number>> | undefined;
    let reloadFn!: () => void;

    const TestB = () => {
      hookResult = useSignal(() => Promise.resolve(99), { cacheId, route: "async-remount-route" });
      if (hookResult && "reload" in hookResult) {
        reloadFn = hookResult.reload;
      }
      return null;
    };

    render(<TestB />);

    await waitFor(() => {
      expect(hookResult && "loading" in hookResult && hookResult.loading).toBe(false);
    });

    expect(hookResult && "value" in hookResult && hookResult.value).toBe(1);

    await act(async () => {
      reloadFn();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(hookResult && "value" in hookResult && hookResult.value).toBe(2);
    });
  });

  it("should share store entry across separate mounts with same cacheId", () => {
    const cacheId = "remount-cache";
    let firstSet!: (v: number) => void;

    const TestA = () => {
      const hook = useSignal(0, { cacheId, route: "remount-route" });
      firstSet = hook.set;
      return null;
    };

    const { unmount } = render(<TestA />);

    act(() => {
      firstSet(3);
    });

    unmount();

    let remountValue = 0;

    const TestB = () => {
      const hook = useSignal(99, { cacheId, route: "remount-route" });
      remountValue = hook.value;
      return null;
    };

    render(<TestB />);

    expect(remountValue).toBe(3);
    expect(getStoredSignal(cacheId, "remount-route", false)).toBeDefined();
  });

  it("effect no-ops when isBrowser is false inside useEffect", async () => {
    vi.resetModules();

    let inHookEffect = false;

    vi.doMock("react", async () => {
      const React = await vi.importActual<typeof import("react")>("react");

      return {
        ...React,
        useEffect: (effect: () => void | (() => void), deps?: React.DependencyList) =>
          React.useEffect(() => {
            inHookEffect = true;

            try {
              return effect();
            } finally {
              inHookEffect = false;
            }
          }, deps),
      };
    });

    vi.doMock("../shared/utils/assert-browser", async () => {
      const actual = await vi.importActual<typeof import("../shared/utils/assert-browser")>(
        "../shared/utils/assert-browser",
      );

      return {
        ...actual,
        isBrowser: () => {
          if (inHookEffect) {
            return false;
          }

          return actual.isBrowser();
        },
      };
    });

    const { useSignal: useSignalIsolated } = await import("../shared/hooks/useSignal");

    let hookResult: ReturnType<typeof useSignalIsolated<number>> | undefined;

    const Test = () => {
      hookResult = useSignalIsolated(1, { cacheId: "effect-ssr-guard" });
      return null;
    };

    render(<Test />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(hookResult?.value).toBe(1);

    vi.doUnmock("react");
    vi.doUnmock("../shared/utils/assert-browser");
    vi.resetModules();
  });

  it("effect returns early when cacheId is empty string", async () => {
    let hookResult: ReturnType<typeof useSignal<number>> | undefined;

    const Test = () => {
      hookResult = useSignal(5, { cacheId: "" });
      return null;
    };

    render(<Test />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(hookResult?.value).toBe(5);
  });

  it("returns null when sync signal returns null", async () => {
    vi.resetModules();
    vi.doMock("../shared/core", async () => {
      const actual = await vi.importActual<typeof import("../shared/core")>("../shared/core");

      return {
        ...actual,
        signal: () => null,
      };
    });

    const { useSignal: useSignalMocked } = await import("../shared/hooks/useSignal");

    let hookResult: ReturnType<typeof useSignalMocked<number>> | undefined;

    const Test = () => {
      hookResult = useSignalMocked(1, { cacheId: "sync-null" });
      return null;
    };

    render(<Test />);

    expect(hookResult).toBeNull();

    vi.doUnmock("../shared/core");
    vi.resetModules();
  });

  it("returns null when async signal returns null", async () => {
    vi.resetModules();
    vi.doMock("../shared/core", async () => {
      const actual = await vi.importActual<typeof import("../shared/core")>("../shared/core");

      return {
        ...actual,
        signal: () => null,
      };
    });

    const { useSignal: useSignalMocked } = await import("../shared/hooks/useSignal");

    let hookResult: ReturnType<typeof useSignalMocked<{ id: number }>> | undefined;

    const Test = () => {
      hookResult = useSignalMocked(() => Promise.resolve({ id: 1 }), {
        cacheId: "async-null",
      });
      return null;
    };

    render(<Test />);

    expect(hookResult).toBeNull();

    vi.doUnmock("../shared/core");
    vi.resetModules();
  });

  it("should resolve async useSignal with refetchInterval", async () => {
    let hookResult: ReturnType<typeof useSignal<{ n: number }>> | undefined;

    const Test = () => {
      hookResult = useSignal(() => Promise.resolve({ n: 2 }), {
        refetchInterval: 1000,
        cacheId: "hook-interval",
      });
      return null;
    };

    render(<Test />);

    await waitFor(() => {
      expect(hookResult && "loading" in hookResult && hookResult.loading).toBe(false);
    });

    expect(hookResult && "value" in hookResult && hookResult.value).toEqual({ n: 2 });
  });

  it("should store signal with global and route options", () => {
    const cacheId = "global-route-signal";

    const Test = () => {
      useSignal(1, { cacheId, global: true, route: "custom-route" });
      return null;
    };

    render(<Test />);

    expect(getStoredSignal(cacheId, "custom-route", true)).toBeDefined();
  });
});
