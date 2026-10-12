"use client";

import { useEffect, useRef, useState } from "react";

import {
  createSignal,
  effect,
  type AsyncSource,
  type Resource,
  type Signal,
  type SignalInitialValue,
  type SignalOptions,
} from "../core";
import { getRoute, getStoredSignal } from "../store";
import { isBrowser } from "../utils/assert-browser";

const bump = (n: number) => (n === 9 ? 0 : n + 1);

export type UseSignalOptions = SignalOptions & {
  cacheId?: string;
};

export type UseSignal = {
  <T>(initialValue: AsyncSource<T>, options?: UseSignalOptions): Resource<T> | null;
  <T>(initialValue: SignalInitialValue<T>, options?: UseSignalOptions): Signal<T> | null;
};

export const useSignal = ((initialValue: SignalInitialValue<unknown>, options?: UseSignalOptions) => {
  const idRef = useRef("");
  const routeRef = useRef("");
  const globalRef = useRef(false);
  const [, setTrigger] = useState(0);

  useEffect(() => {
    if (!isBrowser()) {
      return;
    }

    effect(() => {
      const cacheId = idRef.current;

      if (cacheId.length === 0) {
        return;
      }

      const signal = getStoredSignal(cacheId, routeRef.current, globalRef.current);

      if (!signal) {
        return;
      }

      if ("reload" in signal) {
        signal();
        signal.loading();
        signal.error();
      } else {
        signal();
      }

      setTrigger(bump);
    });
  }, []);

  if (!isBrowser()) {
    return null;
  }

  if (idRef.current.length === 0) {
    idRef.current =
      options?.cacheId ??
      ("crypto" in window ? crypto.randomUUID() : `sid_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    routeRef.current = getRoute(options?.route);
    globalRef.current = options?.global ?? false;
  }

  createSignal(idRef.current, initialValue, options);

  return getStoredSignal(idRef.current, routeRef.current, globalRef.current) ?? null;
}) as UseSignal;
