// signal.ts

import { isEqual } from "@mainframework/is-deep-equal";
import { notify, SignalNode, track } from "./reactive";
import { resource } from "./resource";
import { getRoute, signalStore } from "../store";

export type Signal<T> = {
  (): T;
  set: (value: T | ((previous: T) => T)) => void;
};

export type SignalOptions = {
  global?: boolean;
  route?: string | number;
};

export type SignalInitialValue<T> = null | undefined | Partial<T> | T | Promise<T> | (() => Promise<T>);

export const signal = <T>(cacheId: string, initialValue: SignalInitialValue<T>, options?: SignalOptions): Signal<T> => {
  const route = getRoute(options?.route);

  let routeSignals = signalStore.get(route);

  if (!routeSignals) {
    routeSignals = new Map();
    signalStore.set(route, routeSignals);
  }

  const existing = routeSignals.get(cacheId);

  if (existing) {
    return existing.signal as Signal<T>;
  }

  const createdSignal =
    initialValue instanceof Promise || typeof initialValue === "function"
      ? (resource(cacheId, initialValue as Promise<T> | (() => Promise<T>), options) as unknown as Signal<T>)
      : (() => {
          const node: SignalNode<T> = {
            value: initialValue as T,
            computations: new Set(),
            equals: isEqual,
          };

          const getter = (() => {
            track(node);
            return node.value;
          }) as Signal<T>;

          getter.set = (value) => {
            const next = typeof value === "function" ? (value as (previous: T) => T)(node.value) : value;

            if (node.equals(node.value, next)) {
              return;
            }

            node.value = next;

            notify(node);
          };

          return getter;
        })();

  routeSignals.set(cacheId, {
    id: cacheId,
    route,
    global: options?.global ?? false,
    signal: createdSignal,
    created: Date.now(),
  });

  return createdSignal;
};
