import { useEffect, useState, useSyncExternalStore } from "react";
import { useLocation } from "react-router-dom";

import { createSignal, destroySignal } from "../utils/signals";

export const useSignal = <T>(
  initialValue: (Partial<T> | T) | Promise<T> | (() => Promise<T>),
  //using the type 'any' here, because TS suddenly started complaining when this hook is used that it can't infer the type being returend.
  //Should be T instead, but it's not working.
): [any, (newValue: T | Promise<T> | (() => Promise<T>)) => void] => {
  const location = useLocation();
  const [uuid] = useState<string>(() => window.crypto.randomUUID());
  const signal = createSignal(initialValue, uuid);
  const getSnapshot = () => signal.get();

  const subscribe = (callback: () => void) => {
    const unsubscribe = signal.subscribe(callback);
    return unsubscribe;
  };

  const value = useSyncExternalStore(subscribe, getSnapshot);

  useEffect(() => {
    return () => {
      //Destroy the signal, if the route changes
      destroySignal(uuid);
    };
  }, [location]);

  return [value as T, signal.set as (newValue: (Partial<T> | T) | Promise<T> | (() => Promise<T>)) => void];
};
