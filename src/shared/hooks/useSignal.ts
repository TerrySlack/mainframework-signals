import { useCallback, useRef } from "react";
import { useCustomSyncExternalStore } from "./useCustomeSynceExternalStore";
import { signal } from "../utils/signals";

export const useSignal = <T>(initialValue: null | undefined | Partial<T> | T | Promise<T> | (() => Promise<T>)) => {
  const uuidRef = useRef<string>("");

  //Make this ssr safe and only initialize once
  if (uuidRef.current.length === 0) {
    uuidRef.current = typeof window !== "undefined" && "crypto" in window ? crypto.randomUUID() : uuidRef.current;
  }

  const { get, set, subscribe } = signal(uuidRef.current, initialValue);

  // If get/subscribe are stable, we can skip useCallback here.
  const getSnapshot = useCallback(get, [get]);
  const subscribeCallback = useCallback(subscribe, [subscribe]);

  const value = useCustomSyncExternalStore(subscribeCallback, getSnapshot);

  return {
    value: value as T,
    set, // should already be correctly typed from signal()
  };
};
