import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

import { useCustomSyncExternalStore } from "./useCustomeSynceExternalStore";

import { signal, destroySignal } from "../utils/signals";

export const useSignal = <T>(initialValue: (Partial<T> | T) | Promise<T> | (() => Promise<T>)) => {
  const location = useLocation();
  const [uuid] = useState<string>(() => window.crypto.randomUUID());
  const { get, set, subscribe } = signal(uuid, initialValue);
  const getSnapshot = () => get();

  const subscribeCallback = (callback: () => void) => {
    const unsubscribe = subscribe(callback);
    return unsubscribe;
  };

  //This is for client side rendering only.
  const value = useCustomSyncExternalStore(subscribeCallback, getSnapshot);

  useEffect(() => {
    return () => {
      //Destroy the signal, if the route changes
      destroySignal(uuid);
    };
  }, [location]);

  return [value as T, set as (newValue: (null | undefined | Partial<T> | T) | Promise<T> | (() => Promise<T>)) => void];
};
