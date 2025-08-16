import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, act } from "@testing-library/react";

import { useSignal } from "../shared/hooks/useSignal";
import { signalStore, findRoute, destroySignal } from "../shared/utils/signals";
import { useEffect } from "react";

describe("useSignal hook", () => {
  beforeEach(() => {
    signalStore.clear();
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

  it("should update value with set (sync)", () => {
    let value: number | null | undefined;
    let setFn!: (v: number) => void;

    const Test = () => {
      const hook = useSignal(0);
      value = hook.value;
      setFn = hook.set;
      return null;
    };

    render(<Test />);
    act(() => setFn(100));
    expect(value).toBe(100);
  });

  it("should update value with set (promise)", async () => {
    let value: number | null | undefined;
    let setFn!: (v: Promise<number>) => void;

    const Test = () => {
      const hook = useSignal(0);
      value = hook.value;
      setFn = hook.set;
      return null;
    };

    render(<Test />);
    await act(async () => {
      setFn(Promise.resolve(200));
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(value).toBe(200);
  });

  it("should handle async function in set", async () => {
    let value: number | null | undefined;
    let setFn!: (v: () => Promise<number>) => void;

    const Test = () => {
      const hook = useSignal(0);
      value = hook.value;
      setFn = hook.set;
      return null;
    };

    render(<Test />);
    await act(async () => {
      setFn(async () => 300);
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(value).toBe(300);
  });

  it("should propagate errors on rejected promises", async () => {
    let value: number | null | undefined;
    let setFn!: (v: Promise<number>) => void;

    const Test = () => {
      const hook = useSignal<number>(undefined);
      value = hook.value;
      setFn = hook.set;
      return null;
    };

    render(<Test />);
    await act(async () => {
      setFn(Promise.reject(new Error("Test error")));
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(value).toBeUndefined();
  });

  it("should create unique signals per hook instance", () => {
    let signal1: any;
    let signal2: any;

    const Test = () => {
      signal1 = useSignal(1);
      signal2 = useSignal(2);
      return null;
    };

    render(<Test />);
    expect(signal1).not.toBe(signal2);
    expect(signal1.value).toBe(1);
    expect(signal2.value).toBe(2);
  });

  it("should update value and notify subscribers", () => {
    let value: number | undefined | null;

    const Test = () => {
      const hook = useSignal(0);
      value = hook.value;

      useEffect(() => {
        hook.set(10);
        hook.set(20);
      }, []);

      return null;
    };

    render(<Test />);
    expect(value).toBe(20);
  });

  it("should destroy signal properly", () => {
    let hookRef: any;

    const Test = () => {
      hookRef = useSignal(123);
      return null;
    };

    render(<Test />);
    const route = findRoute(hookRef.value);
    if (route) destroySignal(hookRef.value); // destroy by ID
    expect(findRoute(hookRef.value)).toBeUndefined();
  });
});
