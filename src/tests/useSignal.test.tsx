import { describe, it, expect, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import { useEffect } from "react";

import { useSignal } from "../shared/hooks/useSignal";
import { signalStore } from "../shared/store";

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

  it("should update value with set (sync)", async () => {
    let value: number | null | undefined;
    let setFn!: (v: number) => void;

    const Test = () => {
      const hook = useSignal(0);
      value = hook.value;
      setFn = hook.set;
      return null;
    };

    render(<Test />);
    await act(async () => {
      setFn(100);
      await Promise.resolve();
    });
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

  it("should update value and notify subscribers", () => {
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
    expect(value).toBe(20);
  });
});
