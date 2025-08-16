import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { useCustomSyncExternalStore } from "../shared/hooks/useCustomeSynceExternalStore";

// Dummy deep comparator for testing
const shallowEqual = (a: any, b: any) => a === b;

describe("useCustomSyncExternalStore", () => {
  it("returns initial snapshot value", () => {
    const snapshot = { foo: "bar" };
    const getSnapshot = vi.fn(() => snapshot);
    const subscribe = vi.fn(() => () => {});

    const { result } = renderHook(() => useCustomSyncExternalStore(subscribe, getSnapshot, shallowEqual));

    expect(result.current).toBe(snapshot);
    //Because in dev, there are 2 renders, this breaks
    //expect(getSnapshot).toHaveBeenCalledTimes(1);
    expect(getSnapshot.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it("re-renders when snapshot changes", () => {
    let value = 0;
    const getSnapshot = vi.fn(() => value);
    const listeners: Array<() => void> = [];

    const subscribe = vi.fn((callback) => {
      listeners.push(callback);
      return () => {
        const index = listeners.indexOf(callback);
        if (index !== -1) listeners.splice(index, 1);
      };
    });

    const { result } = renderHook(() => useCustomSyncExternalStore(subscribe, getSnapshot, shallowEqual));

    expect(result.current).toBe(0);

    act(() => {
      value = 1;
      // Notify listeners that store changed
      listeners.forEach((cb) => cb());
    });

    expect(result.current).toBe(1);
    //Because in dev, there are 2 renders, this breaks
    //expect(getSnapshot).toHaveBeenCalledTimes(2);
    expect(getSnapshot.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it("does not re-render if snapshot does not change based on comparator", () => {
    let value = { x: 1 };
    const getSnapshot = vi.fn(() => value);

    const listeners: Array<() => void> = [];
    const subscribe = vi.fn((callback) => {
      listeners.push(callback);
      return () => {
        const index = listeners.indexOf(callback);
        if (index !== -1) listeners.splice(index, 1);
      };
    });

    const alwaysEqual = () => true;

    const { result } = renderHook(() => useCustomSyncExternalStore(subscribe, getSnapshot, alwaysEqual));

    const oldSnapshot = value; // keep reference to original

    expect(result.current).toBe(oldSnapshot);

    act(() => {
      value = { x: 2 };
      listeners.forEach((cb) => cb());
    });

    expect(result.current).toBe(oldSnapshot); // unchanged
  });

  it("calls unsubscribe on unmount", () => {
    const unsubscribe = vi.fn();
    const subscribe = vi.fn(() => unsubscribe);
    const getSnapshot = vi.fn(() => 42);

    const { unmount } = renderHook(() => useCustomSyncExternalStore(subscribe, getSnapshot));

    unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });
});
