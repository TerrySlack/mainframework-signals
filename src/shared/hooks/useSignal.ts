import { useState, useSyncExternalStore } from "react";
import { createSignal } from "../utils/signals";
export const useSignal = <T>(
  initialValue: T | Promise<T> | (() => Promise<T>),
  //using the type 'any' here, because TS suddenly started complaining when this hook is used that it can't infer the type being returend.
  //Should be T instead, but it's not working.
): [any, (newValue: T | Promise<T> | (() => Promise<T>)) => void] => {
  const [uuidRef] = useState<string>(() => window.crypto.randomUUID());

  const signal = createSignal(initialValue, uuidRef);

  const getSnapshot = () => signal.get();

  const subscribe = (callback: () => void) => {
    const unsubscribe = signal.subscribe(callback);
    return unsubscribe;
  };

  const value = useSyncExternalStore(subscribe, getSnapshot);

  return [value as T, signal.set as (newValue: T | Promise<T> | (() => Promise<T>)) => void];
};
