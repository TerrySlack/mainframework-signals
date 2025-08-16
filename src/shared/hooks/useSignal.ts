import { useRef } from "react";
import { useCustomSyncExternalStore } from "./useCustomSyncExternalStore";
import { signal } from "../utils/signals";

export const useSignal = <T>(initialValue: null | undefined | Partial<T> | T | Promise<T> | (() => Promise<T>)) => {
  const uuidRef = useRef<string>("");

  //Make this ssr safe and only initialize once
  if (uuidRef.current.length === 0) {
    uuidRef.current =
      typeof window !== "undefined" && "crypto" in window
        ? crypto.randomUUID()
        : `sid_${Date.now()}_${Math.random().toString(36).slice(2)}`; //Add a random string
  }

  const { get, set, subscribe } = signal(uuidRef.current, initialValue);
  const value = useCustomSyncExternalStore(subscribe, get);

  return {
    value,
    set,
  };
};
